/**
 * OrganizationSwitcher Component
 * 
 * Allows users to switch between organizations or create new ones.
 * Appears in the sidebar when user has multiple organizations.
 */

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
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth';
import { CreateOrganizationForm } from '@/features/auth/components/CreateOrganizationForm';
import { useNavigate } from '@tanstack/react-router';

export function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const navigate = useNavigate();
  const { userOrganizations } = useUnifiedAuth();

  // Get org ID from URL path - same pattern as TraditionalOrgSidebar
  const getCurrentOrgId = () => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    const orgMatch = path.match(/\/org\/([^\/]+)/);
    return orgMatch ? orgMatch[1] : null;
  };

  const currentOrgId = getCurrentOrgId();
  const currentOrganization = userOrganizations?.find(org => org.id === currentOrgId);

  const hasMultipleOrganizations = userOrganizations && userOrganizations.length > 1;

  const switchOrganization = (orgId: string) => {
    navigate({
      to: '/org/$orgId/dashboard',
      params: { orgId }
    });
  };

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
        <PopoverContent className="w-full p-0" align="start">
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
                      {org.role}
                      {org.domain && ` • ${org.domain}`}
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