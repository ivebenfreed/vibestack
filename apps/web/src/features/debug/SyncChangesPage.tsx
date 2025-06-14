import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { ContentContainer } from '@/components/layout/content-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { syncChangesAtom } from '@/stores/syncStore';
import { format } from 'date-fns';

export function SyncChangesPage() {
  const changes = useAtomValue(syncChangesAtom);
  const [filter, setFilter] = useState<'all' | 'pending' | 'synced'>('all');

  const filteredChanges = changes.filter(change => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !change.synced;
    if (filter === 'synced') return change.synced;
    return true;
  });

  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Changes</h1>
          <p className="text-muted-foreground">
            Track pending and completed sync operations
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All ({changes.length})
          </Button>
          <Button 
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
          >
            Pending ({changes.filter(c => !c.synced).length})
          </Button>
          <Button 
            variant={filter === 'synced' ? 'default' : 'outline'}
            onClick={() => setFilter('synced')}
          >
            Synced ({changes.filter(c => c.synced).length})
          </Button>
        </div>

        <div className="space-y-4">
          {filteredChanges.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center">No changes found</p>
              </CardContent>
            </Card>
          ) : (
            filteredChanges.map((change) => (
              <Card key={change.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        {change.operation} on {change.tableName}
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(change.timestamp), 'PPpp')}
                      </CardDescription>
                    </div>
                    <Badge variant={change.synced ? 'default' : 'secondary'}>
                      {change.synced ? 'Synced' : 'Pending'}
                    </Badge>
                  </div>
                </CardHeader>
                {change.data && (
                  <CardContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(change.data, null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </ContentContainer>
  );
} 