import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { observer } from '@legendapp/state/react';
import { EntityCard } from './EntityCard';
import { Badge } from '@/components/ui/badge';
import { Globe, Building } from 'lucide-react';
import { use$ } from '@legendapp/state/react';
import { log } from '@/logger';

const fileLog = log('features/dashboard/DashboardContentOptimized.tsx');

// Progressive rendering configuration
const INITIAL_BATCH_SIZE = 5;
const RENDER_DELAY = 16; // One frame

interface DashboardContentOptimizedProps {
  schema: any;
  displayOrganizationName: string;
  isUniverseMode: boolean;
  contextOrgId: string;
  onEntityRemove: (entityTypeKey: string, entityName: string) => void;
}

export const DashboardContentOptimized = observer(function DashboardContentOptimized({
  schema,
  displayOrganizationName,
  isUniverseMode,
  contextOrgId,
  onEntityRemove
}: DashboardContentOptimizedProps) {
  const [isPending, startTransition] = useTransition();
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);

  // Get entity list
  const entityList = React.useMemo(() => {
    if (!schema?.entities) return [];

    return Object.entries(schema.entities)
      .filter(([_, entityConfig]: [string, any]) => {
        if (isUniverseMode) return true;
        return !contextOrgId || entityConfig.organizationId === contextOrgId;
      })
      .map(([key, config]: [string, any]) => ({
        key,
        config,
        displayName: config.displayName || key,
        pluralName: config.pluralName || `${config.displayName || key}s`,
        icon: config.icon || 'file',
        category: config.category || 'general',
        description: config.description || `${config.displayName || key} records`
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [schema?.entities, isUniverseMode, contextOrgId]);

  // Progressive rendering - load more entities after initial paint
  useEffect(() => {
    if (entityList.length <= INITIAL_BATCH_SIZE) {
      setVisibleCount(entityList.length);
      return;
    }

    // Use requestIdleCallback for progressive loading
    const loadMore = () => {
      startTransition(() => {
        setVisibleCount(prev => {
          const next = Math.min(prev + INITIAL_BATCH_SIZE, entityList.length);
          fileLog.info(`Progressive load: showing ${next}/${entityList.length} entities`);
          return next;
        });
      });

      if (visibleCount < entityList.length) {
        requestAnimationFrame(() => {
          setTimeout(loadMore, RENDER_DELAY);
        });
      }
    };

    // Start progressive loading after initial paint
    const handle = requestAnimationFrame(() => {
      setTimeout(loadMore, RENDER_DELAY);
    });

    return () => cancelAnimationFrame(handle);
  }, [entityList.length, visibleCount]);

  // Visible entities for rendering
  const visibleEntities = entityList.slice(0, visibleCount);
  const remainingCount = entityList.length - visibleCount;

  return (
    <>
      {/* Header */}
      <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg">
        <div className="flex items-center gap-3">
          {isUniverseMode ? (
            <Globe className="h-8 w-8 text-blue-600" />
          ) : (
            <Building className="h-8 w-8 text-indigo-600" />
          )}
          <div>
            <h3 className="text-lg font-semibold">
              {displayOrganizationName} View
            </h3>
            <p className="text-sm text-muted-foreground">
              {entityList.length} entities
            </p>
          </div>
        </div>
      </div>

      {/* Entity Grid - Progressive Rendering */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleEntities.map(({ key, config, displayName, pluralName, description }) => (
          <EntityCard
            key={key}
            entityTypeKey={key}
            organizationId={contextOrgId === 'universe' ? undefined : contextOrgId}
            entityName={displayName}
            pluralName={pluralName}
            description={description}
            icon={config.icon}
            category={config.category}
            onRemove={contextOrgId === 'universe' ? undefined : onEntityRemove}
          />
        ))}

        {/* Loading indicator for remaining entities */}
        {remainingCount > 0 && (
          <div className="col-span-full flex justify-center py-4">
            <div className="text-sm text-muted-foreground">
              Loading {remainingCount} more entities...
            </div>
          </div>
        )}
      </div>

      {/* Transition pending indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">
          Updating...
        </div>
      )}
    </>
  );
});