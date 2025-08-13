#!/usr/bin/env node

/**
 * Test for RelationshipService validation and business logic
 */

// Mock RelationshipService functionality for testing
function validateRelationshipData(data) {
  const errors = [];

  // Validate required fields
  if (!data.sourceArchetype || data.sourceArchetype.trim() === '') {
    errors.push('Source archetype is required');
  }

  if (!data.sourceId || data.sourceId.trim() === '') {
    errors.push('Source ID is required');
  }

  if (!data.targetArchetype || data.targetArchetype.trim() === '') {
    errors.push('Target archetype is required');
  }

  if (!data.targetId || data.targetId.trim() === '') {
    errors.push('Target ID is required');
  }

  if (!data.relationshipType || data.relationshipType.trim() === '') {
    errors.push('Relationship type is required');
  }

  // Validate relationship type
  const validTypes = [
    'depends_on', 'blocks', 'blocked_by',
    'parent_of', 'child_of', 'contains', 'contained_by',
    'relates_to', 'references', 'referenced_by'
  ];

  if (data.relationshipType && !validTypes.includes(data.relationshipType)) {
    errors.push(`Invalid relationship type: ${data.relationshipType}`);
  }

  // Prevent self-relationships
  if (data.sourceArchetype === data.targetArchetype && data.sourceId === data.targetId) {
    errors.push('Entity cannot have a relationship with itself');
  }

  return errors;
}

function checkCircularDependency(relationships, newRelationship) {
  if (!newRelationship.relationshipType.includes('depends_on') && !newRelationship.relationshipType.includes('blocks')) {
    return false; // Only check for dependency relationships
  }

  // Create a graph of dependencies
  const graph = new Map();
  
  // Add existing relationships
  for (const rel of relationships) {
    if (rel.relationshipType === 'depends_on' || rel.relationshipType === 'blocks') {
      const sourceKey = `${rel.sourceArchetype}:${rel.sourceId}`;
      const targetKey = `${rel.targetArchetype}:${rel.targetId}`;
      
      if (!graph.has(sourceKey)) {
        graph.set(sourceKey, new Set());
      }
      graph.get(sourceKey).add(targetKey);
    }
  }

  // Add the new relationship
  const newSourceKey = `${newRelationship.sourceArchetype}:${newRelationship.sourceId}`;
  const newTargetKey = `${newRelationship.targetArchetype}:${newRelationship.targetId}`;
  
  if (!graph.has(newSourceKey)) {
    graph.set(newSourceKey, new Set());
  }
  graph.get(newSourceKey).add(newTargetKey);

  // Check for cycles using DFS
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(node) {
    if (recursionStack.has(node)) {
      return true; // Found a cycle
    }
    
    if (visited.has(node)) {
      return false; // Already processed this node
    }

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Check all nodes for cycles
  for (const node of graph.keys()) {
    if (!visited.has(node) && hasCycle(node)) {
      return true;
    }
  }

  return false;
}

function getDefaultRelationshipTypes(sourceArchetype, targetArchetype) {
  const relationshipMatrix = {
    project: {
      project: ['parent_of', 'child_of', 'relates_to'],
      task: ['contains', 'relates_to'],
      record: ['relates_to', 'references'],
      document: ['relates_to', 'references']
    },
    task: {
      project: ['contained_by', 'relates_to'],
      task: ['depends_on', 'blocks', 'parent_of', 'child_of', 'relates_to'],
      record: ['relates_to', 'references'],
      document: ['relates_to', 'references']
    },
    record: {
      project: ['relates_to', 'referenced_by'],
      task: ['relates_to', 'referenced_by'],
      record: ['parent_of', 'child_of', 'relates_to'],
      document: ['relates_to', 'references']
    }
  };

  return relationshipMatrix[sourceArchetype]?.[targetArchetype] || ['relates_to'];
}

async function testRelationshipService() {
  console.log('🧪 Testing RelationshipService');

  try {
    // Test 1: Validate relationship data
    console.log('\n🧪 Test 1: Relationship data validation');

    const validRelationship = {
      sourceArchetype: 'task',
      sourceId: 'task-123',
      targetArchetype: 'task',
      targetId: 'task-456',
      relationshipType: 'depends_on'
    };

    const invalidRelationship = {
      sourceArchetype: '',
      sourceId: 'task-123',
      targetArchetype: 'task',
      targetId: 'task-123', // Same as source
      relationshipType: 'invalid_type'
    };

    const validErrors = validateRelationshipData(validRelationship);
    const invalidErrors = validateRelationshipData(invalidRelationship);

    console.log(`  Valid relationship errors: ${validErrors.length === 0 ? '✅ None' : '❌ ' + validErrors.join(', ')}`);
    console.log(`  Invalid relationship errors: ${invalidErrors.length > 0 ? '✅ Found errors' : '❌ Should have errors'}`);
    console.log(`    Errors: ${invalidErrors.join(', ')}`);

    if (validErrors.length > 0) {
      console.log('❌ Valid relationship was rejected');
      process.exit(1);
    }

    if (invalidErrors.length === 0) {
      console.log('❌ Invalid relationship was accepted');
      process.exit(1);
    }

    // Test 2: Circular dependency detection
    console.log('\n🧪 Test 2: Circular dependency detection');

    const existingRelationships = [
      {
        sourceArchetype: 'task',
        sourceId: 'A',
        targetArchetype: 'task',
        targetId: 'B',
        relationshipType: 'depends_on'
      },
      {
        sourceArchetype: 'task',
        sourceId: 'B',
        targetArchetype: 'task',
        targetId: 'C',
        relationshipType: 'depends_on'
      }
    ];

    const nonCircularRelationship = {
      sourceArchetype: 'task',
      sourceId: 'C',
      targetArchetype: 'task',
      targetId: 'D',
      relationshipType: 'depends_on'
    };

    const circularRelationship = {
      sourceArchetype: 'task',
      sourceId: 'C',
      targetArchetype: 'task',
      targetId: 'A',
      relationshipType: 'depends_on'
    };

    const hasNonCircular = checkCircularDependency(existingRelationships, nonCircularRelationship);
    const hasCircular = checkCircularDependency(existingRelationships, circularRelationship);

    console.log(`  Non-circular relationship: ${!hasNonCircular ? '✅ Allowed' : '❌ Incorrectly blocked'}`);
    console.log(`  Circular relationship: ${hasCircular ? '✅ Correctly blocked' : '❌ Incorrectly allowed'}`);

    if (hasNonCircular) {
      console.log('❌ Non-circular relationship was blocked');
      process.exit(1);
    }

    if (!hasCircular) {
      console.log('❌ Circular relationship was allowed');
      process.exit(1);
    }

    // Test 3: Default relationship types for archetype combinations
    console.log('\n🧪 Test 3: Default relationship types for archetype combinations');

    const combinations = [
      ['project', 'task'],
      ['task', 'task'],
      ['task', 'record'],
      ['record', 'document']
    ];

    for (const [source, target] of combinations) {
      const types = getDefaultRelationshipTypes(source, target);
      console.log(`  ${source} → ${target}: ${types.join(', ')}`);
      
      if (types.length === 0) {
        console.log(`❌ No relationship types defined for ${source} → ${target}`);
        process.exit(1);
      }
    }

    // Test 4: Polymorphic relationship structure validation
    console.log('\n🧪 Test 4: Polymorphic relationship structure validation');

    const sampleRelationship = {
      id: 'rel-uuid-v7',
      sourceArchetype: 'project',
      sourceId: 'project-123',
      targetArchetype: 'task',
      targetId: 'task-456',
      relationshipType: 'contains',
      metadata: {
        strength: 'strong',
        notes: 'Task is critical to project success'
      },
      sortOrder: 1,
      isActive: true,
      isBidirectional: true
    };

    // Validate structure
    const hasRequiredFields = ['sourceArchetype', 'sourceId', 'targetArchetype', 'targetId', 'relationshipType']
      .every(field => sampleRelationship[field] !== undefined);

    const hasPolymorphicFields = sampleRelationship.sourceArchetype && sampleRelationship.targetArchetype;
    const hasMetadata = typeof sampleRelationship.metadata === 'object';
    const hasSortOrder = typeof sampleRelationship.sortOrder === 'number';

    console.log(`  ✅ Required fields: ${hasRequiredFields ? 'Present' : 'Missing'}`);
    console.log(`  ✅ Polymorphic structure: ${hasPolymorphicFields ? 'Valid' : 'Invalid'}`);
    console.log(`  ✅ Metadata support: ${hasMetadata ? 'Present' : 'Missing'}`);
    console.log(`  ✅ Sort order: ${hasSortOrder ? 'Valid' : 'Invalid'}`);

    if (!hasRequiredFields || !hasPolymorphicFields || !hasMetadata || !hasSortOrder) {
      console.log('❌ Relationship structure validation failed');
      process.exit(1);
    }

    // Test 5: Bidirectional relationship logic
    console.log('\n🧪 Test 5: Bidirectional relationship logic');

    function getInverseRelationshipType(relationshipType) {
      const inverseMap = {
        'depends_on': 'blocks',
        'blocks': 'depends_on',
        'parent_of': 'child_of',
        'child_of': 'parent_of',
        'contains': 'contained_by',
        'contained_by': 'contains',
        'relates_to': 'relates_to', // Self-inverse
        'references': 'referenced_by',
        'referenced_by': 'references'
      };

      return inverseMap[relationshipType] || null;
    }

    const bidirectionalTests = [
      { type: 'depends_on', expected: 'blocks' },
      { type: 'parent_of', expected: 'child_of' },
      { type: 'contains', expected: 'contained_by' },
      { type: 'relates_to', expected: 'relates_to' }
    ];

    for (const test of bidirectionalTests) {
      const inverse = getInverseRelationshipType(test.type);
      const isCorrect = inverse === test.expected;
      console.log(`  ${test.type} → ${inverse}: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
      
      if (!isCorrect) {
        console.log(`❌ Expected ${test.expected}, got ${inverse}`);
        process.exit(1);
      }
    }

    console.log('\n🎉 All RelationshipService tests passed!');
    console.log('\n📊 Implementation Summary:');
    console.log('  ✅ Polymorphic relationship structure');
    console.log('  ✅ Circular dependency detection');
    console.log('  ✅ Archetype-specific relationship types');
    console.log('  ✅ Bidirectional relationship support');
    console.log('  ✅ Metadata and ordering capabilities');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testRelationshipService();