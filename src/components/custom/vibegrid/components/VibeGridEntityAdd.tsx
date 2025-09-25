import React, { useState, useMemo } from 'react';
import { observer } from '@legendapp/state/react';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { entityOperations } from '@/legend-state';
import { EntityNameUtils } from '@/lib/entity-name-utils';
import { useSystemOptions } from '@/legend-state/reference-system/hooks';
import type { TableCore$ } from '../stores/data-state';
import type { createVibeGridVisualState } from '../stores/visual-state';

interface VibeGridEntityAddProps {
  tableCore$: TableCore$;
  visualState: ReturnType<typeof createVibeGridVisualState>;
  entityName: string;
  orgId?: string;
  className?: string;
}

interface FieldValue {
  value: any;
  isValid: boolean;
  error?: string;
}

export const VibeGridEntityAdd = observer(function VibeGridEntityAdd({
  tableCore$,
  visualState,
  entityName,
  orgId,
  className = ''
}: VibeGridEntityAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, FieldValue>>({});

  // Get reactive data from observables
  const columns = tableCore$.columns.get();
  const schema = tableCore$.schema.get();


  // Extract display name for UI
  const displayName = entityName ? EntityNameUtils.toDisplayFormat(entityName) : 'Entity';

  // Get form fields from columns (excluding system columns)
  const formFields = useMemo(() => {
    if (!columns || !Array.isArray(columns)) return [];

    return columns.filter(column => {
      const isValidColumn = column && column.id;
      const isSystemField = ['id', 'created_at', 'updated_at', 'organization_id'].includes(column.id);
      return isValidColumn && !isSystemField;
    });
  }, [columns]);

  // Initialize form data when dialog opens
  React.useEffect(() => {
    if (isOpen && formFields.length > 0) {
      const initialData: Record<string, FieldValue> = {};
      formFields.forEach(field => {
        const isRequired = field.required || field.fieldSchema?.required || field.id === 'name';
        initialData[field.id] = {
          value: field.type === 'boolean' ? false : '',
          isValid: !isRequired,
          error: undefined
        };
      });
      setFormData(initialData);
    }
  }, [isOpen, formFields]);

  const validateField = (fieldId: string, value: any, field: any): { isValid: boolean; error?: string } => {
    if (!field) return { isValid: true };

    // Required field validation
    const isRequired = field.required || field.fieldSchema?.required || fieldId === 'name';
    if (isRequired && (value === '' || value === null || value === undefined)) {
      const fieldName = field.label || field.id || fieldId;
      return { isValid: false, error: `${fieldName} is required` };
    }

    // Email validation
    if (field.type === 'email' && value && typeof value === 'string' && !value.includes('@')) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }

    // Number validation
    if ((field.type === 'number' || field.type === 'integer') && value !== '' && value !== null) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) {
        return { isValid: false, error: 'Please enter a valid number' };
      }
    }

    return { isValid: true };
  };

  const updateFieldValue = (fieldId: string, newValue: any) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field) return;

    const validation = validateField(fieldId, newValue, field);

    setFormData(prev => ({
      ...prev,
      [fieldId]: {
        value: newValue,
        isValid: validation.isValid,
        error: validation.error
      }
    }));
  };

  const isFormValid = useMemo(() => {
    console.log('🔍 [VibeGridEntityAdd] Form validation check:', {
      formData,
      allFields: Object.keys(formData),
      invalidFields: Object.entries(formData).filter(([key, field]) => !field.isValid).map(([key]) => key),
      isValid: Object.values(formData).every(field => field.isValid)
    });
    return Object.values(formData).every(field => field.isValid);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Force validation on all fields before submit
    const validationErrors: string[] = [];
    Object.entries(formData).forEach(([fieldId, fieldValue]) => {
      const field = formFields.find(f => f.id === fieldId);
      if (field) {
        const validation = validateField(fieldId, fieldValue.value, field);
        if (!validation.isValid) {
          validationErrors.push(validation.error || `${fieldId} is invalid`);
        }
      }
    });

    if (validationErrors.length > 0) {
      console.log('🚨 [VibeGridEntityAdd] Validation errors:', validationErrors);
      alert(`Please fix the following errors:\n${validationErrors.join('\n')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare entity data
      const now = new Date().toISOString();
      const entityData: Record<string, any> = {
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        organization_id: orgId
      };

      // Add form field values
      Object.entries(formData).forEach(([key, field]) => {
        if (field.value !== '' && field.value !== null) {
          entityData[key] = field.value;
        }
      });

      // Add default status and priority if fields exist in schema
      const schemaFields = schema?.fields || {};
      if (schemaFields.status && !entityData.status) {
        entityData.status = 'draft';
      }
      if (schemaFields.priority && !entityData.priority) {
        entityData.priority = 'medium';
      }

      // Ensure proper entity name prefixing
      const fullEntityName = EntityNameUtils.ensureOrgPrefix(entityName || 'Entity', orgId || '');

      console.log('🚀 [VibeGridEntityAdd] Creating entity:', {
        entityName: fullEntityName,
        data: entityData
      });

      // Create the entity
      await entityOperations.createEntity(fullEntityName, entityData);

      console.log('✅ [VibeGridEntityAdd] Entity created successfully');

      // Reset form and close dialog
      setFormData({});
      setIsOpen(false);
    } catch (error) {
      console.error('❌ [VibeGridEntityAdd] Error creating entity:', error);
      // You could add a toast notification here
      alert(`Error creating ${displayName}: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: any) => {
    const fieldValue = formData[field.id];
    if (!fieldValue) return null;

    const containerClassName = `space-y-2 ${!fieldValue.isValid ? 'border-red-500' : ''}`;
    const fieldLabel = field.label || field.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <div key={field.id} className={containerClassName}>
        <Label htmlFor={field.id} className="text-sm font-medium">
          {fieldLabel}
          {(field.required || field.fieldSchema?.required || field.id === 'name') && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </Label>

        {(() => {
          // Check if this is a select field based on actual field data
          const isSelectField = field.type === 'status' ||
                               field.type === 'single-select' ||
                               field.cellType === 'select' ||
                               field.cellType === 'single-select' ||
                               field.referenceType?.includes('_option') ||
                               field.systemOptionType;

          if (isSelectField) {
            // For select fields, we need to provide some common options based on the field
            const getOptionsForField = (fieldId: string, fieldType: string) => {
              const lowerFieldId = fieldId.toLowerCase();

              if (lowerFieldId.includes('status')) {
                return ['draft', 'active', 'inactive', 'pending', 'archived'];
              } else if (lowerFieldId.includes('industry')) {
                return ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Government'];
              } else if (lowerFieldId.includes('size')) {
                return ['Startup', 'Small', 'Medium', 'Large', 'Enterprise'];
              } else if (lowerFieldId.includes('tier')) {
                return ['Bronze', 'Silver', 'Gold', 'Platinum'];
              } else if (lowerFieldId.includes('priority')) {
                return ['low', 'medium', 'high', 'urgent'];
              }
              return [];
            };

            const options = getOptionsForField(field.id, field.type);

            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {fieldValue.value
                      ? options.find(option => option === fieldValue.value)?.charAt(0).toUpperCase() + options.find(option => option === fieldValue.value)?.slice(1)
                      : `Select ${fieldLabel.toLowerCase()}...`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder={`Search ${fieldLabel.toLowerCase()}...`} />
                    <CommandList>
                      <CommandEmpty>No {fieldLabel.toLowerCase()} found.</CommandEmpty>
                      <CommandGroup>
                        {options.map(option => (
                          <CommandItem
                            key={option}
                            value={option}
                            onSelect={() => updateFieldValue(field.id, option)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                fieldValue.value === option ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            );
          }

          switch (field.type) {
            case 'number':
            case 'integer':
              return (
                <Input
                  id={field.id}
                  type="number"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value ? Number(e.target.value) : '')}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                />
              );

            case 'currency':
              return (
                <Input
                  id={field.id}
                  type="number"
                  step="0.01"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value ? Number(e.target.value) : '')}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                />
              );

            case 'boolean':
              return (
                <div className="flex items-center space-x-2">
                  <input
                    id={field.id}
                    type="checkbox"
                    checked={fieldValue.value || false}
                    onChange={(e) => updateFieldValue(field.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={field.id} className="text-sm text-muted-foreground">
                    {field.description || `Enable ${fieldLabel.toLowerCase()}`}
                  </Label>
                </div>
              );

            case 'date':
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id={field.id}
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fieldValue.value ? format(new Date(fieldValue.value), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fieldValue.value ? new Date(fieldValue.value) : undefined}
                      onSelect={(date) => updateFieldValue(field.id, date?.toISOString().split('T')[0] || '')}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              );

            case 'email':
              return (
                <Input
                  id={field.id}
                  type="email"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                />
              );

            case 'url':
              return (
                <Input
                  id={field.id}
                  type="url"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                />
              );

            case 'phone':
              return (
                <Input
                  id={field.id}
                  type="tel"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                />
              );

            case 'rating':
              return (
                <Input
                  id={field.id}
                  type="number"
                  min="1"
                  max="5"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value ? Number(e.target.value) : '')}
                  placeholder="1-5 rating"
                />
              );

            case 'address':
              return (
                <Textarea
                  id={field.id}
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                  className="min-h-[80px]"
                />
              );

            default:
              // Detect field types from field ID patterns
              const lowerFieldId = field.id.toLowerCase();

              if (lowerFieldId.includes('email')) {
                return (
                  <Input
                    id={field.id}
                    type="email"
                    value={fieldValue.value}
                    onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                  />
                );
              }

              if (lowerFieldId.includes('url') || lowerFieldId.includes('website')) {
                return (
                  <Input
                    id={field.id}
                    type="url"
                    value={fieldValue.value}
                    onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                  />
                );
              }

              if (lowerFieldId.includes('phone')) {
                return (
                  <Input
                    id={field.id}
                    type="tel"
                    value={fieldValue.value}
                    onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                  />
                );
              }

              // For text fields, use textarea for longer content
              const isLongText = lowerFieldId.includes('description') ||
                               lowerFieldId.includes('notes') ||
                               lowerFieldId.includes('content') ||
                               lowerFieldId.includes('address');

              return isLongText ? (
                <Textarea
                  id={field.id}
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                  className="min-h-[80px]"
                />
              ) : (
                <Input
                  id={field.id}
                  type="text"
                  value={fieldValue.value}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                  placeholder={field.description || `Enter ${fieldLabel.toLowerCase()}`}
                />
              );
          }
        })()}

        {fieldValue.error && (
          <p className="text-xs text-red-500">{fieldValue.error}</p>
        )}

        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={`h-7 px-2 text-xs ${className}`}>
          <Plus className="h-3 w-3 mr-1" />
          Add {displayName}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New {displayName}</DialogTitle>
          <DialogDescription>
            Create a new {displayName.toLowerCase()} record using the same field editors as the table.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {formFields.length > 0 ? (
              formFields.map(renderField)
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading form fields...</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting ? 'Creating...' : `Create ${displayName}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});