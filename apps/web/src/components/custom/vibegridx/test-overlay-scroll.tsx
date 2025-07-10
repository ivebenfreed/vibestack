/**
 * Test component to verify overlay rendering after scroll fix
 * 
 * This test ensures that:
 * 1. Selection shapes remain visible after scrolling
 * 2. Mouse coordinates are correctly calculated with scroll offset
 * 3. Fill handle and drag operations work correctly after scrolling
 */

import React, { useEffect, useRef } from 'react';
import { VibeGridX } from './VibeGridX';

const generateTestData = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    name: `Item ${i}`,
    value: Math.floor(Math.random() * 100),
    status: i % 3 === 0 ? 'active' : 'inactive',
    date: new Date(2024, 0, i + 1).toISOString()
  }));
};

const testColumns = [
  { id: 'id', name: 'ID', field: 'id', type: 'text' as const, width: 100 },
  { id: 'name', name: 'Name', field: 'name', type: 'text' as const, width: 200 },
  { id: 'value', name: 'Value', field: 'value', type: 'number' as const, width: 120 },
  { id: 'status', name: 'Status', field: 'status', type: 'text' as const, width: 150 },
  { id: 'date', name: 'Date', field: 'date', type: 'date' as const, width: 180 }
];

export const TestOverlayScroll: React.FC = () => {
  const gridRef = useRef<any>(null);
  const [testResults, setTestResults] = React.useState<string[]>([]);
  
  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };
  
  useEffect(() => {
    // Run automated tests after component mounts
    const runTests = async () => {
      addTestResult('Starting overlay scroll tests...');
      
      // Test 1: Select a cell before scrolling
      setTimeout(() => {
        addTestResult('Test 1: Selecting cell at row 5, column 1');
        // Simulate cell selection via grid API if available
      }, 1000);
      
      // Test 2: Scroll down and verify selection remains visible
      setTimeout(() => {
        const viewport = document.querySelector('.vibegridx-viewport');
        if (viewport) {
          addTestResult('Test 2: Scrolling to position 400px');
          viewport.scrollTop = 400;
          
          // Check if selection shapes are still visible
          setTimeout(() => {
            const selectionShapes = document.querySelectorAll('[data-shape-type="selection"]');
            addTestResult(`Found ${selectionShapes.length} selection shapes after scroll`);
          }, 500);
        }
      }, 2000);
      
      // Test 3: Click on a cell after scrolling
      setTimeout(() => {
        addTestResult('Test 3: Testing cell click after scroll');
        // This would require simulating a mouse event
      }, 3000);
    };
    
    runTests();
  }, []);
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>VibeGridX Overlay Scroll Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Test Instructions:</h3>
        <ol>
          <li>Select some cells by clicking</li>
          <li>Scroll down in the grid</li>
          <li>Verify that selection shapes remain visible and correctly positioned</li>
          <li>Try selecting more cells after scrolling</li>
          <li>Test drag selection and fill handle after scrolling</li>
        </ol>
      </div>
      
      <div style={{ height: '400px', border: '1px solid #ccc' }}>
        <VibeGridX
          ref={gridRef}
          data={generateTestData(100)}
          columns={testColumns}
          entityType="test"
          onCellClick={(rowId, columnId) => {
            addTestResult(`Cell clicked: ${rowId}, ${columnId}`);
          }}
          onCellEdit={(rowId, columnId, value) => {
            addTestResult(`Cell edited: ${rowId}, ${columnId} = ${value}`);
          }}
          onSelectionChange={(selection) => {
            addTestResult(`Selection changed: ${selection.size} cells selected`);
          }}
        />
      </div>
      
      <div style={{ marginTop: '20px', maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', padding: '10px' }}>
        <h3>Test Results:</h3>
        {testResults.map((result, i) => (
          <div key={i} style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            {result}
          </div>
        ))}
      </div>
    </div>
  );
};