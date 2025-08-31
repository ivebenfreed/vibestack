import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { Plus, FolderOpen, CheckSquare, FileText, File, Zap, MessageCircle, Library, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getEntity$, orgContext$ } from '@/legend-state';
import { use$ } from '@legendapp/state/react';
import { observer } from '@legendapp/state/react';
import { WorldSelector } from '@/features/worlds/WorldSelector';

// Archetype configuration with icons and descriptions
const ARCHETYPES = [
  { value: 'project', label: 'Project', icon: FolderOpen, description: 'Create a new project' },
  { value: 'task', label: 'Task', icon: CheckSquare, description: 'Add a new task' },
  { value: 'record', label: 'Record', icon: Save, description: 'Create a data record' },
  { value: 'document', label: 'Document', icon: FileText, description: 'Write a document' },
  { value: 'file', label: 'File', icon: File, description: 'Upload a file' },
  { value: 'activity', label: 'Activity', icon: Zap, description: 'Log an activity' },
  { value: 'discussion', label: 'Discussion', icon: MessageCircle, description: 'Start a discussion' },
  { value: 'collection', label: 'Collection', icon: Library, description: 'Create a collection' },
];

interface QuickCreateFormData {
  name: string;
  description?: string;
  status: string;
  world_id?: string; // For projects and documents
  [key: string]: any;
}

export const QuickEntityCreate = observer(function QuickEntityCreate() {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<QuickCreateFormData>({
    name: '',
    description: '',
    status: 'active',
  });
  
  const { currentOrganization } = useAuth();
  const schema = use$(orgContext$.schema);
  
  // Get entities grouped by archetype
  const entitiesByArchetype = React.useMemo(() => {
    if (!schema?.entities) return {};
    
    const grouped: Record<string, Array<{ name: string; tableName: string }>> = {};
    
    Object.entries(schema.entities).forEach(([entityName, entitySchema]) => {
      const archetype = entitySchema.archetype || 'record';
      if (!grouped[archetype]) {
        grouped[archetype] = [];
      }
      grouped[archetype].push({
        name: entityName,
        tableName: entitySchema.tableName,
      });
    });
    
    return grouped;
  }, [schema]);

  const handleEntitySelect = (entityName: string) => {
    setSelectedEntity(entityName);
    setDialogOpen(true);
    // Reset form
    setFormData({
      name: '',
      description: '',
      status: 'active',
      world_id: '',
    });
  };

  const handleSubmit = async () => {
    if (!selectedEntity || !formData.name) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      // Get the entity store
      const entityStore = getEntity$(selectedEntity);
      
      // Generate a proper UUID
      const id = crypto.randomUUID();
      
      // Create the new record
      const newRecord = {
        id,
        ...formData,
        organization_id: currentOrganization?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false,
      };
      
      // Add to store (this will sync to backend)
      entityStore[id].set(newRecord);
      
      toast.success(`Created new ${selectedEntity}`);
      
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to create entity:', error);
      toast.error('Failed to create entity');
    } finally {
      setLoading(false);
    }
  };

  // Get the selected entity's schema
  const selectedEntitySchema = selectedEntity 
    ? schema?.entities?.[selectedEntity]
    : null;

  // Check if the selected entity supports world selection
  const needsWorldSelection = selectedEntity && 
    (selectedEntitySchema?.archetype === 'project' || selectedEntitySchema?.archetype === 'document');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="default">
            <Plus className="mr-2 h-4 w-4" />
            New Entity
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Create New Entity</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {ARCHETYPES.map((archetype) => {
            const entities = entitiesByArchetype[archetype.value] || [];
            const Icon = archetype.icon;
            
            if (entities.length === 0) {
              return (
                <DropdownMenuItem
                  key={archetype.value}
                  disabled
                  className="opacity-50"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{archetype.label}</div>
                    <div className="text-xs text-muted-foreground">No entities configured</div>
                  </div>
                </DropdownMenuItem>
              );
            }
            
            return (
              <div key={archetype.value}>
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center">
                  <Icon className="mr-2 h-4 w-4" />
                  {archetype.label}
                </div>
                {entities.map((entity) => (
                  <DropdownMenuItem
                    key={entity.name}
                    onClick={() => handleEntitySelect(entity.name)}
                    className="pl-8"
                  >
                    {entity.name}
                  </DropdownMenuItem>
                ))}
              </div>
            );
          })}
          
          {Object.keys(entitiesByArchetype).length === 0 && (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No entities configured yet
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New {selectedEntity}</DialogTitle>
            <DialogDescription>
              Fill in the details for your new {selectedEntity?.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Enter ${selectedEntity?.toLowerCase()} name`}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* World Selection for Projects and Documents */}
            {needsWorldSelection && (
              <WorldSelector
                label="World (Optional)"
                value={formData.world_id}
                onValueChange={(worldId) => setFormData({ ...formData, world_id: worldId })}
                placeholder="Select a world to organize this..."
                showPersonalWorlds={true}
                showOrganizationalWorlds={true}
              />
            )}
            
            {/* Add custom fields based on entity schema here */}
            {selectedEntitySchema?.fields && (
              <div className="text-xs text-muted-foreground">
                Additional fields: {Object.keys(selectedEntitySchema.fields).length}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !formData.name}
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});