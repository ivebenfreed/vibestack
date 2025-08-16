/**
 * PostAuthOrganizationSetup Component
 * 
 * Handles the organization setup flow after successful authentication.
 * This component is rendered when the auth machine is in organization setup states.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '@/state-machines';
import { CreateOrganizationForm } from './CreateOrganizationForm';

export function PostAuthOrganizationSetup() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { 
    user,
    userOrganizations, 
    needsOrganizationSetup, 
    needsOrganizationSelection,
    isLoadingOrganizations,
    organizationError,
    selectOrganization,
    reloadOrganizations
  } = useAuth();

  // Loading state
  if (isLoadingOrganizations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading your organizations...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (organizationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center gap-2 justify-center">
              <AlertCircle className="h-5 w-5" />
              Organization Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{organizationError}</AlertDescription>
            </Alert>
            <Button onClick={reloadOrganizations} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Need to create first organization
  if (needsOrganizationSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Welcome to VibeStack!
            </CardTitle>
            <p className="text-muted-foreground">
              Hi {user?.name || user?.email}! Let's set up your organization to get started.
            </p>
          </CardHeader>
          <CardContent>
            {showCreateForm ? (
              <div className="space-y-4">
                <CreateOrganizationForm />
                <Button 
                  variant="ghost" 
                  onClick={() => setShowCreateForm(false)}
                  className="w-full"
                >
                  Back
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button onClick={() => setShowCreateForm(true)} className="w-full">
                  <Building className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Need to join an existing organization?<br />
                  Contact your administrator for an invitation.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Need to select from existing organizations
  if (needsOrganizationSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Organization
            </CardTitle>
            <p className="text-muted-foreground">
              Choose which organization to access.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {userOrganizations.map((org) => (
              <Button
                key={org.id}
                variant="outline"
                onClick={() => selectOrganization(org.id)}
                className="w-full justify-start h-auto p-4"
              >
                <div className="text-left">
                  <div className="font-medium">{org.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {org.role} • {org.domain || 'No domain'}
                  </div>
                </div>
              </Button>
            ))}
            
            <div className="pt-2 border-t">
              <Button 
                variant="ghost" 
                onClick={() => setShowCreateForm(true)}
                className="w-full"
              >
                <Building className="h-4 w-4 mr-2" />
                Create New Organization
              </Button>
            </div>
            
            {showCreateForm && (
              <div className="pt-4">
                <CreateOrganizationForm />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Should not reach here if auth machine is working correctly
  return null;
}