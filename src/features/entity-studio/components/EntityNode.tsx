/**
 * EntityNode Component
 * Visual node representation of an entity with fields and metadata
 */

import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import type { EntityNodeData } from '../types'
import { getArchetypeColor, getFieldTypeIcon } from '../lib/visual-config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const EntityNode = memo(({ data }: { data: EntityNodeData }) => {
  const [expanded, setExpanded] = useState(false)

  // Group fields by category
  const standardFields = data.fields.filter(f => !f.capabilities?.isCalculatedField && !f.relationship)
  const relationshipFields = data.relationshipFields || []
  const calculatedFields = data.fields.filter(f => f.capabilities?.isCalculatedField)

  const archetypeColor = getArchetypeColor(data.archetype)

  return (
    <div
      className="bg-card border-2 rounded-lg shadow-lg min-w-[280px] max-w-[400px]"
      style={{ borderColor: archetypeColor }}
    >
      {/* Connection handles - reversed for upward hierarchy */}
      <Handle type="source" position={Position.Top} className="w-3 h-3" />
      <Handle type="target" position={Position.Bottom} className="w-3 h-3" />

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between rounded-t-lg"
        style={{ backgroundColor: archetypeColor }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-bold text-white truncate">{data.entityName}</span>
          <Badge variant="secondary" className="shrink-0 bg-white/20 text-white border-white/30">
            {data.metadata.fieldCount}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
          className="h-6 w-6 p-0 text-white hover:bg-white/20 shrink-0"
        >
          {expanded ? '−' : '+'}
        </Button>
      </div>

      {/* Archetype badge */}
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground capitalize">{data.archetype}</span>
      </div>

      {/* Field List (when expanded) */}
      {expanded && (
        <div className="px-4 py-2 max-h-[500px] overflow-y-auto">
          {/* Standard Fields */}
          {standardFields.length > 0 && (
            <div className="space-y-1 mb-3">
              {standardFields.map((field) => (
                <FieldRow key={field.name} field={field} />
              ))}
            </div>
          )}

          {/* Relationship Fields */}
          {relationshipFields.length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Relationships</div>
              {relationshipFields.map((field) => (
                <div key={field.name} className="flex items-center gap-2 py-1 text-sm pl-2">
                  <span className="text-blue-600">🔗</span>
                  <span className="truncate">{field.name}</span>
                  <span className="text-xs text-blue-600">→ {field.targetEntityType}</span>
                </div>
              ))}
            </div>
          )}

          {/* Calculated Fields */}
          {calculatedFields.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Calculated</div>
              {calculatedFields.map((field) => (
                <FieldRow key={field.name} field={field} isCalculated />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex gap-3 text-xs text-muted-foreground rounded-b-lg">
        <span>🔗 {data.metadata.relationshipCount}</span>
        {data.metadata.recordCount !== undefined && (
          <span>📊 {data.metadata.recordCount}</span>
        )}
      </div>
    </div>
  )
})

EntityNode.displayName = 'EntityNode'

function FieldRow({ field, isCalculated }: { field: any; isCalculated?: boolean }) {
  const icon = getFieldTypeIcon(field.type)
  const hasDefault = field.defaultValue !== undefined && field.defaultValue !== null
  const readableType = formatFieldType(field.type)

  return (
    <div className="flex items-center gap-1.5 py-1 text-xs pl-2">
      <span className="text-xs opacity-60">{icon}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className={`truncate ${field.required ? 'font-semibold' : ''}`}>
          {field.display?.label || field.name}
        </span>
        <span className="text-[10px] text-muted-foreground opacity-70">
          ({readableType})
        </span>
      </div>
      {field.required && <span className="text-red-500 text-xs shrink-0">*</span>}
      {hasDefault && (
        <span className="text-xs text-muted-foreground shrink-0">
          = {formatDefaultValue(field.defaultValue)}
        </span>
      )}
      {isCalculated && (
        <Badge variant="outline" className="text-xs px-1 py-0 h-4 shrink-0">calc</Badge>
      )}
    </div>
  )
}

function formatFieldType(type: string): string {
  const typeMap: Record<string, string> = {
    'text': 'Text',
    'longtext': 'Long Text',
    'rich_text': 'Rich Text',
    'textarea': 'Text Area',
    'markdown': 'Markdown',
    'number': 'Number',
    'integer': 'Integer',
    'decimal': 'Decimal',
    'percentage': 'Percent',
    'currency': 'Currency',
    'boolean': 'Yes/No',
    'date': 'Date',
    'datetime': 'Date/Time',
    'datetime-local': 'Date/Time',
    'time': 'Time',
    'email': 'Email',
    'url': 'URL',
    'phone': 'Phone',
    'color': 'Color',
    'rating': 'Rating',
    'slider': 'Slider',
    'image': 'Image',
    'file': 'File',
    'address': 'Address',
    'coordinates': 'Location',
    'single-select': 'Dropdown',
    'multi-select': 'Multi Select',
    'status': 'Status',
    'status_set': 'Status',
    'custom_option_reference': 'Option',
    'custom_user_reference': 'User Ref',
    'custom_entity_reference': 'Entity Ref',
    'user_reference': 'User Ref',
    'entity_reference': 'Entity Ref',
    'rollup_count': 'Count',
    'rollup_sum': 'Sum',
    'rollup_average': 'Average',
    'rollup_concat': 'Concat',
    'computed_expression': 'Formula',
    'computed_formula': 'Formula',
    'json': 'JSON'
  }
  return typeMap[type] || type
}

function formatDefaultValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return `"${value.slice(0, 15)}${value.length > 15 ? '...' : ''}"`
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return '[]'
  if (typeof value === 'object') return '{}'
  return String(value)
}
