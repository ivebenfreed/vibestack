/**
 * Modular System Integration Test
 *
 * Tests the new field type system with TextFieldType to ensure everything works together.
 * This file demonstrates how to use the new modular architecture.
 */

import { FieldTypeRegistry, fieldTypeRegistry } from './FieldTypeRegistry';
import { SchemaAdapter } from '../schema/SchemaAdapter';
import { CellFactory } from '../factories/CellFactory';
import type { Column } from '../column-types';

// Import TextFieldType to register it
import './implementations/basic/TextFieldType';

/**
 * Test the modular system integration
 */
export function testModularSystem(): void {
  console.log('🧪 Testing VibeGrid Modular Field Type System');

  // 1. Test Registry
  console.log('1. Testing Field Type Registry...');
  testRegistry();

  // 2. Test Schema Adapter
  console.log('2. Testing Schema Adapter...');
  testSchemaAdapter();

  // 3. Test Cell Factory
  console.log('3. Testing Cell Factory...');
  testCellFactory();

  console.log('✅ All modular system tests passed!');
}

function testRegistry(): void {
  // Check if TextFieldType is registered
  const hasText = fieldTypeRegistry.hasFieldType('text');
  const hasLongtext = fieldTypeRegistry.hasFieldType('longtext');
  const hasTextarea = fieldTypeRegistry.hasFieldType('textarea');

  if (!hasText || !hasLongtext || !hasTextarea) {
    throw new Error('TextFieldType not properly registered');
  }

  // Test getting field type
  const mockColumn = {
    id: 'test_field',
    name: 'Test Field',
    field: 'test_field',
    cellType: 'text' as const
  };

  const fieldType = fieldTypeRegistry.getFieldType(mockColumn);
  if (fieldType.type !== 'text' || fieldType.category !== 'basic') {
    throw new Error('Field type resolution failed');
  }

  console.log('   ✓ Registry working correctly');
}

function testSchemaAdapter(): void {
  // Create mock columns
  const columns: Column[] = [
    {
      id: 'name',
      name: 'Name',
      field: 'name',
      cellType: 'text',
      required: true
    },
    {
      id: 'description',
      name: 'Description',
      field: 'description',
      cellType: 'longtext'
    },
    {
      id: 'email',
      name: 'Email',
      field: 'email',
      cellType: 'email',
      required: true
    }
  ];

  // Create mock backend schema
  const backendSchema = SchemaAdapter.createMockSchema('TestEntity', columns);

  // Enhance columns
  const enhancedColumns = SchemaAdapter.enhanceColumns(columns, backendSchema, 'TestEntity');

  // Verify enhancement
  const nameColumn = enhancedColumns.find(col => col.id === 'name');
  if (!nameColumn?.validation?.required) {
    throw new Error('Schema enhancement failed for required field');
  }

  const emailColumn = enhancedColumns.find(col => col.id === 'email');
  if (!emailColumn?.validation?.emailFormat) {
    throw new Error('Schema enhancement failed for email field');
  }

  console.log('   ✓ Schema Adapter working correctly');
}

function testCellFactory(): void {
  // Create enhanced column
  const column = {
    id: 'test_text',
    name: 'Test Text',
    field: 'test_text',
    cellType: 'text' as const,
    editable: true,
    validation: {
      required: true,
      maxLength: 100,
      messages: {
        required: 'Test Text is required'
      }
    },
    display: {
      width: 200,
      textAlign: 'left' as const
    },
    editor: {
      type: 'text' as const,
      placeholder: 'Enter text...'
    }
  };

  // Create cell factory
  const cellFactory = new CellFactory(fieldTypeRegistry);

  // Test cell creation
  const mockRowData = { id: 'row-1', test_text: 'Hello World' };
  const position = { rowIndex: 0, columnIndex: 0 };

  const cellElement = cellFactory.createCell(
    'Hello World',
    column,
    mockRowData,
    position
  );

  // Verify cell structure
  if (!cellElement.classList.contains('vibegridx-cell')) {
    throw new Error('Cell element missing expected class');
  }

  const contentWrapper = cellElement.querySelector('.vibegridx-cell-content');
  if (!contentWrapper) {
    throw new Error('Cell content wrapper not found');
  }

  const textContent = contentWrapper.textContent?.trim();
  if (textContent !== 'Hello World') {
    throw new Error(`Expected 'Hello World', got '${textContent}'`);
  }

  // Test cell update
  cellFactory.updateCell(cellElement, 'Updated Text', column, mockRowData);
  const updatedContent = contentWrapper.textContent?.trim();
  if (updatedContent !== 'Updated Text') {
    throw new Error('Cell update failed');
  }

  console.log('   ✓ Cell Factory working correctly');
}

/**
 * Example usage of the modular system
 */
export function exampleUsage(): HTMLElement {
  // 1. Define columns
  const columns: Column[] = [
    {
      id: 'title',
      name: 'Title',
      field: 'title',
      cellType: 'text',
      required: true,
      width: 300
    },
    {
      id: 'description',
      name: 'Description',
      field: 'description',
      cellType: 'longtext',
      width: 400
    }
  ];

  // 2. Create backend schema
  const backendSchema = SchemaAdapter.createMockSchema('ExampleEntity', columns);

  // 3. Enhance columns with backend metadata
  const enhancedColumns = SchemaAdapter.enhanceColumns(columns, backendSchema, 'ExampleEntity');

  // 4. Create cell factory
  const cellFactory = new CellFactory(fieldTypeRegistry, {
    enableEditing: true,
    enableTooltips: true,
    enableAccessibility: true
  });

  // 5. Create sample data
  const rowData = {
    id: 'sample-row',
    title: 'Sample Title',
    description: 'This is a longer description that demonstrates the longtext field type.'
  };

  // 6. Create cells
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    border: 1px solid #e5e7eb;
    background: white;
  `;

  enhancedColumns.forEach((column, index) => {
    const value = rowData[column.field as keyof typeof rowData];
    const position = { rowIndex: 0, columnIndex: index };

    const cell = cellFactory.createCell(value, column, rowData, position);
    container.appendChild(cell);
  });

  return container;
}

// Run tests if this file is imported
if (typeof window !== 'undefined') {
  // Only run in browser environment
  console.log('🔧 VibeGrid Modular System loaded');
}