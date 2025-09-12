-- Migration: Add priority field to client table
-- Add priority field to Wide Corp Solutions client table

ALTER TABLE public.org_01920000_1000_7000_8000_000000000001_clients 
ADD COLUMN priority varchar(20) DEFAULT 'medium';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_client_priority 
ON public.org_01920000_1000_7000_8000_000000000001_clients(priority);

-- Add index for status field as well since it will be used for filtering
CREATE INDEX IF NOT EXISTS idx_client_status 
ON public.org_01920000_1000_7000_8000_000000000001_clients(status);