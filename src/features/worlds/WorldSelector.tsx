import React, { useMemo } from 'react';
import { observer } from '@legendapp/state/react';
import { use$ } from '@legendapp/state/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Globe, Building2, User, Users, Folder, Eye, Play, Pause, Archive, Edit } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getEntity$ } from '@/legend-state';
import { log } from '@/logger';

const fileLog = log('features/worlds/WorldSelector.tsx');

interface WorldData {
  id: string;
  name: string;
  description?: string;
  universe_id?: string;
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived';
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

interface UniverseData {
  id: string;
  name: string;
  owner_id: string;
}

interface WorldSelectorProps {
  value?: string;
  onValueChange?: (worldId: string) => void;
  showPersonalWorlds?: boolean;
  showOrganizationalWorlds?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  label?: string;
}

// Icons for world types and states
const TYPE_ICONS = {
  personal: User,
  business: Building2,
  client: Users,
  department: Building2,
  project_domain: Folder,
};

const STATE_ICONS = {
  exploring: Eye,
  developing: Edit,
  active: Play,
  paused: Pause,
  archived: Archive,
};

const STATE_COLORS = {
  exploring: 'text-blue-600',
  developing: 'text-yellow-600',
  active: 'text-green-600',
  paused: 'text-orange-600',
  archived: 'text-gray-600',
};

export const WorldSelector = observer(function WorldSelector({
  value,
  onValueChange,
  showPersonalWorlds = true,
  showOrganizationalWorlds = true,
  placeholder = "Select a world...",
  className = "",
  disabled = false,
  label,
}: WorldSelectorProps) {
  const { user } = useAuth();
  
  // Get data from Legend State
  const worldStore = getEntity$('world');
  const worldData = use$(worldStore);
  const universeStore = getEntity$('universe');
  const universeData = use$(universeStore);
  
  // Find user's universe
  const userUniverse = useMemo(() => {
    if (!universeData || !user?.id) return null;
    const universes = Object.values(universeData).filter(
      (universe: any) => universe && universe.owner_id === user.id
    ) as UniverseData[];
    return universes.length > 0 ? universes[0] : null;
  }, [universeData, user?.id]);

  // Filter and categorize worlds
  const { personalWorlds, organizationalWorlds, selectedWorld } = useMemo(() => {
    if (!worldData) return { personalWorlds: [], organizationalWorlds: [], selectedWorld: null };
    
    const allWorlds = Object.values(worldData).filter(Boolean) as WorldData[];
    
    const personal = showPersonalWorlds 
      ? allWorlds.filter(world => !!world.universe_id && world.state !== 'archived')
      : [];
    
    const organizational = showOrganizationalWorlds 
      ? allWorlds.filter(world => !world.universe_id && world.state !== 'archived')
      : [];
    
    const selected = value ? allWorlds.find(world => world.id === value) : null;
    
    // Sort worlds by state priority (active first) and then by name
    const sortWorlds = (worlds: WorldData[]) => {
      const stateOrder = { active: 0, developing: 1, exploring: 2, paused: 3, archived: 4 };
      return worlds.sort((a, b) => {
        const stateCompare = stateOrder[a.state] - stateOrder[b.state];
        if (stateCompare !== 0) return stateCompare;
        return a.name.localeCompare(b.name);
      });
    };
    
    return {
      personalWorlds: sortWorlds(personal),
      organizationalWorlds: sortWorlds(organizational),
      selectedWorld: selected,
    };
  }, [worldData, showPersonalWorlds, showOrganizationalWorlds, value]);

  const renderWorldItem = (world: WorldData, isPersonal: boolean) => {
    const TypeIcon = TYPE_ICONS[world.world_type];
    const StateIcon = STATE_ICONS[world.state];
    const stateColor = STATE_COLORS[world.state];
    
    return (
      <div className="flex items-center gap-2 py-1">
        <div className={`p-1 rounded ${isPersonal ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
          <TypeIcon className={`h-3 w-3 ${isPersonal ? 'text-purple-600' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-medium">{world.name}</span>
            <StateIcon className={`h-3 w-3 ${stateColor}`} />
          </div>
          {world.description && (
            <p className="text-xs text-muted-foreground truncate">
              {world.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  const getSelectedWorldDisplay = () => {
    if (!selectedWorld) return placeholder;
    
    const isPersonal = !!selectedWorld.universe_id;
    const TypeIcon = TYPE_ICONS[selectedWorld.world_type];
    const StateIcon = STATE_ICONS[selectedWorld.state];
    const stateColor = STATE_COLORS[selectedWorld.state];
    
    return (
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded ${isPersonal ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
          <TypeIcon className={`h-3 w-3 ${isPersonal ? 'text-purple-600' : 'text-blue-600'}`} />
        </div>
        <span className="truncate">{selectedWorld.name}</span>
        <StateIcon className={`h-3 w-3 ${stateColor}`} />
      </div>
    );
  };

  const totalWorlds = personalWorlds.length + organizationalWorlds.length;

  if (totalWorlds === 0) {
    return (
      <div className={className}>
        {label && <Label className="text-sm font-medium mb-2 block">{label}</Label>}
        <div className="p-3 border rounded-md bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            No worlds available. Create a world first to organize your projects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && <Label className="text-sm font-medium mb-2 block">{label}</Label>}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue>
            {getSelectedWorldDisplay()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Personal Worlds Section */}
          {personalWorlds.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-purple-600 bg-purple-500/5 border-b">
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  Personal Worlds
                  <Badge variant="secondary" className="h-4 px-1 text-xs bg-purple-500/10 text-purple-600">
                    {personalWorlds.length}
                  </Badge>
                </div>
              </div>
              {personalWorlds.map((world) => (
                <SelectItem key={world.id} value={world.id} className="py-2">
                  {renderWorldItem(world, true)}
                </SelectItem>
              ))}
            </>
          )}
          
          {/* Divider */}
          {personalWorlds.length > 0 && organizationalWorlds.length > 0 && (
            <div className="border-t my-1" />
          )}
          
          {/* Organizational Worlds Section */}
          {organizationalWorlds.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-blue-600 bg-blue-500/5 border-b">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  Business Worlds
                  <Badge variant="secondary" className="h-4 px-1 text-xs bg-blue-500/10 text-blue-600">
                    {organizationalWorlds.length}
                  </Badge>
                </div>
              </div>
              {organizationalWorlds.map((world) => (
                <SelectItem key={world.id} value={world.id} className="py-2">
                  {renderWorldItem(world, false)}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      
      {/* Helper text */}
      {selectedWorld && (
        <p className="text-xs text-muted-foreground mt-1">
          Project will be created in the "{selectedWorld.name}" world
        </p>
      )}
    </div>
  );
});

export default WorldSelector;