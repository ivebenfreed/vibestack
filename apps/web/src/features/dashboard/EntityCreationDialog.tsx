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
import { orgData$, switchToOrganization } from '@/stores/org-data-store'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface EntityCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Available archetypes for entity types
const ARCHETYPES = [
  { value: 'project', label: 'Project-based Entity' },
  { value: 'task', label: 'Task-based Entity' },
  { value: 'document', label: 'Document-based Entity' },
  { value: 'file', label: 'File-based Entity' },
  { value: 'discussion', label: 'Discussion-based Entity' },
  { value: 'record', label: 'Generic Record Entity' },
  { value: 'activity', label: 'Activity-based Entity' },
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
}

export const EntityCreationDialog = observer(function EntityCreationDialog({ 
  open, 
  onOpenChange 
}: EntityCreationDialogProps) {
  const [entityName, setEntityName] = useState<string>('')
  const [selectedArchetype, setSelectedArchetype] = useState<string>('')
  const [creating, setCreating] = useState(false)
  
  const currentOrgId = orgData$.currentOrgId.get()
  
  const handleArchetypeChange = (archetype: string) => {
    setSelectedArchetype(archetype)
  }
  
  const handleCreate = async () => {
    if (!entityName || !selectedArchetype || !currentOrgId) return
    
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
      
      const response = await fetch(`/api/archetype/orgs/${currentOrgId}/entities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          entityName,
          definition
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to create entity type')
      }
      
      const result = await response.json()
      
      toast.success('Entity Type Created', {
        description: `Successfully created new entity type: ${entityName}`
      })
      
      // Reload the schema to show the new entity type
      await switchToOrganization(currentOrgId)
      
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
                    {archetype.label}
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