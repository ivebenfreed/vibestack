import React, { useState, useMemo } from 'react';
import { observer } from '@legendapp/state/react';
import { use$ } from '@legendapp/state/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Globe, Building2, User, Users, Folder } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { orgContext$, getEntity$ } from '@/legend-state';
import { WorldCard } from './WorldCard';
import { uiLog } from '@/logger';

const log = uiLog('features/worlds/WorldManager.tsx');

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
  created_by?: string;
  projectCount?: number;
}

interface UniverseData {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
}

interface CreateWorldFormData {
  name: string;
  description: string;
  world_type: WorldData['world_type'];
  priority: WorldData['priority'];
  state: WorldData['state'];
  isPersonal: boolean;
}

const INITIAL_FORM_DATA: CreateWorldFormData = {
  name: '',
  description: '',
  world_type: 'personal',
  priority: 'medium',
  state: 'exploring',
  isPersonal: true,
};

// World type options
const WORLD_TYPE_OPTIONS = [
  { value: 'personal', label: 'Personal', icon: User, description: 'Personal life area' },
  { value: 'business', label: 'Business', icon: Building2, description: 'Business domain' },
  { value: 'client', label: 'Client', icon: Users, description: 'Client-specific work' },
  { value: 'department', label: 'Department', icon: Building2, description: 'Organizational department' },
  { value: 'project_domain', label: 'Project Domain', icon: Folder, description: 'Thematic project area' },
];

export const WorldManager = observer(function WorldManager() {
  const { user, currentOrganization } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<WorldData | null>(null);
  const [formData, setFormData] = useState<CreateWorldFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get data from Legend State by archetype instead of fixed entity names
  const orgData = use$(orgContext$);
  const schema = orgData?.schema;
  
  // Find all entities with 'world' and 'universe' archetypes
  const { worldEntities, universeEntities } = useMemo(() => {
    if (!schema?.entities) return { worldEntities: [], universeEntities: [] };
    
    const worldEntityNames = Object.entries(schema.entities)
      .filter(([_, entityDef]: [string, any]) => entityDef.archetype === 'world')
      .map(([entityName]) => entityName);
    
    const universeEntityNames = Object.entries(schema.entities)
      .filter(([_, entityDef]: [string, any]) => entityDef.archetype === 'universe')
      .map(([entityName]) => entityName);
      
    return {
      worldEntities: worldEntityNames,
      universeEntities: universeEntityNames
    };
  }, [schema]);

  // Get all world data from all world-type entities
  const { allWorldData, allUniverseData } = useMemo(() => {
    let worldData: Record<string, any> = {};
    let universeData: Record<string, any> = {};
    
    // Collect data from all world entities
    worldEntities.forEach(entityName => {
      const entityStore = getEntity$(entityName);
      const data = use$(entityStore);
      if (data) {
        Object.entries(data).forEach(([id, record]: [string, any]) => {
          if (record) {
            worldData[id] = { ...record, _entityName: entityName };
          }
        });
      }
    });
    
    // Collect data from all universe entities
    universeEntities.forEach(entityName => {
      const entityStore = getEntity$(entityName);
      const data = use$(entityStore);
      if (data) {
        Object.entries(data).forEach(([id, record]: [string, any]) => {
          if (record) {
            universeData[id] = { ...record, _entityName: entityName };
          }
        });
      }
    });
    
    return { allWorldData: worldData, allUniverseData: universeData };
  }, [worldEntities, universeEntities]);
  
  // Find user's universe
  const userUniverse = useMemo(() => {
    if (!allUniverseData || !user?.id) return null;
    const universes = Object.values(allUniverseData).filter(
      (universe: any) => universe && universe.owner_id === user.id
    ) as UniverseData[];
    return universes.length > 0 ? universes[0] : null;
  }, [allUniverseData, user?.id]);

  // Filter and categorize worlds
  const { personalWorlds, organizationalWorlds } = useMemo(() => {
    if (!allWorldData) return { personalWorlds: [], organizationalWorlds: [] };
    
    const allWorlds = Object.values(allWorldData).filter(Boolean) as WorldData[];
    
    const personal = allWorlds.filter(world => !!world.universe_id);
    const organizational = allWorlds.filter(world => !world.universe_id);
    
    return {
      personalWorlds: personal,
      organizationalWorlds: organizational,
    };
  }, [allWorldData]);

  const handleCreateWorld = async () => {
    if (!formData.name.trim() || worldEntities.length === 0) return;

    setIsSubmitting(true);
    try {
      const newWorld = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        universe_id: formData.isPersonal ? userUniverse?.id : undefined,
        state: formData.state,
        world_type: formData.world_type,
        priority: formData.priority,
        created_by: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Use the first world entity for creating new worlds
      const worldEntityName = worldEntities[0];
      const worldStore = getEntity$(worldEntityName);
      
      if (worldStore) {
        const newId = crypto.randomUUID();
        const currentData = worldStore.get() || {};
        worldStore.set({ ...currentData, [newId]: { ...newWorld, id: newId } });
        
        toast.success(`${formData.isPersonal ? 'Personal' : 'Organizational'} world created successfully!`);
        
        // Reset form
        setFormData(INITIAL_FORM_DATA);
        setIsCreateDialogOpen(false);
        
        log.info('Created new world:', newWorld);
      }
    } catch (error) {
      console.error('Failed to create world:', error);
      toast.error('Failed to create world');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWorld = (world: WorldData) => {
    setEditingWorld(world);
    setFormData({
      name: world.name,
      description: world.description || '',
      world_type: world.world_type,
      priority: world.priority,
      state: world.state,
      isPersonal: !!world.universe_id,
    });
    setIsCreateDialogOpen(true);
  };

  const handleUpdateWorld = async () => {
    if (!editingWorld || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const updates = {
        ...editingWorld,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        world_type: formData.world_type,
        priority: formData.priority,
        state: formData.state,
        updated_at: new Date().toISOString(),
      };

      // Find the correct entity store based on the world's entity name
      const entityName = (editingWorld as any)._entityName;
      const worldStore = getEntity$(entityName);
      
      if (worldStore) {
        const currentData = worldStore.get() || {};
        worldStore.set({ ...currentData, [editingWorld.id]: updates });
        
        toast.success('World updated successfully!');
        
        // Reset form
        setEditingWorld(null);
        setFormData(INITIAL_FORM_DATA);
        setIsCreateDialogOpen(false);
        
        log.info('Updated world:', { id: editingWorld.id, updates });
      }
    } catch (error) {
      console.error('Failed to update world:', error);
      toast.error('Failed to update world');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorld = async (world: WorldData) => {
    if (!confirm(`Are you sure you want to delete "${world.name}"?`)) return;

    try {
      // Find the correct entity store based on the world's entity name
      const entityName = (world as any)._entityName;
      const worldStore = getEntity$(entityName);
      
      if (worldStore) {
        const currentData = worldStore.get() || {};
        const { [world.id]: deletedWorld, ...remainingData } = currentData;
        worldStore.set(remainingData);
        
        toast.success('World deleted successfully!');
        log.info('Deleted world:', world.id);
      }
    } catch (error) {
      console.error('Failed to delete world:', error);
      toast.error('Failed to delete world');
    }
  };

  const handleStateChange = async (world: WorldData, newState: WorldData['state']) => {
    try {
      // Find the correct entity store based on the world's entity name
      const entityName = (world as any)._entityName;
      const worldStore = getEntity$(entityName);
      
      if (worldStore) {
        const updates = {
          ...world,
          state: newState,
          updated_at: new Date().toISOString(),
        };
        
        const currentData = worldStore.get() || {};
        worldStore.set({ ...currentData, [world.id]: updates });
        
        toast.success(`World state changed to ${newState}`);
        log.info('Changed world state:', { id: world.id, newState });
      }
    } catch (error) {
      console.error('Failed to change world state:', error);
      toast.error('Failed to change world state');
    }
  };

  const openCreateDialog = (isPersonal: boolean = true) => {
    setEditingWorld(null);
    setFormData({ ...INITIAL_FORM_DATA, isPersonal });
    setIsCreateDialogOpen(true);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Please sign in to manage worlds.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Worlds</h2>
          <p className="text-muted-foreground">
            Organize your projects into life areas and business domains
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => openCreateDialog(true)}
            variant="outline"
            disabled={!userUniverse}
          >
            <User className="mr-2 h-4 w-4" />
            Personal World
          </Button>
          <Button onClick={() => openCreateDialog(false)}>
            <Building2 className="mr-2 h-4 w-4" />
            Business World
          </Button>
        </div>
      </div>

      {/* Personal Worlds Section */}
      {userUniverse && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Personal Worlds</h3>
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
              {personalWorlds.length}
            </Badge>
          </div>
          
          {personalWorlds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalWorlds.map((world) => (
                <WorldCard
                  key={world.id}
                  world={world}
                  onEdit={handleEditWorld}
                  onDelete={handleDeleteWorld}
                  onStateChange={handleStateChange}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">
                  No personal worlds yet. Create your first life area!
                </p>
                <Button onClick={() => openCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Personal World
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator />

      {/* Organizational Worlds Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Organizational Worlds</h3>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
            {organizationalWorlds.length}
          </Badge>
        </div>
        
        {organizationalWorlds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizationalWorlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                onEdit={handleEditWorld}
                onDelete={handleDeleteWorld}
                onStateChange={handleStateChange}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                No organizational worlds yet. Create business domains for your team!
              </p>
              <Button onClick={() => openCreateDialog(false)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Business World
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingWorld ? 'Edit World' : 'Create New World'}
            </DialogTitle>
            <DialogDescription>
              {formData.isPersonal 
                ? 'Create a personal world for organizing your life areas and personal projects.'
                : 'Create an organizational world for business domains and team projects.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="world-name">World Name</Label>
              <Input
                id="world-name"
                placeholder={formData.isPersonal ? "Health & Wellness" : "Engineering"}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="world-description">Description (Optional)</Label>
              <Textarea
                id="world-description"
                placeholder={formData.isPersonal 
                  ? "Physical fitness, mental health, nutrition..." 
                  : "Software development, infrastructure, DevOps..."
                }
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>World Type</Label>
                <Select 
                  value={formData.world_type} 
                  onValueChange={(value: WorldData['world_type']) => 
                    setFormData(prev => ({ ...prev, world_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORLD_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value: WorldData['priority']) => 
                    setFormData(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingWorld ? handleUpdateWorld : handleCreateWorld}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting 
                ? (editingWorld ? 'Updating...' : 'Creating...')
                : (editingWorld ? 'Update World' : 'Create World')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default WorldManager;