-- Migration: Create central entity_schemas table and populate with Wide Corp entities
-- This replaces the Durable Object schema registry with a PostgreSQL-native approach

-- Create the central entity schemas table
CREATE TABLE IF NOT EXISTS entity_schemas (
  org_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  archetype TEXT NOT NULL CHECK (archetype IN ('project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection')),
  business_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id, entity_name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_entity_schemas_org_id ON entity_schemas(org_id);
CREATE INDEX IF NOT EXISTS idx_entity_schemas_archetype ON entity_schemas(archetype);
CREATE INDEX IF NOT EXISTS idx_entity_schemas_table_name ON entity_schemas(table_name);

-- Insert all Wide Corp entities (from server sync logs)
-- Wide Corp ID: 01920000-1000-7000-8000-000000000001

INSERT INTO entity_schemas (org_id, entity_name, table_name, archetype, business_metadata) VALUES

-- Project-based entities (business initiatives, certifications, contracts, proposals)
('01920000-1000-7000-8000-000000000001', 'Project', 'org_01920000_1000_7000_8000_000000000001_project', 'project', 
 '{"syncable": true, "description": "Core business projects and initiatives", "fields": {"name": {"type": "string", "required": true}, "status": {"type": "string", "enum": ["active", "completed", "on_hold"]}, "budget": {"type": "number"}}}'),

('01920000-1000-7000-8000-000000000001', 'Certification', 'org_01920000_1000_7000_8000_000000000001_certification', 'project', 
 '{"syncable": true, "description": "Professional certifications and training programs", "fields": {"certification_name": {"type": "string", "required": true}, "provider": {"type": "string"}, "expiry_date": {"type": "date"}}}'),

('01920000-1000-7000-8000-000000000001', 'Contract', 'org_01920000_1000_7000_8000_000000000001_contract', 'project', 
 '{"syncable": true, "description": "Client contracts and agreements", "fields": {"contract_type": {"type": "string"}, "value": {"type": "number"}, "start_date": {"type": "date"}, "end_date": {"type": "date"}}}'),

('01920000-1000-7000-8000-000000000001', 'Proposal', 'org_01920000_1000_7000_8000_000000000001_proposal', 'project', 
 '{"syncable": true, "description": "Business proposals and bids", "fields": {"proposal_type": {"type": "string"}, "estimated_value": {"type": "number"}, "deadline": {"type": "date"}}}'),

-- Contact/relationship entities (clients and people)
('01920000-1000-7000-8000-000000000001', 'Client', 'org_01920000_1000_7000_8000_000000000001_client', 'record', 
 '{"syncable": true, "description": "Client contacts and companies", "fields": {"company_name": {"type": "string"}, "contact_person": {"type": "string"}, "email": {"type": "string"}, "phone": {"type": "string"}, "industry": {"type": "string"}}}'),

-- Document entities (files, invoices, expenses)
('01920000-1000-7000-8000-000000000001', 'Document', 'org_01920000_1000_7000_8000_000000000001_document', 'document', 
 '{"syncable": true, "description": "Business documents and files", "fields": {"document_type": {"type": "string"}, "file_path": {"type": "string"}, "size": {"type": "number"}}}'),

('01920000-1000-7000-8000-000000000001', 'Invoice', 'org_01920000_1000_7000_8000_000000000001_invoice', 'document', 
 '{"syncable": true, "description": "Client invoices and billing", "fields": {"invoice_number": {"type": "string", "required": true}, "amount": {"type": "number", "required": true}, "due_date": {"type": "date"}, "status": {"type": "string", "enum": ["draft", "sent", "paid", "overdue"]}}}'),

('01920000-1000-7000-8000-000000000001', 'Expense', 'org_01920000_1000_7000_8000_000000000001_expense', 'document', 
 '{"syncable": true, "description": "Business expenses and receipts", "fields": {"expense_type": {"type": "string"}, "amount": {"type": "number", "required": true}, "receipt_url": {"type": "string"}, "reimbursable": {"type": "boolean"}}}'),

-- Activity entities (meetings, timesheets)
('01920000-1000-7000-8000-000000000001', 'Meeting', 'org_01920000_1000_7000_8000_000000000001_meeting', 'activity', 
 '{"syncable": true, "description": "Business meetings and appointments", "fields": {"meeting_type": {"type": "string"}, "duration": {"type": "number"}, "attendees": {"type": "string"}, "location": {"type": "string"}}}'),

('01920000-1000-7000-8000-000000000001', 'Meetings', 'org_01920000_1000_7000_8000_000000000001_meetings', 'activity', 
 '{"syncable": true, "description": "Meeting sessions and events", "fields": {"session_type": {"type": "string"}, "duration": {"type": "number"}}}'),

('01920000-1000-7000-8000-000000000001', 'Timesheet', 'org_01920000_1000_7000_8000_000000000001_timesheet', 'activity', 
 '{"syncable": true, "description": "Employee time tracking and hours", "fields": {"hours": {"type": "number", "required": true}, "task_description": {"type": "string"}, "billable": {"type": "boolean"}, "rate": {"type": "number"}}}'),

-- Record entities (skills, resources)
('01920000-1000-7000-8000-000000000001', 'Skill', 'org_01920000_1000_7000_8000_000000000001_skill', 'record', 
 '{"syncable": true, "description": "Employee skills and competencies", "fields": {"skill_name": {"type": "string", "required": true}, "proficiency_level": {"type": "string", "enum": ["beginner", "intermediate", "advanced", "expert"]}, "category": {"type": "string"}}}'),

('01920000-1000-7000-8000-000000000001', 'Resource', 'org_01920000_1000_7000_8000_000000000001_resource', 'record', 
 '{"syncable": true, "description": "Business resources and assets", "fields": {"resource_type": {"type": "string"}, "availability": {"type": "string"}, "cost": {"type": "number"}}}');

-- Add a comment for tracking
COMMENT ON TABLE entity_schemas IS 'Central registry for all organization entity schemas, replacing Durable Object approach';
COMMENT ON COLUMN entity_schemas.archetype IS 'Maps to Universal Archetype patterns: project, task, record, document, file, activity, discussion, collection';
COMMENT ON COLUMN entity_schemas.business_metadata IS 'JSONB field containing validation rules, field definitions, and business logic';