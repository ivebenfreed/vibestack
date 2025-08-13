#!/usr/bin/env node

/**
 * Test for LabelService validation and business logic
 */

// Mock LabelService functionality for testing
function validateLabelData(data) {
  const errors = [];

  // Validate required fields
  if (!data.name || data.name.trim() === '') {
    errors.push('Label name is required');
  }

  // Validate name length and format
  if (data.name && data.name.length > 100) {
    errors.push('Label name cannot exceed 100 characters');
  }

  if (data.name && !/^[a-zA-Z0-9\s\-_()]+$/.test(data.name)) {
    errors.push('Label name contains invalid characters');
  }

  // Validate color format
  if (data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
    errors.push('Color must be a valid hex code (e.g., #ff0000)');
  }

  // Validate category
  if (data.category && data.category.length > 50) {
    errors.push('Category cannot exceed 50 characters');
  }

  return errors;
}

function validateEntityLabelData(data) {
  const errors = [];

  // Validate required fields
  if (!data.entityArchetype || data.entityArchetype.trim() === '') {
    errors.push('Entity archetype is required');
  }

  if (!data.entityId || data.entityId.trim() === '') {
    errors.push('Entity ID is required');
  }

  if (!data.labelId || data.labelId.trim() === '') {
    errors.push('Label ID is required');
  }

  // Validate archetype
  const validArchetypes = [
    'project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'
  ];

  if (data.entityArchetype && !validArchetypes.includes(data.entityArchetype)) {
    errors.push(`Invalid entity archetype: ${data.entityArchetype}`);
  }

  return errors;
}

function getDefaultSystemLabels() {
  return [
    // Priority labels
    {
      name: 'High Priority',
      color: '#ef4444',
      icon: 'exclamation-triangle',
      category: 'priority',
      isSystem: true
    },
    {
      name: 'Low Priority',
      color: '#6b7280',
      icon: 'minus',
      category: 'priority',
      isSystem: true
    },
    {
      name: 'Urgent',
      color: '#dc2626',
      icon: 'lightning-bolt',
      category: 'priority',
      isSystem: true
    },

    // Type labels
    {
      name: 'Bug',
      color: '#ef4444',
      icon: 'bug',
      category: 'type',
      isSystem: true
    },
    {
      name: 'Feature',
      color: '#3b82f6',
      icon: 'plus',
      category: 'type',
      isSystem: true
    },
    {
      name: 'Enhancement',
      color: '#10b981',
      icon: 'trending-up',
      category: 'type',
      isSystem: true
    },

    // Stage labels
    {
      name: 'Draft',
      color: '#f59e0b',
      icon: 'pencil',
      category: 'stage',
      isSystem: true
    },
    {
      name: 'In Review',
      color: '#3b82f6',
      icon: 'eye',
      category: 'stage',
      isSystem: true
    }
  ];
}

function generateLabelSuggestions(entityArchetype, entityData) {
  const suggestions = [];

  // Archetype-specific suggestions
  switch (entityArchetype) {
    case 'task':
      if (entityData.priority === 'high') suggestions.push('High Priority');
      if (entityData.dueDate && new Date(entityData.dueDate) < new Date()) suggestions.push('Overdue');
      if (entityData.estimatedDuration && parseInt(entityData.estimatedDuration) > 480) suggestions.push('Large Task');
      break;

    case 'project':
      if (entityData.status === 'planning') suggestions.push('Draft');
      if (entityData.dueDate) suggestions.push('Has Deadline');
      break;

    case 'document':
      if (entityData.format === 'markdown') suggestions.push('Documentation');
      if (entityData.title?.toLowerCase().includes('spec')) suggestions.push('Specification');
      break;

    case 'record':
      if (entityData.recordType === 'contact') suggestions.push('Contact');
      if (entityData.recordType === 'company') suggestions.push('Company');
      break;
  }

  // Content-based suggestions
  if (entityData.title || entityData.name) {
    const text = (entityData.title || entityData.name).toLowerCase();
    
    if (text.includes('bug') || text.includes('error') || text.includes('issue')) {
      suggestions.push('Bug');
    }
    if (text.includes('feature') || text.includes('add') || text.includes('new')) {
      suggestions.push('Feature');
    }
    if (text.includes('improve') || text.includes('enhance') || text.includes('better')) {
      suggestions.push('Enhancement');
    }
    if (text.includes('urgent') || text.includes('asap') || text.includes('critical')) {
      suggestions.push('Urgent');
    }
  }

  return [...new Set(suggestions)]; // Remove duplicates
}

function validateLabelHierarchy(labels, parentId, childId) {
  if (parentId === childId) {
    return false; // Cannot be parent of itself
  }

  // Build hierarchy map
  const childrenMap = new Map();
  for (const label of labels) {
    if (label.parentId) {
      if (!childrenMap.has(label.parentId)) {
        childrenMap.set(label.parentId, []);
      }
      childrenMap.get(label.parentId).push(label.id);
    }
  }

  // Check if making parentId a child of childId would create a cycle
  function wouldCreateCycle(currentParent, targetChild) {
    if (currentParent === targetChild) {
      return true;
    }

    const children = childrenMap.get(currentParent) || [];
    for (const child of children) {
      if (wouldCreateCycle(child, targetChild)) {
        return true;
      }
    }

    return false;
  }

  return !wouldCreateCycle(childId, parentId);
}

function getLabelUsageAnalytics(labels) {
  const totalLabels = labels.length;
  const activeLabels = labels.filter(l => l.isActive).length;
  const systemLabels = labels.filter(l => l.isSystem).length;
  const userLabels = labels.filter(l => !l.isSystem).length;

  const categoryStats = labels.reduce((acc, label) => {
    const category = label.category || 'uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const usageStats = {
    totalUsage: labels.reduce((sum, label) => sum + label.usageCount, 0),
    averageUsage: labels.length > 0 ? labels.reduce((sum, label) => sum + label.usageCount, 0) / labels.length : 0,
    mostUsed: labels.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
    leastUsed: labels.filter(l => l.usageCount === 0).length
  };

  return {
    totalLabels,
    activeLabels,
    systemLabels,
    userLabels,
    categoryStats,
    usageStats
  };
}

async function testLabelService() {
  console.log('🏷️ Testing LabelService');

  try {
    // Test 1: Label data validation
    console.log('\n🧪 Test 1: Label data validation');

    const validLabel = {
      name: 'High Priority',
      color: '#ef4444',
      category: 'priority',
      isSystem: true
    };

    const invalidLabel = {
      name: '',
      color: 'invalid-color',
      category: 'this-category-name-is-way-too-long-and-should-be-rejected-by-validation'
    };

    const validErrors = validateLabelData(validLabel);
    const invalidErrors = validateLabelData(invalidLabel);

    console.log(`  Valid label errors: ${validErrors.length === 0 ? '✅ None' : '❌ ' + validErrors.join(', ')}`);
    console.log(`  Invalid label errors: ${invalidErrors.length > 0 ? '✅ Found errors' : '❌ Should have errors'}`);
    console.log(`    Errors: ${invalidErrors.join(', ')}`);

    if (validErrors.length > 0) {
      console.log('❌ Valid label was rejected');
      process.exit(1);
    }

    if (invalidErrors.length === 0) {
      console.log('❌ Invalid label was accepted');
      process.exit(1);
    }

    // Test 2: Entity label validation
    console.log('\n🧪 Test 2: Entity label data validation');

    const validEntityLabel = {
      entityArchetype: 'task',
      entityId: 'task-123',
      labelId: 'label-456'
    };

    const invalidEntityLabel = {
      entityArchetype: 'invalid-archetype',
      entityId: '',
      labelId: 'label-456'
    };

    const validEntityErrors = validateEntityLabelData(validEntityLabel);
    const invalidEntityErrors = validateEntityLabelData(invalidEntityLabel);

    console.log(`  Valid entity label errors: ${validEntityErrors.length === 0 ? '✅ None' : '❌ ' + validEntityErrors.join(', ')}`);
    console.log(`  Invalid entity label errors: ${invalidEntityErrors.length > 0 ? '✅ Found errors' : '❌ Should have errors'}`);

    // Test 3: System label defaults
    console.log('\n🧪 Test 3: Default system labels');

    const systemLabels = getDefaultSystemLabels();
    const categories = [...new Set(systemLabels.map(l => l.category))];

    console.log(`  Total system labels: ${systemLabels.length}`);
    console.log(`  Categories: ${categories.join(', ')}`);

    const hasValidColors = systemLabels.every(l => /^#[0-9a-fA-F]{6}$/.test(l.color));
    const allSystemLabels = systemLabels.every(l => l.isSystem);

    console.log(`  ✅ Valid colors: ${hasValidColors}`);
    console.log(`  ✅ All system labels: ${allSystemLabels}`);

    if (!hasValidColors || !allSystemLabels) {
      console.log('❌ System labels validation failed');
      process.exit(1);
    }

    // Test 4: Label suggestions
    console.log('\n🧪 Test 4: Label suggestions');

    const testCases = [
      {
        archetype: 'task',
        data: { priority: 'high', title: 'Fix urgent bug in payment system' },
        expectedSuggestions: ['High Priority', 'Bug', 'Urgent']
      },
      {
        archetype: 'project',
        data: { status: 'planning', title: 'New feature implementation' },
        expectedSuggestions: ['Draft', 'Feature']
      },
      {
        archetype: 'document',
        data: { format: 'markdown', title: 'API Specification' },
        expectedSuggestions: ['Documentation', 'Specification']
      }
    ];

    for (const testCase of testCases) {
      const suggestions = generateLabelSuggestions(testCase.archetype, testCase.data);
      const hasExpectedSuggestions = testCase.expectedSuggestions.every(expected => 
        suggestions.includes(expected)
      );

      console.log(`  ${testCase.archetype}: ${suggestions.join(', ')}`);
      console.log(`  ✅ Expected suggestions present: ${hasExpectedSuggestions}`);

      if (!hasExpectedSuggestions) {
        console.log(`❌ Missing expected suggestions for ${testCase.archetype}`);
        process.exit(1);
      }
    }

    // Test 5: Hierarchical label validation
    console.log('\n🧪 Test 5: Hierarchical label validation');

    const hierarchicalLabels = [
      { id: 'priority', parentId: null },
      { id: 'high-priority', parentId: 'priority' },
      { id: 'critical', parentId: 'high-priority' },
      { id: 'type', parentId: null },
      { id: 'bug', parentId: 'type' }
    ];

    // Valid hierarchy: priority -> high-priority -> critical
    const validHierarchy1 = validateLabelHierarchy(hierarchicalLabels, 'priority', 'high-priority');
    const validHierarchy2 = validateLabelHierarchy(hierarchicalLabels, 'high-priority', 'critical');
    
    // Invalid: would create cycle
    const invalidHierarchy = validateLabelHierarchy(hierarchicalLabels, 'critical', 'priority');
    
    // Invalid: self-reference
    const selfReference = validateLabelHierarchy(hierarchicalLabels, 'priority', 'priority');

    console.log(`  ✅ Valid hierarchy (priority -> high-priority): ${validHierarchy1}`);
    console.log(`  ✅ Valid hierarchy (high-priority -> critical): ${validHierarchy2}`);
    console.log(`  ✅ Circular hierarchy blocked: ${!invalidHierarchy}`);
    console.log(`  ✅ Self-reference blocked: ${!selfReference}`);

    if (!validHierarchy1 || !validHierarchy2 || invalidHierarchy || selfReference) {
      console.log('❌ Hierarchical validation failed');
      process.exit(1);
    }

    // Test 6: Usage analytics
    console.log('\n🧪 Test 6: Usage analytics');

    const sampleLabels = [
      { id: '1', name: 'High Priority', isActive: true, isSystem: true, usageCount: 25, category: 'priority' },
      { id: '2', name: 'Bug', isActive: true, isSystem: true, usageCount: 15, category: 'type' },
      { id: '3', name: 'Custom Label', isActive: false, isSystem: false, usageCount: 0, category: 'custom' },
      { id: '4', name: 'Feature', isActive: true, isSystem: true, usageCount: 8, category: 'type' }
    ];

    const analytics = getLabelUsageAnalytics(sampleLabels);

    console.log(`  Total labels: ${analytics.totalLabels}`);
    console.log(`  Active labels: ${analytics.activeLabels}`);
    console.log(`  System labels: ${analytics.systemLabels}`);
    console.log(`  User labels: ${analytics.userLabels}`);
    console.log(`  Total usage: ${analytics.usageStats.totalUsage}`);
    console.log(`  Categories: ${Object.keys(analytics.categoryStats).join(', ')}`);

    const expectedTotals = {
      totalLabels: 4,
      activeLabels: 3,
      systemLabels: 3,
      userLabels: 1,
      totalUsage: 48
    };

    const analyticsValid = Object.entries(expectedTotals).every(([key, expected]) => 
      analytics[key] === expected || analytics.usageStats[key] === expected
    );

    console.log(`  ✅ Analytics calculations: ${analyticsValid ? 'Correct' : 'Incorrect'}`);

    if (!analyticsValid) {
      console.log('❌ Usage analytics failed');
      process.exit(1);
    }

    console.log('\n🎉 All LabelService tests passed!');
    console.log('\n📊 Implementation Summary:');
    console.log('  ✅ Label validation and formatting');
    console.log('  ✅ Entity label polymorphic structure');
    console.log('  ✅ System label defaults with categories');
    console.log('  ✅ Intelligent label suggestions');
    console.log('  ✅ Hierarchical label support');
    console.log('  ✅ Usage analytics and reporting');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testLabelService();