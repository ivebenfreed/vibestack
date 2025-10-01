/**
 * Entity Studio Main Component
 * Container for the entity visualization feature
 */

import React, { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { EntityStudioView } from './components/EntityStudioView'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { useEntityStudioData } from './hooks/useEntityStudioData'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function EntityStudio() {
  const { orgId } = useParams({ from: '/_authenticated/org/$orgId/entity-studio' })
  const { userOrganizations } = useUnifiedAuth()
  const { stats } = useEntityStudioData(orgId)
  const [showStats, setShowStats] = useState(false)

  // Find current organization name
  const currentOrg = userOrganizations?.find(org => org.id === orgId)

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with all controls */}
      <header className="border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold">Entity Studio</h1>
              <p className="text-xs text-muted-foreground">
                Visual entity relationship explorer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats - Always visible as badges */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {stats.totalEntities} entities
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.totalFields} fields
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.totalRelationships} relationships
              </Badge>
            </div>

            {/* Organization */}
            {currentOrg && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded border-l pl-3">
                <span className="text-xs text-muted-foreground">Org:</span>
                <span className="text-xs font-medium">{currentOrg.name}</span>
              </div>
            )}

            {/* Stats Toggle */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowStats(!showStats)}
              className="h-7 px-2"
            >
              {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Collapsible stats detail */}
        {showStats && (
          <div className="border-t border-border px-6 py-3 bg-muted/30">
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-muted-foreground">Archetypes: </span>
                <span>{Array.from(stats.archetypes).join(', ')}</span>
              </div>
              <div className="text-muted-foreground">
                • Drag to pan • Scroll to zoom • Click + to expand fields • Hover edges for details
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Full screen graph */}
      <div className="flex-1 relative overflow-hidden">
        <EntityStudioView orgId={orgId} />
      </div>
    </div>
  )
}
