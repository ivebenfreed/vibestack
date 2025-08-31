import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IntegrityIssue {
  type: string;
  message?: string;
  severity?: string;
  table?: string;
  details?: any;
}

interface IntegrityFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  issues: IntegrityIssue[];
  recommendedAction: string;
  isResetting?: boolean;
}

export function IntegrityFailureModal({
  isOpen,
  onClose,
  onReset,
  issues,
  recommendedAction,
  isResetting = false
}: IntegrityFailureModalProps) {
  // Group issues by type or table
  const groupedIssues = issues.reduce((acc, issue) => {
    const key = issue.table || issue.type || 'unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, IntegrityIssue[]>);

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="integrity-failure-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Data Integrity Issues Detected
          </DialogTitle>
          <DialogDescription>
            The integrity check has detected {issues.length} issue{issues.length !== 1 ? 's' : ''} with your local data.
            {recommendedAction === 'reset' && (
              <span className="block mt-2 font-semibold text-red-600">
                A full database reset is recommended to resolve these issues.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <h4 className="text-sm font-semibold mb-2">Detected Issues:</h4>
          <ScrollArea className="h-[300px] w-full rounded-md border p-4">
            {Object.entries(groupedIssues).map(([group, groupIssues]) => (
              <div key={group} className="mb-4 last:mb-0">
                <h5 className="font-medium text-sm mb-2 text-gray-700">
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </h5>
                <div className="space-y-2">
                  {groupIssues.map((issue, index) => (
                    <Alert key={index} className="py-2">
                      <AlertDescription className="text-sm">
                        <span className={getSeverityColor(issue.severity)}>
                          {issue.severity && `[${issue.severity.toUpperCase()}] `}
                        </span>
                        {issue.message || issue.type || 'Unknown issue'}
                        {issue.details && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-gray-500">
                              View details
                            </summary>
                            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(issue.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm">
            <strong>Warning:</strong> Resetting the database will delete all local data and re-sync everything from the server. 
            This process may take several minutes depending on the amount of data.
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isResetting}
          >
            <X className="h-4 w-4 mr-2" />
            Continue Without Reset
          </Button>
          <Button
            variant="destructive"
            onClick={onReset}
            disabled={isResetting}
          >
            {isResetting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Database
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}