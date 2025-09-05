import React, { useState, useEffect } from 'react';
import { observer } from '@legendapp/state/react';
import { use$ } from '@legendapp/state/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, Sparkles, User, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getEntity$ } from '@/legend-state';
import { uiLog } from '@/logger';

const log = uiLog('features/universe/UniverseManager.tsx');

interface UniverseData {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export const UniverseManager = observer(function UniverseManager() {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newUniverseName, setNewUniverseName] = useState('');
  const [newUniverseDescription, setNewUniverseDescription] = useState('');
  
  // Get universe data from Legend State
  const universeStore = getEntity$('universe');
  const universeData = use$(universeStore);
  
  // Find user's universe (should be singleton)
  const userUniverse = React.useMemo(() => {
    if (!universeData || !user?.id) return null;
    
    // Universe data is stored as object with IDs as keys
    const universes = Object.values(universeData).filter(
      (universe: any) => universe && universe.owner_id === user.id
    ) as UniverseData[];
    
    return universes.length > 0 ? universes[0] : null;
  }, [universeData, user?.id]);

  // Auto-suggest universe name based on user
  useEffect(() => {
    if (!userUniverse && user && !newUniverseName) {
      const suggestedName = user.name 
        ? `${user.name}'s Universe`
        : `${user.email?.split('@')[0] || 'My'} Universe`;
      setNewUniverseName(suggestedName);
    }
  }, [userUniverse, user, newUniverseName]);

  const handleCreateUniverse = async () => {
    if (!user?.id || !newUniverseName.trim()) return;

    setIsCreating(true);
    try {
      const newUniverse = {
        name: newUniverseName.trim(),
        description: newUniverseDescription.trim() || undefined,
        owner_id: user.id,
      };

      // Add to Legend State store (will sync to backend)
      universeStore[crypto.randomUUID()].set(newUniverse);
      
      toast.success('Universe created successfully!');
      setNewUniverseName('');
      setNewUniverseDescription('');
      
      log.info('Created new universe:', newUniverse);
    } catch (error) {
      console.error('Failed to create universe:', error);
      toast.error('Failed to create universe');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUniverse = async (updates: Partial<UniverseData>) => {
    if (!userUniverse) return;

    try {
      // Update in Legend State store
      universeStore[userUniverse.id].set({
        ...userUniverse,
        ...updates,
        updated_at: new Date().toISOString()
      });
      
      toast.success('Universe updated successfully!');
      log.info('Updated universe:', { id: userUniverse.id, updates });
    } catch (error) {
      console.error('Failed to update universe:', error);
      toast.error('Failed to update universe');
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Please sign in to manage your universe.</p>
        </CardContent>
      </Card>
    );
  }

  // Show existing universe
  if (userUniverse) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-purple-500/10">
              <Globe className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {userUniverse.name}
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Personal Universe
                </Badge>
              </CardTitle>
              <CardDescription>
                Your personal container for all life areas and projects
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {userUniverse.description && (
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {userUniverse.description}
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Created {new Date(userUniverse.created_at).toLocaleDateString()}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // TODO: Add edit functionality
                toast.info('Universe editing coming soon!');
              }}
            >
              Edit Universe
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show creation form
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-purple-500/10">
            <Plus className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle>Create Your Universe</CardTitle>
            <CardDescription>
              Set up your personal universe to organize your life areas and projects
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="universe-name">Universe Name</Label>
          <Input
            id="universe-name"
            placeholder="My Personal Universe"
            value={newUniverseName}
            onChange={(e) => setNewUniverseName(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="universe-description">Description (Optional)</Label>
          <Textarea
            id="universe-description"
            placeholder="A space to organize all aspects of my life..."
            value={newUniverseDescription}
            onChange={(e) => setNewUniverseDescription(e.target.value)}
            rows={3}
          />
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Personal Universe</p>
              <p className="text-blue-700">
                This will be your private space for personal worlds and projects. 
                Only you can see and manage content in your universe.
              </p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={handleCreateUniverse} 
          disabled={isCreating || !newUniverseName.trim()}
          className="w-full"
        >
          {isCreating ? 'Creating Universe...' : 'Create My Universe'}
        </Button>
      </CardContent>
    </Card>
  );
});

export default UniverseManager;