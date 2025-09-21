/**
 * CreateOrganizationForm Component
 * 
 * Form for creating a new organization with validation and error handling.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-compatibility';

const createOrgSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-&.,'()]+$/, 'Organization name contains invalid characters'),
  domain: z.string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true;
      // Basic domain validation - can be improved
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
      return domainRegex.test(val);
    }, 'Please enter a valid domain name'),
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
      // Clean up the form data
      const orgData = {
        name: data.name.trim(),
        ...(data.domain?.trim() && { domain: data.domain.trim() })
      };
      
      // Call the auth machine to create organization
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
        <Label htmlFor="name">Organization Name *</Label>
        <Input
          id="name"
          placeholder="e.g. Acme Corp"
          {...form.register('name')}
          disabled={isSubmitting}
          className={form.formState.errors.name ? 'border-destructive' : ''}
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
          placeholder="e.g. acme.com"
          {...form.register('domain')}
          disabled={isSubmitting}
          className={form.formState.errors.domain ? 'border-destructive' : ''}
        />
        {form.formState.errors.domain && (
          <p className="text-sm text-destructive">
            {form.formState.errors.domain.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Used for email domain verification and branding
        </p>
      </div>

      {organizationError && (
        <Alert variant="destructive">
          <AlertDescription>{organizationError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Organization...
          </>
        ) : (
          <>
            <Building className="mr-2 h-4 w-4" />
            Create Organization
          </>
        )}
      </Button>
    </form>
  );
}