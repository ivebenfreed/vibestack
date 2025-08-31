import {
  IconChecklist,
  IconFolder,
  IconUsers,
  IconCalendar,
  IconTag,
  IconShield,
  IconBuilding,
  IconCoin,
  IconClipboardList,
  IconUserCog,
  IconBriefcase,
  IconFileText,
} from '@tabler/icons-react'
import type { NavGroup, NavItem } from '../types'
import type { EntitySchema } from '@/lib/schema-client'

const ENTITY_ICONS: Record<string, any> = {
  'Task': IconChecklist,
  'Project': IconFolder,
  'User': IconUsers,
  'Event': IconCalendar,
  'Tag': IconTag,
  'TagSet': IconTag,
  'Role': IconShield,
  'Organization': IconBuilding,
  'Transaction': IconCoin,
  'StatusDefinition': IconClipboardList,
  'UserRole': IconUserCog,
  'ProjectTask': IconBriefcase,
  'Comment': IconFileText,
  'EntityDependency': IconFileText,
  'TaskDependency': IconFileText,
}

function getEntityIcon(entityName: string) {
  return ENTITY_ICONS[entityName] || IconFileText
}

function getArchetypeCategory(archetype: string): string {
  switch (archetype) {
    case 'business_entity':
      return 'Business Entities'
    case 'relationship_entity':
      return 'Relationships'
    case 'config_entity':
      return 'Configuration'
    case 'system_entity':
      return 'System'
    default:
      return 'Other Entities'
  }
}

export function generateDynamicSidebarData(schema: EntitySchema | null): NavGroup[] {
  if (!schema || !schema.entities) {
    return [
      {
        title: 'Loading...',
        items: [
          {
            title: 'Loading organization schema...',
            url: '/',
            icon: IconFileText,
          }
        ]
      }
    ]
  }
  
  const entityEntries = Object.entries(schema.entities)
  
  if (entityEntries.length === 0) {
    return [
      {
        title: 'No Entities',
        items: [
          {
            title: 'No entities found',
            url: '/',
            icon: IconFileText,
          }
        ]
      }
    ]
  }
  
  const entitiesByArchetype = new Map<string, Array<[string, any]>>()
  
  entityEntries.forEach(([entityName, entityDef]) => {
    const category = getArchetypeCategory(entityDef.archetype || 'unknown')
    
    if (!entitiesByArchetype.has(category)) {
      entitiesByArchetype.set(category, [])
    }
    
    entitiesByArchetype.get(category)!.push([entityName, entityDef])
  })
  
  const navGroups: NavGroup[] = []
  
  for (const [category, entities] of entitiesByArchetype) {
    const navItems: NavItem[] = entities.map(([entityName, entityDef]) => ({
      title: entityName,
      url: `/entities/${entityName}`,
      icon: getEntityIcon(entityName),
    }))
    
    navGroups.push({
      title: category,
      items: navItems
    })
  }
  
  navGroups.sort((a, b) => {
    const order = ['Business Entities', 'Relationships', 'Configuration', 'System', 'Other Entities']
    return order.indexOf(a.title) - order.indexOf(b.title)
  })
  
  return navGroups
}

export function shouldHideBusinessRoutes(): boolean {
  return true
}