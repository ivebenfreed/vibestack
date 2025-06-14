# Data Generation System

This directory contains a modular data generation system for creating test data objects. The system is designed to generate pure data objects without making service calls, ensuring clean separation between data generation and test execution.

## Architecture

```
datagen/
├── BaseDataGenerator.ts      # Abstract base class for all generators
├── DataGeneratorFactory.ts   # Factory managing all generators
├── UsersDataGenerator.ts     # User entity generator
├── ProjectsDataGenerator.ts  # Project entity generator  
├── TasksDataGenerator.ts     # Task entity generator
├── CommentsDataGenerator.ts  # Comment entity generator
└── README.md                # This file
```

## Core Principles

1. **Pure Data Generation**: No service calls, only raw data objects
2. **Modular Design**: Each entity has its own generator
3. **Relationship Support**: Generators can reference other entities
4. **Variation Support**: `minimal`, `basic`, `complete` data variations
5. **Override Support**: Custom field values for testing scenarios

## Adding a New Entity Generator

### Step 1: Create the Generator Class

Create a new file `{EntityName}DataGenerator.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { BaseDataGenerator, type GenerationOptions } from './BaseDataGenerator';

export class MyEntityDataGenerator extends BaseDataGenerator {
  async generateRawData(count: number = 1, options: GenerationOptions = {}): Promise<any[]> {
    const { variation = 'basic', relationships = {}, overrides = {} } = options;
    const entities = [];

    for (let i = 0; i < count; i++) {
      const entity = await this.generateSingleEntity(i, variation, relationships, overrides);
      entities.push(entity);
    }

    return entities;
  }

  private async generateSingleEntity(
    index: number,
    variation: string,
    relationships: Record<string, any[]>,
    overrides: Record<string, any>
  ): Promise<any> {
    const baseEntity = {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Required fields
      name: this.generateName(index),
      status: this.generateStatus(),
      
      // Apply overrides
      ...overrides
    };

    // Add optional fields based on variation
    if (variation === 'basic' || variation === 'complete') {
      baseEntity.description = this.generateDescription(index);
    }

    if (variation === 'complete') {
      baseEntity.metadata = this.generateMetadata();
    }

    // Handle relationships
    await this.handleRelationships(baseEntity, relationships);

    return baseEntity;
  }

  private generateName(index: number): string {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    return `${names[index % names.length]} Entity ${index + 1}`;
  }

  private generateStatus(): string {
    const statuses = ['active', 'inactive', 'pending'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private generateDescription(index: number): string {
    return `Description for entity ${index + 1}`;
  }

  private generateMetadata(): Record<string, any> {
    return {
      tags: ['tag1', 'tag2'],
      priority: Math.floor(Math.random() * 5) + 1
    };
  }

  private async handleRelationships(
    entity: any,
    relationships: Record<string, any[]>
  ): Promise<void> {
    // Handle belongsTo relationships
    if (relationships.users && relationships.users.length > 0) {
      const randomUser = relationships.users[Math.floor(Math.random() * relationships.users.length)];
      entity.ownerId = randomUser.id;
    }

    // Handle array relationships
    if (relationships.categories && relationships.categories.length > 0) {
      const categoryCount = Math.floor(Math.random() * 3) + 1;
      entity.categoryIds = this.shuffleArray([...relationships.categories])
        .slice(0, categoryCount)
        .map(cat => cat.id);
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
```

### Step 2: Update the DomainEntityType

Add your new entity to the `DomainEntityType` in `BaseDataGenerator.ts`:

```typescript
export type DomainEntityType = 'users' | 'projects' | 'tasks' | 'comments' | 'myentity';
```

### Step 3: Register in DataGeneratorFactory

Update `DataGeneratorFactory.ts`:

```typescript
import { MyEntityDataGenerator } from './MyEntityDataGenerator';

// In the constructor's initializeGenerators method:
private initializeGenerators() {
  this.generators.set('users', new UsersDataGenerator());
  this.generators.set('projects', new ProjectsDataGenerator());
  this.generators.set('tasks', new TasksDataGenerator());
  this.generators.set('comments', new CommentsDataGenerator());
  this.generators.set('myentity', new MyEntityDataGenerator()); // Add this line
}

// Add convenience method:
async generateRawMyEntities(count: number = 5, options: GenerationOptions = {}): Promise<any[]> {
  return this.generateRawData('myentity', count, options);
}
```

### Step 4: Update Coverage Validator (Optional)

If you want schema validation, update `CoverageValidator.ts`:

```typescript
const DOMAIN_ENTITY_SCHEMAS: Record<DomainEntityType, EntitySchema> = {
  // ... existing entities
  myentity: {
    requiredFields: {
      name: 'string',
      status: 'enum'
    },
    optionalFields: {
      description: 'string',
      ownerId: 'uuid'
    },
    relationships: {
      belongsTo: [
        { field: 'owner', entity: 'users', required: false }
      ]
    },
    enums: {
      status: MyEntityStatus // Import your enum
    },
    constraints: {
      maxLength: { name: 100, description: 1000 }
    }
  }
};
```

## Generator Patterns

### Basic Entity Structure
```typescript
{
  id: string,           // Always UUID
  createdAt: Date,      // Always present
  updatedAt: Date,      // Always present
  // ... entity-specific fields
}
```

### Variation Levels
- **minimal**: Only required fields
- **basic**: Required + common optional fields
- **complete**: All possible fields

### Relationship Handling
```typescript
// belongsTo (foreign key)
if (relationships.users) {
  entity.userId = randomUser.id;
}

// hasMany (array of IDs)
if (relationships.tags) {
  entity.tagIds = selectedTags.map(tag => tag.id);
}

// manyToMany (handled by join table generation)
// No direct fields, use DataGeneratorFactory.generateJoinTableData()
```

### Override Support
```typescript
const entity = {
  // ... generated fields
  ...overrides  // Always apply last
};
```

## Usage Examples

### Basic Generation
```typescript
const factory = new DataGeneratorFactory(services);

// Generate single entity type
const users = await factory.generateRawUsers(5);
const myEntities = await factory.generateRawMyEntities(3);

// Generate with relationships
const projects = await factory.generateRawProjects(2, {
  relationships: { users }
});
```

### Complete Dataset
```typescript
// Generate full dataset with relationships
const dataset = await factory.generateTestDataset({
  counts: {
    users: 10,
    myentity: 5,
    projects: 3
  }
});

// Generate join table data
const joinTables = factory.generateJoinTableData(dataset);
```

### Edge Cases
```typescript
// Generate edge case data
const edgeCases = await factory.generateEdgeCaseData(['myentity']);

// Generate with overrides
const customEntities = await factory.generateRawMyEntities(1, {
  variation: 'complete',
  overrides: {
    name: 'Custom Name',
    status: 'special_status'
  }
});
```

## Best Practices

### 1. Field Generation
- Use realistic data patterns
- Support multiple variations
- Handle edge cases (empty strings, nulls)
- Use deterministic randomness when possible

### 2. Relationships
- Always check if relationship arrays exist and have items
- Use random selection for realistic distribution
- Support optional relationships (nullable foreign keys)

### 3. Data Consistency
- Ensure generated data follows business rules
- Validate enum values
- Respect field constraints (max length, patterns)

### 4. Performance
- Generate data efficiently for large counts
- Avoid expensive operations in loops
- Cache relationship lookups when possible

### 5. Testing
- Test all variation levels
- Test with and without relationships
- Test override functionality
- Test edge cases

## Common Patterns

### Enum Field Generation
```typescript
private generateStatus(): MyEntityStatus {
  const statuses = Object.values(MyEntityStatus);
  return statuses[Math.floor(Math.random() * statuses.length)];
}
```

### Date Field Generation
```typescript
private generateDate(field: string): Date {
  const now = new Date();
  const daysOffset = Math.floor(Math.random() * 365) - 182; // ±6 months
  return new Date(now.getTime() + (daysOffset * 24 * 60 * 60 * 1000));
}
```

### Array Field Generation
```typescript
private generateTags(): string[] {
  const allTags = ['urgent', 'important', 'review', 'draft'];
  const count = Math.floor(Math.random() * 3) + 1;
  return this.shuffleArray(allTags).slice(0, count);
}
```

### Conditional Field Generation
```typescript
private generateOptionalField(variation: string, index: number): string | null {
  if (variation === 'minimal') return null;
  return `Optional value ${index}`;
}
```

## Testing Your Generator

```typescript
// Test basic generation
const entities = await generator.generateRawData(5);
expect(entities).toHaveLength(5);
expect(entities[0]).toHaveProperty('id');

// Test variations
const minimal = await generator.generateRawData(1, { variation: 'minimal' });
const complete = await generator.generateRawData(1, { variation: 'complete' });
expect(Object.keys(complete[0]).length).toBeGreaterThan(Object.keys(minimal[0]).length);

// Test relationships
const withRelationships = await generator.generateRawData(1, {
  relationships: { users: [{ id: 'user-1' }] }
});
expect(withRelationships[0].userId).toBe('user-1');

// Test overrides
const withOverrides = await generator.generateRawData(1, {
  overrides: { name: 'Custom Name' }
});
expect(withOverrides[0].name).toBe('Custom Name');
```

This modular system makes it easy to add new entity types while maintaining consistency and reusability across the entire data generation framework. 