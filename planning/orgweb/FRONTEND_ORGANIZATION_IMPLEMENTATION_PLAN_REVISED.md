# Frontend Organization Support - Revised Implementation Plan

## 📋 **REVISED STRATEGY: Extend Auth Machine**

After analysis, **extending the existing auth machine** is the optimal approach rather than creating a separate organization machine. This provides:

✅ **Single Source of Truth** - Auth + Organization state unified  
✅ **Natural Flow** - Auth → Load Orgs → Select Org → Ready  
✅ **Simpler Architecture** - No coordination between multiple machines  
✅ **Consistent Patterns** - Uses existing auth machine architecture  

---

## 🎯 **IMPLEMENTATION PHASES**

### **Phase 1: Extend Auth Machine Context & States**
### **Phase 2: Organization API Integration** 
### **Phase 3: UI Components & Flow**
### **Phase 4: Route Guards & Integration**

---

## 📁 **DETAILED IMPLEMENTATION**

### **Phase 1: Extend Auth Machine**

#### **1.1 Update Auth Machine Context**
```typescript
// apps/web/src/state-machines/machines/auth-machine.ts (modify existing)

// Add to existing context
context: {
  // ... existing auth context ...
  user: null,
  authToken: null,
  authError: null,
  lastActivity: Date.now(),
  errorRetryCount: 0,
  
  // ADD ORGANIZATION CONTEXT
  currentOrganization: null,
  userOrganizations: [],
  organizationError: null,
  isLoadingOrganizations: false,
  organizationSetupComplete: false,
}
```

#### **1.2 Extend Auth Machine States**
```typescript
// apps/web/src/state-machines/machines/auth-machine.ts (modify existing)

states: {
  // ... existing states (idle, checking, signingIn, etc.) ...
  
  authenticated: {
    initial: 'loadingOrganizations',
    entry: 'clearOrganizationError',
    states: {
      loadingOrganizations: {
        entry: 'setLoadingOrganizations',
        invoke: {
          id: 'loadUserOrganizations',
          src: 'loadUserOrganizations',
          onDone: {
            target: 'checkingOrganizationSetup',
            actions: ['setUserOrganizations', 'clearLoadingOrganizations']
          },
          onError: {
            target: 'organizationError',
            actions: ['setOrganizationError', 'clearLoadingOrganizations']
          }
        }
      },
      
      checkingOrganizationSetup: {
        always: [
          {
            target: 'needsOrganizationSetup',
            guard: 'hasNoOrganizations'
          },
          {
            target: 'needsOrganizationSelection',
            guard: 'hasNoCurrentOrganization'
          },
          {
            target: 'ready',
            actions: 'markOrganizationSetupComplete'
          }
        ]
      },
      
      needsOrganizationSetup: {
        on: {
          CREATE_ORGANIZATION: {
            target: 'creatingOrganization'
          },
          RETRY_LOAD_ORGANIZATIONS: {
            target: 'loadingOrganizations'
          }
        }
      },
      
      needsOrganizationSelection: {
        on: {
          SELECT_ORGANIZATION: {
            target: 'selectingOrganization'
          },
          CREATE_ORGANIZATION: {
            target: 'creatingOrganization'
          },
          RETRY_LOAD_ORGANIZATIONS: {
            target: 'loadingOrganizations'
          }
        }
      },
      
      creatingOrganization: {
        invoke: {
          id: 'createOrganization',
          src: 'createOrganization',
          onDone: {
            target: 'ready',
            actions: ['addNewOrganization', 'setCurrentOrganization', 'markOrganizationSetupComplete']
          },
          onError: {
            target: 'needsOrganizationSetup',
            actions: 'setOrganizationError'
          }
        }
      },
      
      selectingOrganization: {
        invoke: {
          id: 'selectOrganization',
          src: 'selectOrganization',
          onDone: {
            target: 'ready',
            actions: ['setCurrentOrganization', 'markOrganizationSetupComplete']
          },
          onError: {
            target: 'needsOrganizationSelection',
            actions: 'setOrganizationError'
          }
        }
      },
      
      organizationError: {
        on: {
          RETRY_LOAD_ORGANIZATIONS: {
            target: 'loadingOrganizations'
          },
          CREATE_ORGANIZATION: {
            target: 'creatingOrganization'
          }
        }
      },
      
      ready: {
        entry: 'notifyAppReady',
        on: {
          SWITCH_ORGANIZATION: {
            target: 'selectingOrganization'
          },
          CREATE_ORGANIZATION: {
            target: 'creatingOrganization'
          },
          RELOAD_ORGANIZATIONS: {
            target: 'loadingOrganizations'
          }
        }
      }
    }
  },
  
  // ... existing other states (signingOut, errorRecovery, etc.) ...
}
```

#### **1.3 Add Organization Guards**
```typescript
// apps/web/src/state-machines/machines/auth-machine.ts (add to guards)

guards: {
  // ... existing guards ...
  
  hasNoOrganizations: ({ context }) => {
    return !context.userOrganizations || context.userOrganizations.length === 0;
  },
  
  hasNoCurrentOrganization: ({ context }) => {
    return !context.currentOrganization && context.userOrganizations && context.userOrganizations.length > 0;
  },
  
  hasMultipleOrganizations: ({ context }) => {
    return context.userOrganizations && context.userOrganizations.length > 1;
  }
}
```

#### **1.4 Add Organization Actions**
```typescript
// apps/web/src/state-machines/machines/auth-machine.ts (add to actions)

actions: {
  // ... existing actions ...
  
  setLoadingOrganizations: assign({
    isLoadingOrganizations: true,
    organizationError: null
  }),
  
  clearLoadingOrganizations: assign({
    isLoadingOrganizations: false
  }),
  
  setUserOrganizations: assign({
    userOrganizations: ({ event }) => event.output,
    organizationError: null
  }),
  
  setCurrentOrganization: assign({
    currentOrganization: ({ event, context }) => {
      // If from SELECT_ORGANIZATION event, use the orgId to find org
      if (event.type === 'SELECT_ORGANIZATION') {
        return context.userOrganizations.find(org => org.id === event.orgId) || null;
      }
      // If from service completion, use the returned organization
      return event.output || event.data || null;
    },
    organizationError: null
  }),
  
  addNewOrganization: assign({
    userOrganizations: ({ context, event }) => {
      const newOrg = event.output || event.data;
      return [...(context.userOrganizations || []), newOrg];
    }
  }),
  
  setOrganizationError: assign({
    organizationError: ({ event }) => event.error?.message || 'Organization operation failed',
    isLoadingOrganizations: false
  }),
  
  clearOrganizationError: assign({
    organizationError: null
  }),
  
  markOrganizationSetupComplete: assign({
    organizationSetupComplete: true
  }),
  
  notifyAppReady: () => {
    console.log('[AUTH] User authenticated and organization setup complete - app ready');
    // Could dispatch custom event here for other parts of app
    window.dispatchEvent(new CustomEvent('app-ready'));
  }
}
```

#### **1.5 Add Organization Services**
```typescript
// apps/web/src/state-machines/machines/auth-machine.ts (add to services)

services: {
  // ... existing services ...
  
  loadUserOrganizations: async () => {
    console.log('[AUTH] Loading user organizations');
    const response = await fetch('/api/organizations', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load organizations: ${response.statusText}`);
    }
    
    const organizations = await response.json();
    console.log('[AUTH] Loaded organizations:', organizations);
    return organizations;
  },
  
  createOrganization: async ({ event }) => {
    console.log('[AUTH] Creating organization:', event.orgData);
    const response = await fetch('/api/organizations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event.orgData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create organization: ${response.statusText}`);
    }
    
    const newOrganization = await response.json();
    console.log('[AUTH] Created organization:', newOrganization);
    return newOrganization;
  },
  
  selectOrganization: async ({ event, context }) => {
    const orgId = event.orgId;
    console.log('[AUTH] Selecting organization:', orgId);
    
    // Set organization session on server
    const response = await fetch('/api/organization-session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to select organization: ${response.statusText}`);
    }
    
    // Return the selected organization from context
    const selectedOrg = context.userOrganizations.find(org => org.id === orgId);
    if (!selectedOrg) {
      throw new Error('Organization not found in user organizations');
    }
    
    console.log('[AUTH] Selected organization:', selectedOrg);
    return selectedOrg;
  }
}
```

### **Phase 2: Update useAuth Hook**

#### **2.1 Extend useAuth Hook with Organization Support**
```typescript
// apps/web/src/state-machines/hooks.tsx (modify existing useAuth function)

export function useAuth() {
  const navigate = useNavigate();
  const authActor = (window as any).authMachineActor;

  if (!authActor) {
    return {
      // ... existing fallback properties ...
      
      // ADD ORGANIZATION FALLBACK PROPERTIES
      currentOrganization: null,
      userOrganizations: [],
      organizationError: null,
      isLoadingOrganizations: false,
      needsOrganizationSetup: false,
      needsOrganizationSelection: false,
      isAuthenticatedAndReady: false,
      organizationSetupComplete: false,
      createOrganization: () => console.error('[useAuth] AuthMachine not available'),
      selectOrganization: () => console.error('[useAuth] AuthMachine not available'),
      switchOrganization: () => console.error('[useAuth] AuthMachine not available'),
      reloadOrganizations: () => console.error('[useAuth] AuthMachine not available'),
    };
  }
  
  // ... existing auth selectors ...
  const user = useSelector(authActor, (state) => state?.context?.user || null);
  const authError = useSelector(authActor, (state) => state?.context?.authError || null);
  const isAuthenticated = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated') : false
  );
  
  // ADD ORGANIZATION SELECTORS
  const currentOrganization = useSelector(authActor, (state) => 
    state?.context?.currentOrganization || null
  );
  const userOrganizations = useSelector(authActor, (state) => 
    state?.context?.userOrganizations || []
  );
  const organizationError = useSelector(authActor, (state) => 
    state?.context?.organizationError || null
  );
  const isLoadingOrganizations = useSelector(authActor, (state) => 
    state?.context?.isLoadingOrganizations || false
  );
  const organizationSetupComplete = useSelector(authActor, (state) => 
    state?.context?.organizationSetupComplete || false
  );
  
  // ORGANIZATION SETUP STATE CHECKS
  const needsOrganizationSetup = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated.needsOrganizationSetup') : false
  );
  const needsOrganizationSelection = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated.needsOrganizationSelection') : false
  );
  const isAuthenticatedAndReady = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated.ready') : false
  );
  
  // ... existing auth actions (signIn, signOut, etc.) ...
  
  // ADD ORGANIZATION ACTIONS
  const createOrganization = useMemo(() => (orgData: { name: string; domain?: string }) => {
    if (authActor) {
      console.log('[useAuth] Creating organization:', orgData);
      authActor.send({ type: 'CREATE_ORGANIZATION', orgData });
    }
  }, [authActor]);

  const selectOrganization = useMemo(() => (orgId: string) => {
    if (authActor) {
      console.log('[useAuth] Selecting organization:', orgId);
      authActor.send({ type: 'SELECT_ORGANIZATION', orgId });
    }
  }, [authActor]);

  const switchOrganization = useMemo(() => (orgId: string) => {
    if (authActor) {
      console.log('[useAuth] Switching organization:', orgId);
      authActor.send({ type: 'SWITCH_ORGANIZATION', orgId });
    }
  }, [authActor]);

  const reloadOrganizations = useMemo(() => () => {
    if (authActor) {
      console.log('[useAuth] Reloading organizations');
      authActor.send({ type: 'RELOAD_ORGANIZATIONS' });
    }
  }, [authActor]);

  // COMPUTED VALUES
  const hasMultipleOrganizations = userOrganizations.length > 1;
  const organizationName = currentOrganization?.name || 'No Organization';
  const userRole = user?.role || currentOrganization?.membershipRole || null;

  return {
    // ... existing auth properties ...
    user,
    authError,
    isAuthenticated,
    isSigningIn,
    isSigningOut,
    isCheckingAuth,
    signIn,
    signOut,
    refreshAuth,
    
    // ADD ORGANIZATION PROPERTIES
    currentOrganization,
    userOrganizations,
    organizationError,
    isLoadingOrganizations,
    needsOrganizationSetup,
    needsOrganizationSelection,
    isAuthenticatedAndReady,
    organizationSetupComplete,
    hasMultipleOrganizations,
    organizationName,
    userRole,
    
    // ADD ORGANIZATION ACTIONS
    createOrganization,
    selectOrganization,
    switchOrganization,
    reloadOrganizations,
  };
}
```

### **Phase 3: UI Components**

#### **3.1 Post-Auth Organization Setup Component**
```typescript
// apps/web/src/features/auth/components/post-auth-organization-setup.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building, Users } from 'lucide-react';
import { useAuth } from '@/state-machines';
import { CreateOrganizationForm } from './create-organization-form';

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
            <CardTitle className="text-center">Organization Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{organizationError}</AlertDescription>
            </Alert>
            <Button onClick={reloadOrganizations} className="w-full">
              Retry
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
              Let's set up your organization to get started.
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
                    {org.membershipRole} • {org.domain || 'No domain'}
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
```

#### **3.2 Organization Creation Form**
```typescript
// apps/web/src/features/auth/components/create-organization-form.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/state-machines';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  domain: z.string().optional(),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;

export function CreateOrganizationForm() {
  const { createOrganization, organizationError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: '',
      domain: '',
    },
  });

  async function onSubmit(data: CreateOrgFormData) {
    setIsSubmitting(true);
    try {
      // Clean up domain field
      const orgData = {
        name: data.name.trim(),
        ...(data.domain?.trim() && { domain: data.domain.trim() })
      };
      
      createOrganization(orgData);
      // Don't set isSubmitting false here - let the auth machine handle the state
      // The component will unmount when organization is created successfully
    } catch (error) {
      console.error('Create organization error:', error);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Organization Name</Label>
        <Input
          id="name"
          placeholder="Acme Corp"
          {...form.register('name')}
          disabled={isSubmitting}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="domain">Domain (Optional)</Label>
        <Input
          id="domain"
          placeholder="acme.com"
          {...form.register('domain')}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          Used for email domain verification and branding
        </p>
      </div>

      {organizationError && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {organizationError}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Organization...
          </>
        ) : (
          'Create Organization'
        )}
      </Button>
    </form>
  );
}
```

#### **3.3 Organization Switcher for Sidebar**
```typescript
// apps/web/src/components/layout/organization-switcher.tsx
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/state-machines';
import { CreateOrganizationForm } from '@/features/auth/components/create-organization-form';

export function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { 
    currentOrganization, 
    userOrganizations, 
    hasMultipleOrganizations,
    switchOrganization 
  } = useAuth();

  const handleSelectOrganization = async (orgId: string) => {
    if (orgId !== currentOrganization?.id) {
      switchOrganization(orgId);
    }
    setOpen(false);
  };

  // Don't show switcher if user only has one organization
  if (!hasMultipleOrganizations && userOrganizations.length <= 1) {
    return (
      <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4" />
          <span className="truncate">{currentOrganization?.name || 'No Organization'}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Building className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {currentOrganization?.name || "Select organization..."}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search organizations..." />
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              {userOrganizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => handleSelectOrganization(org.id)}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      currentOrganization?.id === org.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span>{org.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {org.membershipRole}
                    </span>
                  </div>
                </CommandItem>
              ))}
              <CommandItem
                onSelect={() => {
                  setShowCreateDialog(true);
                  setOpen(false);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create organization
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
          </DialogHeader>
          <CreateOrganizationForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### **Phase 4: Route Guards & Integration**

#### **4.1 Update Authenticated Route Guard**
```typescript
// apps/web/src/routes/_authenticated/route.tsx (modify existing)
import { Navigate, Outlet } from '@tanstack/react-router';
import { useAuth } from '@/state-machines';
import { PostAuthOrganizationSetup } from '@/features/auth/components/post-auth-organization-setup';
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen';

export function AuthenticatedRoute() {
  const { 
    isAuthenticated, 
    isCheckingAuth, 
    needsOrganizationSetup,
    needsOrganizationSelection,
    isLoadingOrganizations,
    isAuthenticatedAndReady
  } = useAuth();

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return <UnifiedLoadingScreen message="Checking authentication..." />;
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  // Show organization setup if needed
  if (needsOrganizationSetup || needsOrganizationSelection || isLoadingOrganizations) {
    return <PostAuthOrganizationSetup />;
  }

  // Only render main app when fully authenticated and organization is ready
  if (!isAuthenticatedAndReady) {
    return <UnifiedLoadingScreen message="Setting up your workspace..." />;
  }

  // Render the authenticated app
  return <Outlet />;
}
```

#### **4.2 Update Sidebar Layout**
```typescript
// apps/web/src/components/layout/app-sidebar.tsx (modify existing)
import { OrganizationSwitcher } from './organization-switcher';

export function AppSidebar() {
  return (
    <aside className="sidebar">
      {/* Organization switcher at top */}
      <div className="p-4 border-b">
        <OrganizationSwitcher />
      </div>
      
      {/* Existing sidebar navigation */}
      <nav className="flex-1 p-4">
        {/* ... existing navigation items ... */}
      </nav>
    </aside>
  );
}
```

#### **4.3 Add Organization Types**
```typescript
// apps/web/src/types/organization.ts
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  membershipRole: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationData {
  name: string;
  domain?: string;
}

export interface OrganizationMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔄 **INTEGRATION CHECKLIST**

### **Phase 1: Auth Machine Extension** ✅
- [ ] Update auth machine context with organization fields
- [ ] Add organization states to authenticated state
- [ ] Implement organization guards and actions
- [ ] Add organization services (API calls)
- [ ] Test auth machine state transitions

### **Phase 2: Hook Updates** ✅
- [ ] Extend useAuth hook with organization selectors
- [ ] Add organization actions to useAuth
- [ ] Add computed organization properties
- [ ] Test hook functionality with auth machine

### **Phase 3: UI Components** ✅
- [ ] Create PostAuthOrganizationSetup component
- [ ] Build CreateOrganizationForm component
- [ ] Implement OrganizationSwitcher component
- [ ] Test component interactions and state updates

### **Phase 4: Route Integration** ✅
- [ ] Update authenticated route guard
- [ ] Integrate organization setup flow
- [ ] Update sidebar with organization switcher
- [ ] Add organization types and interfaces
- [ ] End-to-end testing

---

## 📊 **BENEFITS OF REVISED APPROACH**

### **Architectural Benefits**
1. **Single Source of Truth** - All auth + org state in auth machine
2. **Natural State Flow** - Linear progression from auth → org setup → ready
3. **Simplified Testing** - One machine to test instead of coordinating multiple
4. **Consistent Patterns** - Uses existing auth machine architecture
5. **Fewer Global Actors** - No additional organization machine actor needed

### **Developer Experience**
1. **Single Hook** - Everything accessible through `useAuth()`
2. **Type Safety** - Full TypeScript support integrated into existing types
3. **Clear State Transitions** - Easy to understand auth + org flow
4. **Debugging** - Single machine state to inspect

### **User Experience**
1. **Seamless Flow** - Auth → Organization setup feels integrated
2. **Clear Progress** - User always knows where they are in setup
3. **Error Recovery** - Unified error handling and retry logic
4. **Persistent State** - Organization selection survives refreshes

This revised approach leverages your excellent existing auth machine architecture while adding comprehensive organization support in a clean, maintainable way.