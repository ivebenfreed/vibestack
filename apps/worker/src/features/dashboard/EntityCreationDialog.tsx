import { useState } from 'react'
import { observer } from '@legendapp/state/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/state-machines'
import { useOrgAbility, useOrgTrialStatus } from '@/contexts/AbilityContext'
// Temporarily commented out - no longer using this pattern
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface EntityCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Available archetypes for entity types (DataForge 8 core archetypes)
const ARCHETYPES = [
  { value: 'project', label: 'Project', icon: '📁', description: 'Manages projects and initiatives' },
  { value: 'task', label: 'Task', icon: '✅', description: 'Individual work items and actions' },
  { value: 'record', label: 'Record', icon: '💾', description: 'Structured data entities' },
  { value: 'document', label: 'Document', icon: '📄', description: 'Text documents and notes' },
  { value: 'file', label: 'File', icon: '📎', description: 'File storage and assets' },
  { value: 'activity', label: 'Activity', icon: '⚡', description: 'Events and activity tracking' },
  { value: 'discussion', label: 'Discussion', icon: '💬', description: 'Conversations and threads' },
  { value: 'collection', label: 'Collection', icon: '📚', description: 'Groups of related items' },
]

// Default fields for each archetype (excluding base fields like 'name' which are already included)
const ARCHETYPE_DEFAULT_FIELDS: Record<string, Array<{ name: string; type: string; required?: boolean }>> = {
  'project': [
    // 'name' is already in base, don't include it
    { name: 'description', type: 'longtext' },
    { name: 'start_date', type: 'date' },
    { name: 'end_date', type: 'date' },
  ],
  'task': [
    // 'name' is already in base
    { name: 'description', type: 'longtext' },
    { name: 'priority', type: 'priority_option' },
    { name: 'due_date', type: 'date' },
  ],
  'document': [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'longtext' },
    { name: 'file_type', type: 'text' },
    { name: 'file_url', type: 'url' },
    { name: 'version', type: 'text' },
  ],
  'file': [
    // 'name' is already in base
    { name: 'path', type: 'text' },
    { name: 'size', type: 'integer' },
    { name: 'mime_type', type: 'text' },
  ],
  'discussion': [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'rich_text', required: true },
  ],
  'record': [
    // 'name' is already in base, only add description
    { name: 'description', type: 'longtext' },
  ],
  'activity': [
    // 'name' is already in base
    { name: 'description', type: 'longtext' },
    { name: 'start_time', type: 'datetime' },
    { name: 'end_time', type: 'datetime' },
  ],
  'collection': [
    // 'name' is already in base
    { name: 'description', type: 'longtext' },
    { name: 'collection_type', type: 'text', required: true },
  ],
}

export const EntityCreationDialog = observer(function EntityCreationDialog({ 
  open, 
  onOpenChange 
}: EntityCreationDialogProps) {
  const [entityName, setEntityName] = useState<string>('')
  const [selectedArchetype, setSelectedArchetype] = useState<string>('')
  const [creating, setCreating] = useState(false)
  
  const { currentOrganization } = useAuth()
  const orgAbility = useOrgAbility(currentOrganization)
  const orgTrialStatus = useOrgTrialStatus(currentOrganization)
  
  const handleArchetypeChange = (archetype: string) => {
    setSelectedArchetype(archetype)
  }
  
  const handleCreate = async () => {
    if (!entityName || !selectedArchetype || !currentOrganization) return
    
    // Check if user can create entities for this organization
    if (!orgAbility.can('create', 'entity') || !orgTrialStatus.canCreateEntities) {
      if (orgTrialStatus.isExpired) {
        toast.error('Trial Expired', {
          description: `Your trial for ${currentOrganization.name} has expired. Please upgrade to continue creating entities.`,
          action: {
            label: 'Upgrade',
            onClick: () => {
              // Navigate to billing page
              window.location.href = '/settings/billing';
            }
          }
        })
      } else {
        toast.error('Access Denied', {
          description: 'You do not have permission to create entities in this organization.'
        })
      }
      return
    }
    
    // Validate entity name
    if (!entityName.match(/^[A-Z][a-zA-Z0-9]*$/)) {
      toast.error('Invalid Entity Name', {
        description: 'Entity name must start with a capital letter and contain only letters and numbers'
      })
      return
    }
    
    setCreating(true)
    
    try {
      // Get default fields for the archetype
      const defaultFields = ARCHETYPE_DEFAULT_FIELDS[selectedArchetype] || ARCHETYPE_DEFAULT_FIELDS['record']
      
      // Build the entity definition with fields as an array
      const definition = {
        archetype: selectedArchetype,
        fields: defaultFields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required || false,
          syncable: true
        }))
      }
      
      // Create entity schema data that matches the entity_schemas table structure
      const entitySchemaData = {
        entity_name: entityName,
        org_id: currentOrganization.id,
        archetype: selectedArchetype,
        table_name: `${currentOrganization.id}_${entityName.toLowerCase()}`,
        definition: definition,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false
      }
      
      // Make API call to create entity
      const response = await fetch(`/api/dataforge/orgs/${currentOrganization.id}/entities`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityName: entityName,
          archetype: selectedArchetype,
          customFields: definition.fields
        })
      })
      
      // Check for 402 (trial expired)
      if (response.status === 402) {
        // The global interceptor will handle showing the toast and redirecting
        // Just close the dialog
        onOpenChange(false)
        return
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.message || 'Failed to create entity type')
      }
      
      const result = await response.json()
      
      toast.success('Entity Type Created', {
        description: `Successfully created new entity type: ${entityName}`
      })
      
      // Reset form and close dialog
      setEntityName('')
      setSelectedArchetype('')
      onOpenChange(false)
      
    } catch (error) {
      toast.error('Creation Failed', {
        description: error instanceof Error ? error.message : 'Failed to create entity type'
      })
    } finally {
      setCreating(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New Entity Type</DialogTitle>
          <DialogDescription>
            Define a new entity type that will be available in your organization.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entity-name" className="text-right">
              Entity Name
            </Label>
            <Input
              id="entity-name"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Employee, Department, Product"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="archetype" className="text-right">
              Base Type
            </Label>
            <Select value={selectedArchetype} onValueChange={handleArchetypeChange}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a base type" />
              </SelectTrigger>
              <SelectContent>
                {ARCHETYPES.map(archetype => (
                  <SelectItem key={archetype.value} value={archetype.value}>
                    <div className="flex items-center gap-2">
                      <span>{archetype.icon}</span>
                      <div>
                        <div className="font-medium">{archetype.label}</div>
                        <div className="text-xs text-muted-foreground">{archetype.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedArchetype && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Default fields for {ARCHETYPES.find(a => a.value === selectedArchetype)?.label}:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• name (text) - Required (included in all entity types)</li>
                <li>• status (text) - Default: 'active'</li>
                {ARCHETYPE_DEFAULT_FIELDS[selectedArchetype]?.map(field => (
                  <li key={field.name}>
                    • {field.name} ({field.type.replace('_', ' ')}){field.required && ' - Required'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!entityName || !selectedArchetype || creating}
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Entity Type'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})