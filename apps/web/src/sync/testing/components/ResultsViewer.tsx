import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TestResult } from '../core/TestTypes';

interface ResultsViewerProps {
  testHistory: TestResult[];
  onClearHistory: () => void;
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({ 
  testHistory, 
  onClearHistory 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Results</CardTitle>
        <CardDescription>View and analyze test execution results</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Results viewer with {testHistory.length} test results. 
          Full visualization coming soon...
        </p>
      </CardContent>
    </Card>
  );
}; 