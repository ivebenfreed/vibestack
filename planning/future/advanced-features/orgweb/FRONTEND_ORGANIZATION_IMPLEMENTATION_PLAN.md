# Frontend Organization Support Implementation Plan

## 📋 **ANALYSIS SUMMARY**

### **Current Frontend Auth State**

**✅ Well-Implemented:**
- **Better Auth Integration**: Robust authClient setup with retry logic and error handling
- **XState Auth Machine**: Sophisticated state management for auth flows
- **Invitation-Based Signup**: Complete invitation flow with token validation
- **Role-Based Access**: User roles (admin, member, viewer, super_admin) already supported
- **Protected Routes**: Authentication guards and route protection

**❌ Missing Organization Support:**
- **No Organization Creation**: Users can't create new organizations
- **No Organization Selection**: No UI for choosing/switching organizations
- **No Organization Context**: No current organization state management
- **No Post-Auth Organization Flow**: No guidance after successful authentication

---

## 🎯 **IMPLEMENTATION STRATEGY**

### **Phase 1: Organization Context & State Management**
Add organization state to the existing XState architecture

### **Phase 2: Organization Creation Flow**
Implement organization creation during/after auth flows

### **Phase 3: Organization Selection & Switching**
Build organization picker and switching UI

### **Phase 4: Post-Auth Organization Flow**
Guide users through organization setup after login

---

## 📁 **DETAILED IMPLEMENTATION PLAN**

### **Phase 1: Organization Context & State Management**

#### **1.1 Create Organization Machine**
```typescript
// apps/web/src/state-machines/machines/organization-machine.ts
export const organizationMachine = createMachine({
  id: 'organization',
  initial: 'idle',
  context: {
    currentOrganization: null,
    userOrganizations: [],
    error: null,
    isLoading: false,
  },
  states: {
    idle: {
      on: {
        LOAD_ORGANIZATIONS: 'loadingOrganizations',
        SELECT_ORGANIZATION: 'selectingOrganization',
        CREATE_ORGANIZATION: 'creatingOrganization'
      }
    },
    loadingOrganizations: {
      invoke: {
        src: 'loadUserOrganizations',
        onDone: {
          target: 'idle',
          actions: 'setUserOrganizations'
        },
        onError: {
          target: 'idle',
          actions: 'setError'
        }
      }
    },
    selectingOrganization: {
      invoke: {
        src: 'selectOrganization',
        onDone: {
          target: 'idle',
          actions: 'setCurrentOrganization'
        },
        onError: {
          target: 'idle',
          actions: 'setError'
        }
      }
    },
    creatingOrganization: {
      invoke: {
        src: 'createOrganization',
        onDone: {
          target: 'idle',
          actions: ['addNewOrganization', 'setCurrentOrganization']
        },
        onError: {
          target: 'idle',
          actions: 'setError'
        }
      }
    }
  }
});
```

#### **1.2 Organization Hook**
```typescript
// apps/web/src/state-machines/hooks.tsx (add to existing file)
export function useOrganization() {
  const orgActor = (window as any).organizationMachineActor;
  
  if (!orgActor) {
    return {
      currentOrganization: null,
      userOrganizations: [],
      isLoading: false,
      error: null,
      loadOrganizations: () => {},
      selectOrganization: () => {},
      createOrganization: () => {},
    };
  }

  const currentOrganization = useSelector(orgActor, (state) => 
    state?.context?.currentOrganization || null
  );
  const userOrganizations = useSelector(orgActor, (state) => 
    state?.context?.userOrganizations || []
  );
  const isLoading = useSelector(orgActor, (state) => 
    !state?.matches('idle')
  );
  const error = useSelector(orgActor, (state) => 
    state?.context?.error || null
  );

  const loadOrganizations = useMemo(() => () => {
    orgActor.send({ type: 'LOAD_ORGANIZATIONS' });
  }, [orgActor]);

  const selectOrganization = useMemo(() => (orgId: string) => {
    orgActor.send({ type: 'SELECT_ORGANIZATION', orgId });
  }, [orgActor]);

  const createOrganization = useMemo(() => (orgData: any) => {
    orgActor.send({ type: 'CREATE_ORGANIZATION', orgData });
  }, [orgActor]);

  return {
    currentOrganization,
    userOrganizations,
    isLoading,
    error,
    loadOrganizations,
    selectOrganization,
    createOrganization,
  };
}
```

#### **1.3 Organization API Service**
```typescript
// apps/web/src/lib/organization-api.ts
import { authClient } from './auth';

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

class OrganizationApiService {
  private baseUrl = `${window.location.origin}/api`;

  async getUserOrganizations(): Promise<Organization[]> {
    const response = await fetch(`${this.baseUrl}/organizations`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load organizations: ${response.statusText}`);
    }

    return response.json();
  }

  async createOrganization(data: CreateOrganizationData): Promise<Organization> {
    const response = await fetch(`${this.baseUrl}/organizations`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create organization: ${response.statusText}`);
    }

    return response.json();
  }

  async selectOrganization(orgId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/organization-session`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: orgId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to select organization: ${response.statusText}`);
    }
  }
}

export const organizationApi = new OrganizationApiService();
```

### **Phase 2: Organization Creation Flow**

#### **2.1 Organization Creation Component**
```typescript
// apps/web/src/features/organizations/components/create-organization-form.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/state-machines';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  domain: z.string().optional(),
});

export function CreateOrganizationForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const { createOrganization } = useOrganization();

  const form = useForm<z.infer<typeof createOrgSchema>>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: '',
      domain: '',
    },
  });

  async function onSubmit(data: z.infer<typeof createOrgSchema>) {
    setIsLoading(true);
    try {
      await createOrganization(data);
      toast.success('Organization created successfully!');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Organization Name
        </label>
        <Input
          id="name"
          placeholder="Acme Corp"
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600 mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="domain" className="block text-sm font-medium mb-1">
          Domain (Optional)
        </label>
        <Input
          id="domain"
          placeholder="acme.com"
          {...form.register('domain')}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Creating...' : 'Create Organization'}
      </Button>
    </form>
  );
}
```

#### **2.2 Post-Auth Organization Setup**
```typescript
// apps/web/src/features/auth/components/post-auth-setup.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth, useOrganization } from '@/state-machines';
import { CreateOrganizationForm } from '@/features/organizations/components/create-organization-form';

export function PostAuthSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userOrganizations, loadOrganizations, selectOrganization } = useOrganization();
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const handleSelectOrganization = async (orgId: string) => {
    await selectOrganization(orgId);
    navigate({ to: '/', replace: true });
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    navigate({ to: '/', replace: true });
  };

  if (userOrganizations.length === 0 && !showCreateForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to VibeStack!</CardTitle>
            <p className="text-muted-foreground">
              You need to create or join an organization to get started.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setShowCreateForm(true)} className="w-full">
              Create New Organization
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Need to join an existing organization? Contact your administrator for an invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm onSuccess={handleCreateSuccess} />
            <Button 
              variant="ghost" 
              onClick={() => setShowCreateForm(false)}
              className="w-full mt-4"
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {userOrganizations.map((org) => (
            <Button
              key={org.id}
              variant="outline"
              onClick={() => handleSelectOrganization(org.id)}
              className="w-full justify-start"
            >
              <div className="text-left">
                <div className="font-medium">{org.name}</div>
                <div className="text-sm text-muted-foreground">
                  {org.membershipRole}
                </div>
              </div>
            </Button>
          ))}
          <Button 
            variant="ghost" 
            onClick={() => setShowCreateForm(true)}
            className="w-full"
          >
            Create New Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### **Phase 3: Organization Selection & Switching**

#### **3.1 Organization Switcher Component**
```typescript
// apps/web/src/components/layout/organization-switcher.tsx
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
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
import { useOrganization } from '@/state-machines';
import { CreateOrganizationForm } from '@/features/organizations/components/create-organization-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { 
    currentOrganization, 
    userOrganizations, 
    selectOrganization 
  } = useOrganization();

  const handleSelectOrganization = async (orgId: string) => {
    await selectOrganization(orgId);
    setOpen(false);
  };

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
            {currentOrganization?.name || "Select organization..."}
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
          <CreateOrganizationForm 
            onSuccess={() => setShowCreateDialog(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

#### **3.2 Update Sidebar Layout**
```typescript
// apps/web/src/components/layout/app-sidebar.tsx (modify existing)
import { OrganizationSwitcher } from './organization-switcher';

export function AppSidebar() {
  return (
    <div className="sidebar">
      {/* Add organization switcher at the top */}
      <div className="p-4 border-b">
        <OrganizationSwitcher />
      </div>
      
      {/* Existing sidebar content */}
      {/* ... rest of sidebar ... */}
    </div>
  );
}
```

### **Phase 4: Post-Auth Organization Flow**

#### **4.1 Update Auth Route Guard**
```typescript
// apps/web/src/routes/_authenticated/route.tsx (modify existing)
import { useAuth, useOrganization } from '@/state-machines';
import { PostAuthSetup } from '@/features/auth/components/post-auth-setup';

export function AuthenticatedRoute() {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const { currentOrganization, userOrganizations } = useOrganization();

  // Show loading while checking auth
  if (isCheckingAuth) {
    return <div>Loading...</div>;
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  // Show organization setup if user has no organizations or none selected
  if (userOrganizations.length === 0 || !currentOrganization) {
    return <PostAuthSetup />;
  }

  // Render authenticated app
  return <Outlet />;
}
```

#### **4.2 Initialize Organization Machine**
```typescript
// apps/web/src/main.tsx (modify existing)
import { organizationMachine } from '@/state-machines/machines/organization-machine';

// Initialize organization machine alongside auth machine
const organizationActor = createActor(organizationMachine);
organizationActor.start();
(window as any).organizationMachineActor = organizationActor;
```

---

## 🔄 **INTEGRATION POINTS**

### **Backend API Requirements**
1. **`GET /api/organizations`** - List user organizations
2. **`POST /api/organizations`** - Create new organization  
3. **`POST /api/organization-session`** - Set current organization
4. **`GET /api/organizations/:id/members`** - List organization members
5. **`POST /api/organizations/:id/invitations`** - Send invitations

### **State Management Integration**
- **Organization machine** runs alongside existing auth machine
- **Organization context** flows through existing XState ecosystem
- **Sync system** uses current organization for data filtering

### **UI Integration Points**
1. **Sidebar**: Organization switcher at top
2. **Post-auth flow**: Organization setup before main app
3. **Settings**: Organization management page
4. **Invitations**: Send invites from within app

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Foundation** ✅
- [ ] Create organization machine (`organization-machine.ts`)
- [ ] Add organization hook (`useOrganization()`)
- [ ] Create organization API service (`organization-api.ts`)
- [ ] Add organization types and interfaces

### **Phase 2: Creation Flow** ✅
- [ ] Build organization creation form component
- [ ] Create post-auth setup component
- [ ] Integrate with auth flow routing
- [ ] Add loading and error states

### **Phase 3: Selection & Switching** ✅
- [ ] Build organization switcher component
- [ ] Update sidebar layout
- [ ] Add organization persistence
- [ ] Handle organization switching

### **Phase 4: Integration** ✅
- [ ] Update authenticated route guard
- [ ] Initialize organization machine
- [ ] Test complete flow
- [ ] Add error handling and edge cases

---

## 🎯 **EXPECTED OUTCOMES**

### **User Experience**
1. **Seamless Organization Creation**: Users can create organizations during signup
2. **Intuitive Organization Switching**: Easy switching between multiple organizations
3. **Guided Setup Flow**: Clear guidance for new users
4. **Persistent Organization Context**: Current organization remembered across sessions

### **Technical Benefits**
1. **XState Integration**: Leverages existing state management architecture
2. **Type Safety**: Full TypeScript support for organization data
3. **API Consistency**: Uses existing authentication patterns
4. **Maintainable Code**: Follows established patterns and conventions

### **Business Value**
1. **Multi-Tenant Ready**: Supports multiple organizations per user
2. **Self-Service Onboarding**: Users can create organizations without admin intervention
3. **Role-Based Access**: Different permissions within organizations
4. **Scalable Architecture**: Foundation for enterprise features

This implementation plan builds on the existing robust auth system to add comprehensive organization support while maintaining the established patterns and architecture.