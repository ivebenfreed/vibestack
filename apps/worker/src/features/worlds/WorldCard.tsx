import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Globe, 
  Building2, 
  User, 
  Users, 
  Folder, 
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Play,
  Pause,
  Archive,
  Sparkles
} from 'lucide-react';

interface WorldData {
  id: string;
  name: string;
  description?: string;
  universe_id?: string; // If null, it's organizational
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived';
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Additional computed properties
  projectCount?: number;
  isPersonal?: boolean;
}

interface WorldCardProps {
  world: WorldData;
  onEdit?: (world: WorldData) => void;
  onDelete?: (world: WorldData) => void;
  onStateChange?: (world: WorldData, newState: WorldData['state']) => void;
  className?: string;
}

// State configuration
const STATE_CONFIG = {
  exploring: { 
    color: 'bg-blue-500/10 text-blue-600', 
    icon: Eye, 
    label: 'Exploring',
    description: 'Initial discovery phase'
  },
  developing: { 
    color: 'bg-yellow-500/10 text-yellow-600', 
    icon: Edit, 
    label: 'Developing',
    description: 'Building and planning'
  },
  active: { 
    color: 'bg-green-500/10 text-green-600', 
    icon: Play, 
    label: 'Active',
    description: 'Actively working'
  },
  paused: { 
    color: 'bg-orange-500/10 text-orange-600', 
    icon: Pause, 
    label: 'Paused',
    description: 'Temporarily on hold'
  },
  archived: { 
    color: 'bg-gray-500/10 text-gray-600', 
    icon: Archive, 
    label: 'Archived',
    description: 'Completed or inactive'
  },
};

// World type configuration
const TYPE_CONFIG = {
  personal: { color: 'bg-purple-500/10 text-purple-600', icon: User, label: 'Personal' },
  business: { color: 'bg-blue-500/10 text-blue-600', icon: Building2, label: 'Business' },
  client: { color: 'bg-green-500/10 text-green-600', icon: Users, label: 'Client' },
  department: { color: 'bg-indigo-500/10 text-indigo-600', icon: Building2, label: 'Department' },
  project_domain: { color: 'bg-pink-500/10 text-pink-600', icon: Folder, label: 'Project Domain' },
};

// Priority configuration
const PRIORITY_CONFIG = {
  low: { color: 'bg-gray-500/10 text-gray-600', label: 'Low' },
  medium: { color: 'bg-blue-500/10 text-blue-600', label: 'Medium' },
  high: { color: 'bg-orange-500/10 text-orange-600', label: 'High' },
  critical: { color: 'bg-red-500/10 text-red-600', label: 'Critical' },
};

export const WorldCard: React.FC<WorldCardProps> = ({
  world,
  onEdit,
  onDelete,
  onStateChange,
  className = ''
}) => {
  const stateConfig = STATE_CONFIG[world.state];
  const typeConfig = TYPE_CONFIG[world.world_type];
  const priorityConfig = PRIORITY_CONFIG[world.priority];
  const StateIcon = stateConfig.icon;
  const TypeIcon = typeConfig.icon;
  
  const isPersonal = !!world.universe_id;

  const handleStateChange = (newState: WorldData['state']) => {
    if (onStateChange) {
      onStateChange(world, newState);
    }
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${typeConfig.color}`}>
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold truncate">
                {world.name}
                {isPersonal && (
                  <Sparkles className="inline h-3 w-3 ml-1 text-purple-500" />
                )}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {world.description || `${typeConfig.label} world`}
              </CardDescription>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>World Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit?.(world)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Change State</DropdownMenuLabel>
              {Object.entries(STATE_CONFIG).map(([state, config]) => {
                const Icon = config.icon;
                return (
                  <DropdownMenuItem
                    key={state}
                    onClick={() => handleStateChange(state as WorldData['state'])}
                    disabled={world.state === state}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {config.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete?.(world)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* State and Priority Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={stateConfig.color}>
            <StateIcon className="mr-1 h-3 w-3" />
            {stateConfig.label}
          </Badge>
          
          <Badge variant="outline" className={priorityConfig.color}>
            {priorityConfig.label}
          </Badge>
          
          {isPersonal ? (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
              <User className="mr-1 h-3 w-3" />
              Personal
            </Badge>
          ) : (
            <Badge variant="outline" className={typeConfig.color}>
              <TypeIcon className="mr-1 h-3 w-3" />
              {typeConfig.label}
            </Badge>
          )}
        </div>
        
        {/* Project Count */}
        {typeof world.projectCount === 'number' && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Folder className="h-3 w-3" />
            <span>{world.projectCount} project{world.projectCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Updated {new Date(world.updated_at).toLocaleDateString()}</span>
          {world.state !== 'active' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStateChange('active')}
              className="h-6 px-2 text-xs"
            >
              Activate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorldCard;