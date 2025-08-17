# TechFlow Solutions - Archetype Design & Entity Relationships

## Overview

This document defines the custom entity types (archetypes) and their relationships for TechFlow Solutions, creating a comprehensive business workflow system that showcases VibeStack's DataForge capabilities.

## Core Business Archetypes

### 1. Client Management Archetypes

#### Client Organization
- **Purpose**: Represents client companies and their business information
- **Key Fields**:
  - `company_name` (required, string)
  - `industry` (enum: Technology, Healthcare, Finance, Retail, Education, Other)
  - `company_size` (enum: Startup, Small, Medium, Large, Enterprise)
  - `website` (url)
  - `headquarters_location` (string)
  - `annual_revenue` (number, optional)
  - `contract_value` (number)
  - `contract_start_date` (date)
  - `contract_end_date` (date)
  - `payment_terms` (enum: Net15, Net30, Net45, Net60)
  - `status` (enum: Prospect, Active, Completed, Paused, Terminated)
  - `acquisition_channel` (enum: Referral, Website, Cold_Outreach, Partnership, Event)
  - `notes` (rich_text)

#### Client Contact
- **Purpose**: Individual contacts within client organizations
- **Key Fields**:
  - `first_name` (required, string)
  - `last_name` (required, string)
  - `email` (required, email)
  - `phone` (phone)
  - `job_title` (string)
  - `department` (string)
  - `role_type` (enum: Decision_Maker, Influencer, End_User, Technical_Contact, Billing_Contact)
  - `communication_preference` (enum: Email, Phone, Slack, Teams)
  - `timezone` (timezone)
  - `notes` (rich_text)
- **Relationships**:
  - `client_organization_id` → Client Organization (many-to-one)

### 2. Project Management Archetypes

#### Project
- **Purpose**: Software development projects with timelines and deliverables
- **Key Fields**:
  - `project_name` (required, string)
  - `project_type` (enum: Web_Application, Mobile_App, API_Development, Consulting, Maintenance)
  - `description` (rich_text)
  - `start_date` (date)
  - `target_end_date` (date)
  - `actual_end_date` (date, optional)
  - `budget` (number)
  - `estimated_hours` (number)
  - `actual_hours` (number, calculated)
  - `status` (enum: Planning, In_Progress, Review, Testing, Deployed, Completed, On_Hold, Cancelled)
  - `priority` (enum: Low, Medium, High, Critical)
  - `methodology` (enum: Agile, Scrum, Kanban, Waterfall)
  - `repository_url` (url)
  - `staging_url` (url)
  - `production_url` (url)
  - `risk_level` (enum: Low, Medium, High)
  - `profitability_score` (number, 1-10)
- **Relationships**:
  - `client_organization_id` → Client Organization (many-to-one)
  - `primary_contact_id` → Client Contact (many-to-one)
  - `project_manager_id` → User (many-to-one)
  - `tech_lead_id` → User (many-to-one)

#### Project Phase
- **Purpose**: Major phases within projects (Discovery, Design, Development, Testing, Deployment)
- **Key Fields**:
  - `phase_name` (required, string)
  - `description` (text)
  - `start_date` (date)
  - `end_date` (date)
  - `estimated_hours` (number)
  - `actual_hours` (number, calculated)
  - `status` (enum: Not_Started, In_Progress, Completed, Blocked)
  - `completion_percentage` (number, 0-100)
  - `deliverables` (rich_text)
  - `acceptance_criteria` (rich_text)
- **Relationships**:
  - `project_id` → Project (many-to-one)

#### Task
- **Purpose**: Specific work items with assignments and time tracking
- **Key Fields**:
  - `task_title` (required, string)
  - `description` (rich_text)
  - `task_type` (enum: Feature, Bug_Fix, Research, Documentation, Testing, Deployment, Meeting)
  - `priority` (enum: Low, Medium, High, Critical)
  - `status` (enum: Backlog, Todo, In_Progress, Review, Testing, Done, Blocked)
  - `estimated_hours` (number)
  - `actual_hours` (number, calculated)
  - `start_date` (date)
  - `due_date` (date)
  - `completed_date` (date, optional)
  - `complexity` (enum: Simple, Medium, Complex, Epic)
  - `labels` (array of strings)
  - `story_points` (number, 1-21)
- **Relationships**:
  - `project_id` → Project (many-to-one)
  - `project_phase_id` → Project Phase (many-to-one, optional)
  - `assigned_to_id` → User (many-to-one)
  - `created_by_id` → User (many-to-one)
  - `parent_task_id` → Task (self-referential, for subtasks)

### 3. Team & Resource Management Archetypes

#### Team Assignment
- **Purpose**: Links team members to projects with specific roles
- **Key Fields**:
  - `role_in_project` (enum: Project_Manager, Tech_Lead, Frontend_Dev, Backend_Dev, Mobile_Dev, Designer, QA, DevOps)
  - `allocation_percentage` (number, 0-100)
  - `start_date` (date)
  - `end_date` (date, optional)
  - `hourly_rate` (number)
  - `is_billable` (boolean)
  - `responsibilities` (text)
- **Relationships**:
  - `project_id` → Project (many-to-one)
  - `user_id` → User (many-to-one)

#### Skill
- **Purpose**: Technical and soft skills tracked for team members
- **Key Fields**:
  - `skill_name` (required, string)
  - `category` (enum: Frontend, Backend, Mobile, DevOps, Design, Project_Management, Soft_Skills)
  - `description` (text)
  - `is_technical` (boolean)
- **Relationships**: None (referenced by UserSkill)

#### User Skill
- **Purpose**: Junction table linking users to skills with proficiency levels
- **Key Fields**:
  - `proficiency_level` (enum: Beginner, Intermediate, Advanced, Expert)
  - `years_experience` (number)
  - `last_used_date` (date)
  - `certified` (boolean)
  - `notes` (text)
- **Relationships**:
  - `user_id` → User (many-to-one)
  - `skill_id` → Skill (many-to-one)

### 4. Time Tracking & Financial Archetypes

#### Time Entry
- **Purpose**: Detailed time tracking for tasks and projects
- **Key Fields**:
  - `date` (required, date)
  - `start_time` (time)
  - `end_time` (time)
  - `duration_hours` (number, calculated or manual)
  - `description` (required, text)
  - `entry_type` (enum: Development, Meeting, Research, Documentation, Testing, Admin)
  - `is_billable` (boolean)
  - `hourly_rate` (number)
  - `total_cost` (number, calculated)
  - `location` (enum: Office, Remote, Client_Site)
  - `mood_rating` (number, 1-5, optional)
- **Relationships**:
  - `user_id` → User (many-to-one)
  - `project_id` → Project (many-to-one)
  - `task_id` → Task (many-to-one, optional)

#### Invoice
- **Purpose**: Client billing and payment tracking
- **Key Fields**:
  - `invoice_number` (required, string, unique)
  - `issue_date` (date)
  - `due_date` (date)
  - `subtotal` (number)
  - `tax_rate` (number)
  - `tax_amount` (number, calculated)
  - `total_amount` (number, calculated)
  - `status` (enum: Draft, Sent, Viewed, Partial_Payment, Paid, Overdue, Cancelled)
  - `payment_terms` (enum: Net15, Net30, Net45, Net60)
  - `notes` (text)
  - `payment_date` (date, optional)
  - `payment_method` (enum: Bank_Transfer, Check, Credit_Card, ACH)
- **Relationships**:
  - `client_organization_id` → Client Organization (many-to-one)
  - `project_id` → Project (many-to-one)

#### Invoice Line Item
- **Purpose**: Individual line items on invoices with detailed billing
- **Key Fields**:
  - `description` (required, string)
  - `quantity` (number)
  - `unit_rate` (number)
  - `total_amount` (number, calculated)
  - `item_type` (enum: Hourly_Work, Fixed_Fee, Expense, Travel, Material)
  - `date_range_start` (date)
  - `date_range_end` (date)
- **Relationships**:
  - `invoice_id` → Invoice (many-to-one)
  - `time_entry_id` → Time Entry (many-to-one, optional)

### 5. Communication & Documentation Archetypes

#### Project Document
- **Purpose**: File and document management with version control
- **Key Fields**:
  - `document_name` (required, string)
  - `file_path` (string)
  - `file_size` (number)
  - `mime_type` (string)
  - `version` (string)
  - `document_type` (enum: Requirements, Design, Technical_Spec, Contract, Invoice, Report, Meeting_Notes)
  - `upload_date` (date)
  - `description` (text)
  - `is_client_visible` (boolean)
  - `tags` (array of strings)
- **Relationships**:
  - `project_id` → Project (many-to-one)
  - `uploaded_by_id` → User (many-to-one)

#### Meeting
- **Purpose**: Client and team meetings with attendees and notes
- **Key Fields**:
  - `meeting_title` (required, string)
  - `meeting_date` (date)
  - `start_time` (time)
  - `end_time` (time)
  - `meeting_type` (enum: Kickoff, Status_Update, Review, Planning, Retrospective, Client_Call)
  - `location` (enum: Office, Remote, Client_Site, Phone)
  - `agenda` (rich_text)
  - `notes` (rich_text)
  - `action_items` (rich_text)
  - `recording_url` (url, optional)
- **Relationships**:
  - `project_id` → Project (many-to-one, optional)
  - `organizer_id` → User (many-to-one)

#### Meeting Attendee
- **Purpose**: Junction table for meeting participants
- **Key Fields**:
  - `attendance_status` (enum: Required, Optional, Attended, No_Show, Declined)
  - `notes` (text)
- **Relationships**:
  - `meeting_id` → Meeting (many-to-one)
  - `user_id` → User (many-to-one, optional)
  - `client_contact_id` → Client Contact (many-to-one, optional)

## Complex Relationship Scenarios

### Project Workflow Chain
```
Client Organization
    ↓ (has many)
Projects
    ↓ (has many)
Project Phases
    ↓ (has many)
Tasks
    ↓ (has many)
Time Entries → (billable to) → Invoice Line Items → Invoices
```

### Team Collaboration Network
```
User ← (many-to-many via Team Assignment) → Project
User ← (many-to-many via User Skill) → Skill
User ← (one-to-many) → Time Entry → Task
```

### Client Communication Flow
```
Client Organization
    ↓ (has many)
Client Contacts ← (many-to-many via Meeting Attendee) → Meeting
                                                              ↓
                                                         Project
```

## Data Validation Rules

### Business Logic Constraints
- **Project budgets** cannot exceed client contract values
- **Time entries** cannot be created for future dates
- **Task assignments** must respect team member availability
- **Invoice totals** must match sum of line items plus tax
- **Project end dates** cannot be before start dates

### Custom Field Validations
- **Email addresses** must be unique within client contacts
- **Invoice numbers** must follow pattern: `INV-{YEAR}-{SEQUENCE}`
- **Hourly rates** must be positive numbers
- **Story points** must be Fibonacci sequence values (1,2,3,5,8,13,21)

## Advanced Features to Test

### Calculated Fields
- **Project profitability**: (Total invoice amount - Total cost) / Total cost
- **Team utilization**: Hours logged / Available hours per week
- **Client satisfaction**: Average of project completion ratings

### Dynamic Options
- **Available tasks** for time entry filtered by user's project assignments
- **Billable rates** automatically populated from team assignment
- **Project phases** dynamically created based on project type

### Relationship Constraints
- **Cascading updates**: Changing project status updates all related tasks
- **Dependency management**: Tasks cannot be completed before dependencies
- **Resource conflicts**: Warn when users are over-allocated across projects

This comprehensive archetype system provides realistic business workflows for testing all aspects of VibeStack's entity relationship management, custom fields, and business logic enforcement.