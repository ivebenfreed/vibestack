import React, { useState, useMemo } from 'react';
import { observer } from '@legendapp/state/react';
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
import { Plus, Globe, Building2, User, Users, Heart, Target } from 'lucide-react';
import { useAuth } from '@/state-machines';
import { universeHelpers, currentOrganizations$ } from '@/legend-state/observables/universe-context';
import { WorldCard } from './WorldCard';
import { log } from '@/logger';

const fileLog = log('features/worlds/WorldManager.tsx');

// World interface - organizations are worlds now
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

interface CreateWorldFormData {
  name: string;
  lore: string;
  canon: string[];
  type: World['type'];
  isPersonal: boolean;
}

const INITIAL_FORM_DATA: CreateWorldFormData = {
  name: '',
  lore: '',
  canon: [],
  type: 'business',
  isPersonal: false,
};

export const WorldManager = observer(function WorldManager() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<World | null>(null);
  const [formData, setFormData] = useState<CreateWorldFormData>(INITIAL_FORM_DATA);
  const [canonInput, setCanonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get organizations from universe context - these ARE our worlds now
  const organizations = currentOrganizations$.get();
  
  // Transform organizations to worlds for display
  const worlds: World[] = useMemo(() => {
    return organizations.map(org => ({
      id: org.info.id,
      name: org.info.name,
      slug: org.info.slug,
      type: org.info.type || 'business',
      lore: (org as any).lore || generateDefaultLore(org.info.name, org.info.type),
      canon: (org as any).canon || generateDefaultCanon(org.info.type),
      created_at: org.info.joinedAt,
      updated_at: org.info.joinedAt,
      role: org.info.role,
      member_count: org.teams?.length || 0,
      project_count: (org.businessWorlds?.length || 0) + (org.personalWorlds?.length || 0)
    }));
  }, [organizations]);

  // Separate personal and business worlds
  const { personalWorlds, businessWorlds } = useMemo(() => {
    const personal = worlds.filter(world => world.type === 'personal');
    const business = worlds.filter(world => world.type === 'business');
    
    return {
      personalWorlds: personal,
      businessWorlds: business,
    };
  }, [worlds]);

  const handleCreateWorld = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      // In a real implementation, this would call an API to create a new organization
      // For now, we'll just show a toast indicating the world would be created
      const newWorld = {
        name: formData.name.trim(),
        type: formData.type,
        lore: formData.lore.trim() || generateDefaultLore(formData.name.trim(), formData.type),
        canon: formData.canon.length > 0 ? formData.canon : generateDefaultCanon(formData.type),
      };

      // TODO: Call API to create organization with lore/canon
      console.log('Would create world/organization:', newWorld);
      
      toast.success(`World "${formData.name}" would be created! (API integration needed)`);
      
      // Reset form
      setFormData(INITIAL_FORM_DATA);
      setCanonInput('');
      setIsCreateDialogOpen(false);
      
      fileLog.info('Created new world:', newWorld);
    } catch (error) {
      console.error('Failed to create world:', error);
      toast.error('Failed to create world');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWorld = (world: World) => {
    setEditingWorld(world);
    setFormData({
      name: world.name,
      lore: world.lore || '',
      canon: world.canon || [],
      type: world.type,
      isPersonal: world.type === 'personal',
    });
    setCanonInput((world.canon || []).join(', '));
    setIsCreateDialogOpen(true);
  };

  const handleUpdateWorld = async () => {
    if (!editingWorld || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const updates = {
        name: formData.name.trim(),
        lore: formData.lore.trim(),
        canon: formData.canon,
        type: formData.type,
      };

      // TODO: Call API to update organization
      console.log('Would update world/organization:', { id: editingWorld.id, updates });
      
      toast.success(`World "${formData.name}" would be updated! (API integration needed)`);
      
      // Reset form
      setEditingWorld(null);
      setFormData(INITIAL_FORM_DATA);
      setCanonInput('');
      setIsCreateDialogOpen(false);
      
      fileLog.info('Updated world:', { id: editingWorld.id, updates });
    } catch (error) {
      console.error('Failed to update world:', error);
      toast.error('Failed to update world');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorld = async (world: World) => {
    if (!confirm(`Are you sure you want to leave/delete the world "${world.name}"?`)) return;

    try {
      // TODO: Call API to leave/delete organization
      console.log('Would leave/delete world/organization:', world.id);
      
      toast.success(`Left world "${world.name}" (API integration needed)`);
      fileLog.info('Left world:', world.id);
    } catch (error) {
      console.error('Failed to leave world:', error);
      toast.error('Failed to leave world');
    }
  };

  const addCanonRule = () => {
    if (canonInput.trim()) {
      const newRules = canonInput.split(',').map(rule => rule.trim()).filter(Boolean);
      const updatedCanon = [...formData.canon, ...newRules];
      setFormData(prev => ({ ...prev, canon: updatedCanon }));
      setCanonInput('');
    }
  };

  const removeCanonRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      canon: prev.canon.filter((_, i) => i !== index)
    }));
  };

  const openCreateDialog = (isPersonal: boolean = false) => {
    setEditingWorld(null);
    setFormData({ 
      ...INITIAL_FORM_DATA, 
      isPersonal,
      type: isPersonal ? 'personal' : 'business' 
    });
    setCanonInput('');
    setIsCreateDialogOpen(true);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Please sign in to explore your worlds.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Your Worlds</h2>
          <p className="text-muted-foreground">
            Major life and business areas with their own purpose (lore) and rules (canon)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => openCreateDialog(true)}
            variant="outline"
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
      {personalWorlds.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Personal Worlds</h3>
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
              {personalWorlds.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalWorlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                onEdit={handleEditWorld}
                onDelete={handleDeleteWorld}
              />
            ))}
          </div>
        </div>
      )}

      {personalWorlds.length > 0 && businessWorlds.length > 0 && <Separator />}

      {/* Business Worlds Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Business Worlds</h3>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
            {businessWorlds.length}
          </Badge>
        </div>
        
        {businessWorlds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businessWorlds.map((world) => (
              <WorldCard
                key={world.id}
                world={world}
                onEdit={handleEditWorld}
                onDelete={handleDeleteWorld}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                No business worlds yet. Join or create your first professional world!
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formData.isPersonal ? (
                <User className="h-5 w-5 text-purple-600" />
              ) : (
                <Building2 className="h-5 w-5 text-blue-600" />
              )}
              {editingWorld ? 'Edit World' : 'Create New World'}
            </DialogTitle>
            <DialogDescription>
              {formData.isPersonal 
                ? 'Create a personal world for managing your life areas and personal growth.'
                : 'Create a business world for professional work, teams, and projects.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="world-name">World Name</Label>
              <Input
                id="world-name"
                placeholder={formData.isPersonal ? "Personal Life" : "My Company"}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="world-lore" className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                World Lore (Purpose & Mission)
              </Label>
              <Textarea
                id="world-lore"
                placeholder={formData.isPersonal 
                  ? "Living with intention, balance, and continuous growth while nurturing meaningful relationships..." 
                  : "Creating exceptional value for our clients through innovative solutions and collaborative teamwork..."
                }
                value={formData.lore}
                onChange={(e) => setFormData(prev => ({ ...prev, lore: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                World Canon (Rules & Standards)
              </Label>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add a rule or standard (e.g., Family time is sacred)"
                  value={canonInput}
                  onChange={(e) => setCanonInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCanonRule();
                    }
                  }}
                />
                <Button onClick={addCanonRule} variant="outline" size="sm">
                  Add
                </Button>
              </div>
              
              {formData.canon.length > 0 && (
                <div className="space-y-2">
                  {formData.canon.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="flex-1 text-sm">{rule}</span>
                      <Button 
                        onClick={() => removeCanonRule(index)}
                        variant="ghost" 
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Canon defines the non-negotiable rules and standards that govern this world
              </p>
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

// Helper functions
function generateDefaultLore(name: string, type?: string): string {
  if (type === 'personal') {
    return 'Creating a balanced and meaningful life with continuous growth, strong relationships, and purposeful action.';
  }
  return `${name} - Building excellence through collaboration, innovation, and shared commitment to quality outcomes.`;
}

function generateDefaultCanon(type?: string): string[] {
  if (type === 'personal') {
    return [
      'Family and relationships come first',
      'Health and wellness are non-negotiable',
      'Continuous learning and growth',
      'Be present and intentional'
    ];
  }
  return [
    'Respect and inclusion for all',
    'Quality over quantity',
    'Open communication',
    'Collaborative decision making'
  ];
}

export default WorldManager;