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
import { Progress } from '@/components/ui/progress';
import { 
  Globe, 
  Building2, 
  User, 
  Users, 
  MoreHorizontal,
  Edit,
  ExternalLink,
  Heart,
  Target,
  Activity,
  Crown
} from 'lucide-react';

interface World {
  id: string;
  name: string;
  slug: string;
  type: 'personal' | 'business';
  lore?: string; // Purpose, mission, story
  canon?: string[]; // Rules, standards, boundaries
  created_at: string;
  updated_at: string;
  role: 'member' | 'manager' | 'admin' | 'owner';
  member_count?: number;
  project_count?: number;
}

interface WorldCardProps {
  world: World;
  onEdit?: (world: World) => void;
  onDelete?: (world: World) => void;
  className?: string;
}

export function WorldCard({ world, onEdit, onDelete, className }: WorldCardProps) {
  const isPersonal = world.type === 'personal';
  
  // Determine role colors and icons
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'owner':
        return { color: 'text-yellow-600', icon: Crown, label: 'Owner' };
      case 'admin':
        return { color: 'text-red-600', icon: Users, label: 'Admin' };
      case 'manager':
        return { color: 'text-blue-600', icon: Users, label: 'Manager' };
      default:
        return { color: 'text-gray-600', icon: User, label: 'Member' };
    }
  };

  const roleInfo = getRoleInfo(world.role);
  const RoleIcon = roleInfo.icon;

  // Simulate world health (in real app, this would come from backend)
  const worldHealth = {
    momentum: 75,
    satisfaction: 85,
    alignment: 90
  };

  const overallHealth = Math.round((worldHealth.momentum + worldHealth.satisfaction + worldHealth.alignment) / 3);

  return (
    <Card className={`group hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${isPersonal ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
              {isPersonal ? (
                <Globe className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg leading-6 truncate">
                  {world.name}
                </CardTitle>
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${isPersonal ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
                >
                  {isPersonal ? 'Personal' : 'Business'}
                </Badge>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <RoleIcon className={`h-3 w-3 ${roleInfo.color}`} />
                <span className={`text-xs ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              </div>
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
                <Edit className="h-4 w-4 mr-2" />
                Edit World
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open World
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete?.(world)} 
                className="text-red-600"
              >
                <Users className="h-4 w-4 mr-2" />
                Leave World
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* World Lore */}
        {world.lore && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-muted-foreground">Lore</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {world.lore.length > 120 ? `${world.lore.substring(0, 120)}...` : world.lore}
            </p>
          </div>
        )}

        {/* World Canon */}
        {world.canon && world.canon.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-muted-foreground">Canon</span>
            </div>
            <div className="space-y-1">
              {world.canon.slice(0, 2).map((rule, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {rule.length > 60 ? `${rule.substring(0, 60)}...` : rule}
                  </p>
                </div>
              ))}
              {world.canon.length > 2 && (
                <p className="text-xs text-muted-foreground italic">
                  +{world.canon.length - 2} more rules...
                </p>
              )}
            </div>
          </div>
        )}

        {/* World Health */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-muted-foreground">World Health</span>
            <Badge variant="outline" className="text-xs">
              {overallHealth}%
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Momentum</span>
              <span>{worldHealth.momentum}%</span>
            </div>
            <Progress value={worldHealth.momentum} className="h-1" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{world.member_count || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span>{world.project_count || 0} projects</span>
            </div>
          </div>
          
          <Badge 
            variant="outline" 
            className={`${
              overallHealth >= 80 ? 'border-green-200 text-green-700' :
              overallHealth >= 60 ? 'border-yellow-200 text-yellow-700' :
              'border-red-200 text-red-700'
            }`}
          >
            {overallHealth >= 80 ? 'Thriving' :
             overallHealth >= 60 ? 'Growing' : 'Needs Attention'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default WorldCard;