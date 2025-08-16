// Mock database - shared in-memory storage
// In a real app, this would be replaced with actual database calls

export interface Entity {
  id: number;
  name: string;
  type: string;
  description: string;
  fields: Array<{
    name: string;
    type: string;
    primary?: boolean;
    required?: boolean;
    default?: any;
  }>;
  createdAt: string;
  updatedAt: string;
}

// In-memory database
const database = {
  entities: [
    {
      id: 1,
      name: 'Users',
      type: 'table',
      description: 'User account information',
      fields: [
        { name: 'id', type: 'integer', primary: true },
        { name: 'email', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'created_at', type: 'datetime', required: true }
      ],
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    },
    {
      id: 2,
      name: 'Projects',
      type: 'table',
      description: 'Project management data',
      fields: [
        { name: 'id', type: 'integer', primary: true },
        { name: 'name', type: 'string', required: true },
        { name: 'status', type: 'string', required: true },
        { name: 'progress', type: 'integer', required: false },
        { name: 'due_date', type: 'date', required: false }
      ],
      createdAt: '2024-01-15T11:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z'
    },
    {
      id: 3,
      name: 'Tasks',
      type: 'table',
      description: 'Task tracking and management',
      fields: [
        { name: 'id', type: 'integer', primary: true },
        { name: 'title', type: 'string', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'project_id', type: 'integer', required: true },
        { name: 'assignee_id', type: 'integer', required: false },
        { name: 'completed', type: 'boolean', required: true, default: false }
      ],
      createdAt: '2024-01-15T11:15:00Z',
      updatedAt: '2024-01-15T11:15:00Z'
    },
    {
      id: 4,
      name: 'active_projects_view',
      type: 'view',
      description: 'View showing only active projects with progress',
      fields: [
        { name: 'id', type: 'integer', primary: true },
        { name: 'name', type: 'string', required: true },
        { name: 'progress', type: 'integer', required: false },
        { name: 'task_count', type: 'integer', required: false },
        { name: 'completion_percentage', type: 'decimal', required: false }
      ],
      createdAt: '2024-01-16T09:30:00Z',
      updatedAt: '2024-01-16T09:30:00Z'
    },
    {
      id: 5,
      name: 'calculate_project_progress',
      type: 'function',
      description: 'Function to calculate project completion percentage',
      fields: [
        { name: 'project_id', type: 'integer', required: true },
        { name: 'return_value', type: 'decimal', required: true }
      ],
      createdAt: '2024-01-16T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z'
    },
    {
      id: 6,
      name: 'update_project_timestamp',
      type: 'trigger',
      description: 'Trigger to automatically update project timestamp on task completion',
      fields: [
        { name: 'trigger_event', type: 'string', required: true },
        { name: 'target_table', type: 'string', required: true },
        { name: 'condition', type: 'text', required: false }
      ],
      createdAt: '2024-01-16T10:15:00Z',
      updatedAt: '2024-01-16T10:15:00Z'
    },
    {
      id: 7,
      name: 'Organizations',
      type: 'table',
      description: 'Multi-tenant organization data',
      fields: [
        { name: 'id', type: 'integer', primary: true },
        { name: 'name', type: 'string', required: true },
        { name: 'slug', type: 'string', required: true },
        { name: 'plan', type: 'string', required: true },
        { name: 'settings', type: 'json', required: false },
        { name: 'created_at', type: 'datetime', required: true }
      ],
      createdAt: '2024-01-17T08:00:00Z',
      updatedAt: '2024-01-17T08:00:00Z'
    },
    {
      id: 8,
      name: 'user_activity_view',
      type: 'view',
      description: 'Aggregated view of user activity and engagement metrics',
      fields: [
        { name: 'user_id', type: 'integer', primary: true },
        { name: 'total_tasks', type: 'integer', required: false },
        { name: 'completed_tasks', type: 'integer', required: false },
        { name: 'active_projects', type: 'integer', required: false },
        { name: 'last_activity', type: 'datetime', required: false }
      ],
      createdAt: '2024-01-17T14:30:00Z',
      updatedAt: '2024-01-17T14:30:00Z'
    }
  ] as Entity[]
};

// Database operations
export const db = {
  // Get all entities with optional filtering
  getEntities: (filters?: { search?: string; type?: string }) => {
    let entities = database.entities;
    
    if (filters?.search) {
      entities = entities.filter(entity =>
        entity.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
        entity.description.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }
    
    if (filters?.type) {
      entities = entities.filter(entity => entity.type === filters.type);
    }
    
    return entities;
  },

  // Get single entity by ID
  getEntity: (id: number) => {
    return database.entities.find(e => e.id === id);
  },

  // Create new entity
  createEntity: (data: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEntity: Entity = {
      id: Math.max(...database.entities.map(e => e.id)) + 1,
      ...data,
      fields: data.fields.length > 0 ? data.fields : [
        { name: 'id', type: 'integer', primary: true },
        { name: 'created_at', type: 'datetime', required: true },
        { name: 'updated_at', type: 'datetime', required: true }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    database.entities.push(newEntity);
    return newEntity;
  },

  // Update entity
  updateEntity: (id: number, data: Partial<Omit<Entity, 'id' | 'createdAt'>>) => {
    const entityIndex = database.entities.findIndex(e => e.id === id);
    if (entityIndex === -1) return null;

    const updatedEntity = {
      ...database.entities[entityIndex],
      ...data,
      updatedAt: new Date().toISOString()
    };

    database.entities[entityIndex] = updatedEntity;
    return updatedEntity;
  },

  // Delete entity
  deleteEntity: (id: number) => {
    const entityIndex = database.entities.findIndex(e => e.id === id);
    if (entityIndex === -1) return null;

    const deletedEntity = database.entities[entityIndex];
    database.entities.splice(entityIndex, 1);
    return deletedEntity;
  },

  // Check if entity exists
  entityExists: (name: string) => {
    return database.entities.some(e => 
      e.name.toLowerCase() === name.toLowerCase()
    );
  },

  // Get database stats
  getStats: () => ({
    totalEntities: database.entities.length,
    types: ['table', 'view', 'function', 'trigger'],
    typeDistribution: database.entities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  })
};