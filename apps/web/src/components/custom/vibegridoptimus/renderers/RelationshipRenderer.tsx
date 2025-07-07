import React from 'react'
import { CSS_CLASSES } from '../utils/constants'

interface RelationshipRendererProps {
  value: any
  config?: {
    relationshipType?: string
    displayField?: string
    options?: Array<{ value: string; label: string }>
  }
  cellType: 'relationship-single' | 'relationship-multi' | 'relationship-collection'
  onContentClick?: (event: React.MouseEvent) => void
  relationshipResolver?: any
  column?: any
}

/**
 * Pure relationship display renderer
 * Shows relationship data as badges with proper empty states
 */
export function RelationshipRenderer({ 
  value, 
  config, 
  cellType,
  onContentClick,
  relationshipResolver,
  column
}: RelationshipRendererProps): React.ReactNode {
  const displayField = config?.displayField || 'name'
  
  switch (cellType) {
    case 'relationship-single':
      return renderSingleRelationship(value, displayField, config, onContentClick, relationshipResolver, column)
      
    case 'relationship-multi':
      return renderMultiRelationship(value, displayField, config, onContentClick, relationshipResolver, column)
      
    case 'relationship-collection':
      return renderCollectionRelationship(value, displayField, config, onContentClick, relationshipResolver, column)
      
    default:
      return <span className={CSS_CLASSES.mutedText}>—</span>
  }
}

/**
 * Render a single relationship (many-to-one, one-to-one)
 */
function renderSingleRelationship(
  value: any, 
  displayField: string, 
  config?: RelationshipRendererProps['config'],
  onContentClick?: (event: React.MouseEvent) => void,
  relationshipResolver?: any,
  column?: any
): React.ReactNode {
  // Show "Add owner" for empty values
  if (!value) {
    return (
      <div 
        className={`${CSS_CLASSES.emptyState} ${onContentClick ? CSS_CLASSES.cellHover : ''}`}
        onClick={onContentClick}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span className="text-xs">Add owner</span>
      </div>
    )
  }
  
  // PERFORMANCE: Use relationship resolver for efficient single-value lookup
  if (relationshipResolver && value && typeof value === 'string') {
    const targetEntity = config?.targetEntity?.toLowerCase() || 
      (column?.key === 'owner' || column?.key === 'assignee' || column?.key === 'author' ? 'user' :
       column?.key === 'project' || column?.key === 'projectId' ? 'project' :
       column?.key === 'task' || column?.key === 'taskId' ? 'task' : null)
    
    let resolved = null
    if (targetEntity === 'project') {
      resolved = relationshipResolver.getProject(value)
    } else if (targetEntity === 'user') {
      resolved = relationshipResolver.getUser(value)
    } else if (targetEntity === 'task') {
      resolved = relationshipResolver.getTask(value)
    }
    
    if (resolved) {
      return (
        <span 
          className={`${CSS_CLASSES.badge} ${CSS_CLASSES.primaryBadge} ${onContentClick ? CSS_CLASSES.cellHoverOpacity : ''}`}
          onClick={onContentClick}
        >
          {resolved.label}
        </span>
      )
    }
  }
  
  // If value is an object with display field
  if (typeof value === 'object' && value?.[displayField]) {
    return (
      <span 
        className={`${CSS_CLASSES.badge} ${CSS_CLASSES.primaryBadge} ${onContentClick ? CSS_CLASSES.cellHoverOpacity : ''}`}
        onClick={onContentClick}
      >
        {value[displayField]}
      </span>
    )
  }
  
  // If value is a foreign key (string/number)
  if (value && (typeof value === 'string' || typeof value === 'number')) {
    return (
      <span className="text-sm text-muted-foreground font-mono" title={`ID: ${value}`}>
        {String(value).slice(0, 8)}...
      </span>
    )
  }
  
  return <span className={CSS_CLASSES.mutedText}>—</span>
}

/**
 * Render multiple relationships (many-to-many)
 */
function renderMultiRelationship(
  value: any[], 
  displayField: string, 
  config?: RelationshipRendererProps['config'],
  onContentClick?: (event: React.MouseEvent) => void
): React.ReactNode {
  // Show "Select members" for empty values
  if (!Array.isArray(value) || value.length === 0) {
    return (
      <div 
        className={`${CSS_CLASSES.emptyState} ${onContentClick ? CSS_CLASSES.cellHover : ''}`}
        onClick={onContentClick}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span className="text-xs">Select members</span>
      </div>
    )
  }
  
  // Show first few items with count
  const displayItems = value.slice(0, 2)
  const remainingCount = value.length - displayItems.length
  
  return (
    <div 
      className={`flex flex-wrap gap-1 ${onContentClick ? 'cursor-pointer' : ''}`}
      onClick={onContentClick}
    >
      {displayItems.map((item, index) => {
        let displayText = String(item)
        
        // If we have options, use the label from options
        if (config?.options) {
          const itemId = typeof item === 'object' ? item.id : String(item)
          const option = config.options.find((opt: any) => opt.value === itemId)
          if (option) {
            displayText = option.label
          }
        } else if (typeof item === 'object') {
          displayText = item[displayField] || item.id
        }
        
        return (
          <span 
            key={index}
            className={`${CSS_CLASSES.badge} ${CSS_CLASSES.primaryBadge} ${CSS_CLASSES.cellHoverOpacity}`}
          >
            {displayText}
          </span>
        )
      })}
      {remainingCount > 0 && (
        <span 
          className={`${CSS_CLASSES.badge} bg-muted text-muted-foreground border-border ${CSS_CLASSES.cellHoverOpacity}`}
          title={`${value.length} total members`}
        >
          ⋯ +{remainingCount} more
        </span>  
      )}
    </div>
  )
}

/**
 * Render relationship collection (one-to-many)
 */
function renderCollectionRelationship(
  value: any[], 
  displayField: string, 
  config?: RelationshipRendererProps['config'],
  onContentClick?: (event: React.MouseEvent) => void
): React.ReactNode {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className={CSS_CLASSES.mutedText}>Empty</span>
  }
  
  // Show count for collections
  return (
    <span 
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 ${onContentClick ? CSS_CLASSES.cellHoverOpacity : ''}`}
      onClick={onContentClick}
    >
      {value.length} {value.length === 1 ? 'item' : 'items'}
    </span>
  )
}