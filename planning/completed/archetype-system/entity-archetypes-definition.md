# Entity Archetypes: Universal Business Patterns

## Overview

This document defines the 8 core entity archetypes that form the foundation of any business application. These archetypes represent universal patterns found across all business domains and provide a consistent framework for data modeling and application development.

## Base Domain Entity Properties

All business entities inherit from BaseDomainEntity, which provides core system properties:

### System Properties (Inherited by All Entities)
- **id** - Unique identifier (UUIDv7, auto-generated with timestamp ordering)
- **createdAt** - Creation timestamp (auto-set)
- **updatedAt** - Last modification timestamp (auto-updated)
- **createdBy** - User who created the entity (immutable)
- **clientId** - Client identifier for sync purposes (optional)

### Universal Relationships (Built into BaseDomainEntity)
- **Labels/Tags** - Tag archetype entities with polymorphic links to any entity
- **Dependencies** - Relationship archetype entities for 4-type blocking system
- **Discussions** - Discussion archetype entities with polymorphic parent links
- **File Attachments** - File archetype entities with polymorphic attachment links

### Universal Capabilities
- **Container Integration** - Automatic access control inheritance
- **Custom Fields** - Extensible field system using curated field types

## System Option Set Types

Certain option sets have special system behaviors and additional metadata:

### StatusOptionSet (System Type)
Status options include workflow and completion logic:
```json
{
  "value": "completed",
  "label": "Completed", 
  "optionType": "status",
  "metadata": {
    "isCompletionState": true,
    "allowedTransitions": ["archived"],
    "completionCriteria": {
      "allChildTasksComplete": true,
      "budgetApproved": true
    },
    "color": "#22c55e",
    "icon": "check-circle"
  }
}
```

### PriorityOptionSet (System Type)
Priority options include urgency and escalation logic:
```json
{
  "value": "high",
  "label": "High Priority",
  "optionType": "priority", 
  "metadata": {
    "urgencyLevel": 3,
    "escalationRules": {
      "escalateAfterDays": 2,
      "escalateTo": "urgent"
    },
    "color": "#ef4444",
    "icon": "arrow-up"
  }
}
```

### CategoryOptionSet (System Type)
Category options include classification and behavior rules:
```json
{
  "value": "bug",
  "label": "Bug Fix",
  "optionType": "category",
  "metadata": {
    "defaultPriority": "high",
    "requiredFields": ["reproduction_steps"],
    "autoAssignRules": {
      "assignTo": "engineering_team"
    },
    "color": "#dc2626"
  }
}
```

### DiscussionTypeOptionSet (System Type)
Discussion type options include threading and resolution capabilities:
```json
{
  "value": "comment",
  "label": "Comment",
  "optionType": "discussion_type",
  "metadata": {
    "isThreadable": true,
    "isResolvable": true,
    "allowsRichContent": true,
    "requiresParentEntity": true,
    "color": "#3b82f6",
    "icon": "message-circle"
  }
}
```

## Core Archetype Definitions

### 1. Project
*"Long-term initiatives and strategic outcomes"*

**Purpose**: Represents strategic efforts, initiatives, and outcomes that require coordination and planning over extended timeframes.

**Essential Properties**:
- Name/title
- Description/scope
- Status (StatusOptionSet with completion criteria and workflow logic)
- Priority (PriorityOptionSet with urgency and escalation rules)
- Start date, end date
- Parent/Child (hierarchical relationships)
- Dependencies (4-type blocking system)
- Owner (single person ultimately accountable)
- Members (team of contributors with different roles)

**Essential Behaviors**:
- Define milestones and deliverables
- Track progress toward outcomes
- Allocate resources and budget
- Coordinate multiple stakeholders
- Measure success against objectives

**Domain Examples**:
- Software product launch
- Sales territory expansion 
- Manufacturing facility upgrade
- Marketing campaign
- Regulatory compliance initiative

---

### 2. Task
*"Specific actions and executable work items"*

**Purpose**: Represents discrete, actionable work that can be assigned, tracked, and completed by individuals or teams.

**Essential Properties**:
- Title/description
- Status (StatusOptionSet with completion criteria and workflow logic)
- Priority (PriorityOptionSet with urgency and escalation rules)
- Start date(optional), due date
- Parent/Child (hierarchical relationships)
- Dependencies (4-type blocking system)
- Assignee (single person responsible for completion)
- Watchers (people who need visibility but aren't doing the work)

**Essential Behaviors**:
- Assign to individuals
- Track progress and time spent
- Mark as complete when finished
- Block/depend on other tasks
- Escalate when overdue

**Domain Examples**:
- Bug fix, feature development
- Sales call, customer follow-up
- Quality inspection, maintenance work
- Support ticket resolution
- Purchase order processing

---

### 3. Record
*"Structured data entities with consistent management patterns"*

**Purpose**: Represents core business objects that store structured information and require consistent CRUD operations.

**Essential Properties**:
- Name (primary identifier/display field)
- Description (additional details)
- Status (lifecycle status: active, inactive, archived, deleted)
- Parent/Child (hierarchical relationships - Company → Contacts)
- Owner (who manages this record)

**Essential Behaviors**:
- Create, read, update, delete operations
- Validate data integrity and business rules
- Track change history and audit trail
- Search and filter capabilities
- Import/export functionality
- Manage relationships to other records

**Domain Examples**:
- Contacts, companies, products
- Employees, customers, suppliers
- Assets, inventory items
- Students, patients, clients
- Parts, components, materials

---

### 4. Document
*"Editable content with versioning and collaboration"*

**Purpose**: Represents editable content that requires collaborative authoring, version control, and publishing workflows.

**Essential Properties**:
- Title (document name)
- Content (text, canvas data, presentation data, etc.)
- Format (markdown, html, canvas, slides, whiteboard)
- Version (revision tracking)
- Status (StatusOptionSet with publishing workflow logic)
- Author (who created the document)
- LastEditor (who last modified it)

**Essential Behaviors**:
- Collaborative editing and real-time updates
- Version control and revision tracking
- Publishing workflow (draft → review → published)
- Content formatting and rich media
- Template-based creation
- Export and sharing capabilities

**Domain Examples**:
- Text documents: specs, contracts, reports, wikis
- Visual content: whiteboards, diagrams, mind maps
- Presentations: slides, pitch decks, training materials
- Structured content: forms, templates, procedures
- Wiki pages, knowledge base articles
- Meeting notes, project documentation
- Training materials, user guides

---

### 5. File
*"Binary assets and uploaded content"*

**Purpose**: Represents uploaded files, media assets, and binary content that require storage, organization, and access control.

**Essential Properties**:
- Filename (original uploaded name)
- MimeType (file type)
- Size (bytes)
- StorageKey (cloud storage reference)
- Status (StatusOptionSet: uploading, ready, processing, error)
- UploadedBy (who uploaded the file)
- Checksum (file integrity hash)

**Essential Behaviors**:
- Upload and download operations
- Preview and thumbnail generation
- File processing and validation
- Storage management and cleanup
- Integrity verification

**Domain Examples**:
- Images, videos, audio files
- PDFs, spreadsheets, presentations
- CAD drawings, blueprints
- Signed contracts, certificates
- Product photos, marketing assets

---

### 6. Activity
*"Time-based occurrences and scheduled activities"*

**Purpose**: Represents activities, milestones, and occurrences that happen at specific times or within time ranges.

**Essential Properties**:
- Title (activity name)
- Description (activity details)
- StartTime (when it begins)
- EndTime (when it ends, optional for milestones)
- Status (StatusOptionSet: scheduled, in_progress, completed, cancelled)
- Location (where it happens, optional)
- Organizer (who organized/owns the activity)
- IsAllDay (boolean flag)
- Timezone (time zone reference)

**Essential Behaviors**:
- Schedule and reschedule times
- Manage participants and invitations
- Track attendance and participation
- Handle recurring activities
- Generate calendar and timeline views

**Domain Examples**:
- Meetings, appointments, calls
- Deadlines, milestones, launches
- Maintenance windows, outages
- Training sessions, workshops
- Audits, inspections, reviews

---

### 7. Discussion
*"Conversational content and communication threads"*

**Purpose**: Represents all forms of communication, from threaded discussions to direct messages to system notifications.

**Essential Properties**:
- Content (message text/rich content)
- Author (who wrote the message)
- DiscussionType (DiscussionTypeOptionSet with threading/resolution capabilities)
- Status (StatusOptionSet: active, resolved, closed, hidden)
- ParentEntityType (polymorphic: 'project', 'task', 'record', etc.)
- ParentEntityId (which entity this is attached to)
- ParentDiscussion (for threaded replies, optional)
- Mentions (users referenced in the content)

**Essential Behaviors**:
- Reply and thread management
- Mention users and entities
- Mark as read/unread for participants
- Resolve discussions when issues are addressed
- Search and filter conversation history

**Domain Examples**:
- Task comments, project discussions
- Customer support conversations
- Team chat and direct messages
- Code review feedback
- System notifications and alerts

---

### 8. Collection
*"Groups of related items with aggregate properties"*

**Purpose**: Represents organized groups of entities that function as a cohesive unit with collective properties and behaviors.

**Essential Properties**:
- Name (collection identifier)
- Description (collection purpose/details)
- CollectionType (cart, playlist, roster, lineup, etc.)
- Status (StatusOptionSet: active, completed, archived)
- Owner (who manages the collection)
- Aggregates (computed totals, counts, averages - JSON)

**Essential Behaviors**:
- Add and remove items dynamically
- Calculate aggregates automatically (totals, counts, averages)
- Reorder items within collection
- Apply bulk operations to all items
- Export collection data and relationships

**Domain Examples**:
- Shopping carts, order line items
- Survey responses, form submissions
- Playlists, media galleries
- Team rosters, group memberships
- Invoice line items, bill of materials

---

## Archetype Relationships

### Hierarchical Relationships
- **Projects** contain **Tasks**
- **Collections** contain **Records** or other entities
- **Discussions** can be attached to any archetype

### Cross-References
- **Tasks** can reference **Records** (assign to contact, relate to product)
- **Events** can be linked to **Projects** or **Tasks** (project milestones, task deadlines)
- **Documents** can be associated with any archetype (project specs, task instructions)

### Temporal Relationships
- **Events** mark important moments for **Projects** and **Tasks**
- **Discussions** provide communication history for all archetypes
- **Files** can be attached to provide supporting materials

## Universal Application

These 8 archetypes can model any business domain:

### Project Management
- Project (software release), Task (feature development), Record (team members), Document (requirements), File (design assets), Event (sprint planning), Discussion (standup notes), Collection (sprint backlog)

### Customer Relationship Management  
- Project (sales campaign), Task (follow-up calls), Record (contacts/accounts), Document (proposals), File (contracts), Event (meetings), Discussion (call notes), Collection (deal pipeline)

### Manufacturing ERP
- Project (product launch), Task (work orders), Record (parts/suppliers), Document (SOPs), File (CAD drawings), Event (production schedules), Discussion (quality issues), Collection (bill of materials)

### E-commerce Platform
- Project (marketing campaign), Task (order fulfillment), Record (products/customers), Document (product descriptions), File (product images), Event (sales events), Discussion (customer reviews), Collection (shopping carts)

This universal framework enables consistent data modeling, UI generation, and business logic across any domain while maintaining flexibility for domain-specific customization.

---

## Base Archetype Classes Implementation

### BaseProject & BaseTask - Shared Work Entity Pattern

Both Project and Task archetypes share the same core structure with different default configurations:

#### Core Identity Fields
- **name/title** - Primary identifier (required)
- **description** - Detailed information (optional)

#### Status & Workflow Fields
- **status** - StatusOptionSet with completion criteria and workflow logic (required)
  - Project defaults: planning → active → completed → cancelled
  - Task defaults: todo → doing → done
- **priority** - PriorityOptionSet with urgency and escalation rules (optional)

#### Time Management Fields
- **start_date** - When work begins (optional)
- **end_date** - When it should finish (optional)
- **completed_at** - Actual completion timestamp (auto-set)

#### Completion Management Fields
- **completion_criteria** - JSON structure defining what "done" means (optional)

#### People Fields (Different Patterns by Archetype)
- **created_by** - Who created it (base field, immutable)

**Project People Model:**
- **owner** - Single person ultimately accountable (strategic responsibility)
- **members** - Team of contributors with different roles

**Task People Model:**
- **assignee** - Single person responsible for completion (enforced accountability)
- **watchers** - People who need visibility but aren't doing the work

#### Essential Hierarchy & Relationships
- **parent** - Hierarchical parent (essential)
- **dependencies** - 4-type blocking system (essential)
  - blocks, blocked_by, depends_on, etc.
- Links to existing universal systems:
  - **Labels** - Universal tag sets for flexible categorization

#### Auto-Calculated Fields
- **completion_percent** - Auto-calculated from child entities and completion criteria

#### UI Representations (Not Separate Data Types)
- **Checklists** = Tasks displayed as checkboxes with click-to-complete
- **Milestones** = Projects displayed as timeline markers  
- **Sub-tasks** = Child tasks under parent tasks
- **Sub-projects** = Child projects under parent projects

#### Default Field Differences

**Projects typically focus on:**
- Strategic outcomes and long-term goals
- Collaborative leadership: owner (accountable) + members (contributors)
- Longer timelines with start_date + end_date
- Cross-functional coordination

**Tasks typically focus on:**
- Tactical execution and specific deliverables  
- Single point accountability: assignee (responsible) + watchers (informed)
- Shorter timelines with start_date + end_date (or just end_date)
- Clear ownership and completion

### BaseRecord - Data Management Entity Pattern

Records focus on data management rather than work completion:

#### Core Identity Fields
- **name** - Primary identifier/display field (required)
- **description** - Additional details (optional)

#### Lifecycle Management Fields
- **status** - Lifecycle status (required)
  - Record defaults: active → inactive → archived → deleted
  - Not about completion, but data lifecycle

#### Hierarchy & Ownership Fields
- **parent** - Hierarchical parent record (optional)
- **owner** - Who manages this record (optional)

#### Record-Specific Features
- Heavy emphasis on custom fields and data validation
- Relationship management between records
- Search/filter optimization
- Import/export capabilities
- Data quality and integrity rules

#### Default Differences from Project/Task

**Records focus on:**
- Data management and relationships
- Custom fields for domain-specific information
- Data validation and quality rules
- Search and filtering capabilities
- Import/export and data migration

**Key differences:**
- No time-based fields (start/end dates)
- No priority or urgency concepts
- No completion criteria or workflows
- Emphasis on data relationships over dependencies
- Lifecycle status vs. workflow status

### BaseDocument
```typescript
export abstract class BaseDocument extends BaseDomainEntity {
  @Property() title!: string;
  @Property({ type: 'text' }) content!: string; // Rich text/markdown content
  @Property() format!: string; // markdown, html, plain_text
  @Property() version!: number;
  @Property() status!: string; // draft, review, published, archived
  @Property({ nullable: true }) publishedAt?: Date;
  @Property({ type: 'json', nullable: true }) metadata?: any;
  @Property({ type: 'array', nullable: true }) tags?: string[];
  
  @ManyToOne(() => User, { nullable: true, fieldName: 'author_id' })
  author?: User;
  
  @ManyToOne(() => User, { nullable: true, fieldName: 'last_editor_id' })
  lastEditor?: User;
  
  // Document behaviors
  abstract edit(content: string, editor: User): Promise<void>;
  abstract publish(): Promise<void>;
  abstract createVersion(): Promise<BaseDocument>;
  abstract addComment(comment: string, user: User): Promise<void>;
  abstract getRevisionHistory(): Promise<DocumentRevision[]>;
  
  // Common document methods
  getWordCount(): number {
    return this.content.split(/\s+/).length;
  }
  
  getReadingTime(): number {
    // Estimate 200 words per minute
    return Math.ceil(this.getWordCount() / 200);
  }
  
  isPublished(): boolean {
    return this.status === 'published' && this.publishedAt !== null;
  }
}
```

### BaseFile
```typescript
export abstract class BaseFile extends BaseDomainEntity {
  @Property() filename!: string;
  @Property() originalName!: string;
  @Property() mimeType!: string;
  @Property() size!: number; // Size in bytes
  @Property() storageKey!: string; // Key for cloud storage
  @Property({ nullable: true }) checksum?: string; // File integrity hash
  @Property() status!: string; // uploading, ready, processing, error
  @Property({ type: 'json', nullable: true }) metadata?: any;
  @Property({ type: 'array', nullable: true }) tags?: string[];
  
  @ManyToOne(() => User, { nullable: true, fieldName: 'uploaded_by_id' })
  uploadedBy?: User;
  
  // File behaviors
  abstract getDownloadUrl(): Promise<string>;
  abstract generateThumbnail(): Promise<string>;
  abstract processFile(): Promise<void>;
  abstract validateFile(): Promise<boolean>;
  abstract copyFile(): Promise<BaseFile>;
  
  // Common file methods
  getFileExtension(): string {
    return this.filename.split('.').pop()?.toLowerCase() || '';
  }
  
  getHumanReadableSize(): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (this.size === 0) return '0 B';
    const i = Math.floor(Math.log(this.size) / Math.log(1024));
    return Math.round(this.size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  isImage(): boolean { return this.mimeType.startsWith('image/'); }
  isVideo(): boolean { return this.mimeType.startsWith('video/'); }
  isDocument(): boolean { 
    return ['application/pdf', 'application/msword', 'text/plain'].includes(this.mimeType); 
  }
}
```

### BaseEvent
```typescript
export abstract class BaseEvent extends BaseDomainEntity {
  @Property() title!: string;
  @Property({ type: 'text', nullable: true }) description?: string;
  @Property() startTime!: Date;
  @Property({ nullable: true }) endTime?: Date;
  @Property({ nullable: true }) timezone?: string;
  @Property() status!: string; // scheduled, in_progress, completed, cancelled
  @Property({ nullable: true }) location?: string;
  @Property({ type: 'json', nullable: true }) recurrenceRule?: any; // RRULE format
  @Property() isAllDay!: boolean;
  @Property({ type: 'json', nullable: true }) metadata?: any;
  
  @ManyToOne(() => User, { nullable: true, fieldName: 'organizer_id' })
  organizer?: User;
  
  // Event behaviors
  abstract addAttendee(user: User, role?: string): Promise<void>;
  abstract removeAttendee(user: User): Promise<void>;
  abstract reschedule(newStartTime: Date, newEndTime?: Date): Promise<void>;
  abstract sendReminder(): Promise<void>;
  abstract markComplete(): Promise<void>;
  
  // Common event methods
  getDuration(): number | null {
    if (!this.endTime) return null;
    return Math.ceil((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60));
  }
  
  isHappening(): boolean {
    const now = new Date();
    return now >= this.startTime && (!this.endTime || now <= this.endTime);
  }
  
  isPast(): boolean {
    const now = new Date();
    return this.endTime ? now > this.endTime : now > this.startTime;
  }
}
```

### BaseDiscussion
```typescript
export abstract class BaseDiscussion extends BaseDomainEntity {
  @Property({ type: 'text' }) content!: string;
  @Property() discussionType!: string; // comment, message, note, notification
  @Property() status!: string; // active, resolved, closed, hidden
  @Property({ nullable: true }) parentEntityType?: string;
  @Property({ nullable: true }) parentEntityId?: string;
  @Property({ type: 'array', nullable: true }) mentions?: string[];
  @Property({ type: 'json', nullable: true }) metadata?: any;
  
  @ManyToOne(() => User, { nullable: true, fieldName: 'author_id' })
  author?: User;
  
  @ManyToOne(() => BaseDiscussion, { nullable: true, fieldName: 'parent_discussion_id' })
  parentDiscussion?: BaseDiscussion;
  
  @OneToMany(() => BaseDiscussion, 'parentDiscussion')
  replies = new Collection<BaseDiscussion>(this);
  
  // Discussion behaviors
  abstract reply(content: string, author: User): Promise<BaseDiscussion>;
  abstract mention(users: User[]): Promise<void>;
  abstract markAsRead(user: User): Promise<void>;
  abstract resolve(): Promise<void>;
  abstract getThread(): Promise<BaseDiscussion[]>;
  
  // Common discussion methods
  getWordCount(): number { return this.content.split(/\s+/).length; }
  isReply(): boolean { return this.parentDiscussion !== null; }
  hasReplies(): boolean { return this.replies.length > 0; }
}
```

### BaseCollection
```typescript
export abstract class BaseCollection extends BaseDomainEntity {
  @Property() name!: string;
  @Property({ type: 'text', nullable: true }) description?: string;
  @Property() collectionType!: string; // cart, playlist, roster, lineup
  @Property() status!: string; // active, completed, archived
  @Property({ type: 'json', nullable: true }) settings?: any;
  @Property({ type: 'json', nullable: true }) aggregates?: any;
  
  @ManyToOne(() => User, { nullable: true, fieldName: 'owner_id' })
  owner?: User;
  
  // Collection behaviors
  abstract addItem(entityType: string, entityId: string, metadata?: any): Promise<void>;
  abstract removeItem(entityType: string, entityId: string): Promise<void>;
  abstract calculateAggregates(): Promise<any>;
  abstract reorderItems(newOrder: string[]): Promise<void>;
  abstract clearItems(): Promise<void>;
  
  // Common collection methods
  getItemCount(): number { return 0; } // Computed from CollectionItem entities
  isEmpty(): boolean { return this.getItemCount() === 0; }
  getAggregate(key: string): any { return this.aggregates?.[key]; }
}
```

## Supporting Types

```typescript
interface ProgressReport {
  completedTasks: number;
  totalTasks: number;
  percentComplete: number;
  timeSpent: string;
  estimatedTimeRemaining: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface DocumentRevision {
  version: number;
  content: string;
  author: User;
  timestamp: Date;
  changesSummary: string;
}

interface Milestone {
  name: string;
  targetDate: Date;
  description?: string;
  isCompleted: boolean;
}
```