# Wide Corp Entity-to-World Assignment Plan

## Executive Summary
Wide Corp has 26 business entity tables with varying data volumes. The largest asset is 11,997+ client records, making client management the core business domain. This document outlines how to organize entities into appropriate business worlds for comprehensive testing.

## Current Data Landscape

### High-Value Business Entities
- **Clients**: 11,997 records (core business asset)
- **Tasks**: 28 active development/business tasks
- **Projects**: 3 delivery projects
- **Invoices**: 3 billing records

### Test/Development Entities
- Multiple test entities with minimal data
- Various archetype and cache testing tables
- Soft delete testing infrastructure

## Recommended World Assignments

### 1. Sales & Client Success Domain

**Primary World**: `Enterprise Sales Pipeline` (`01920000-1003-7003-8003-000000000026`)
**Secondary World**: `Customer Onboarding` (`01920000-1003-7003-8003-000000000027`)

**Assigned Entities**:
- `clients` (11,997+ records) - Core client database
- `contracts` - Client agreements and legal documents
- `meetings` - Sales calls, client meetings, consultations
- `invoices` - Billing, payments, financial transactions
- `discussions` - Client communication threads

**Business Rationale**: Client management represents Wide Corp's primary business value with nearly 12K client records.

### 2. Engineering & Product Development Domain

**Primary World**: `API Infrastructure` (`01920000-1003-7003-8003-000000000021`)
**Secondary World**: `Mobile App Development` (`01920000-1003-7003-8003-000000000020`)

**Assigned Entities**:
- `tasks` (development tasks, bugs, features)
- `files` (code repositories, technical documentation)
- `discussions` (technical architecture discussions)
- `timesheets` (development time tracking)

**Business Rationale**: Support active development workflows and technical project management.

### 3. Project Delivery Domain

**Primary World**: `Phoenix Platform Migration` (`01920000-1003-7003-8003-000000000035`)
**Secondary World**: `Client Project Alpha` (`01920000-1003-7003-8003-000000000003`)

**Assigned Entities**:
- `projects` (client delivery projects)
- `tasks` (project-specific deliverables)
- `timesheets` (project time allocation)
- `expenses` (project costs and budget tracking)
- `files` (project documentation, deliverables)

**Business Rationale**: Manage complex client delivery projects with proper time and cost tracking.

### 4. Financial Operations Domain

**Primary World**: `Financial Planning 2024` (`01920000-1003-7003-8003-000000000031`)

**Assigned Entities**:
- `expenses` (operational and project expenses)
- `invoices` (accounts receivable)
- `contracts` (legal and financial commitments)
- `timesheets` (billable hours analysis)

**Business Rationale**: Centralize financial data for budgeting, forecasting, and profitability analysis.

### 5. Quality Assurance & Testing Domain

**Primary World**: Create new "QA Testing Environment" world

**Assigned Entities**:
- `testentitys`, `cachetestentitys`, `cleantests`
- `testcompanys`, `testcompany2s`, `testproducts`, `testprojects`
- `softdeletetests`, `testdeletes`, `archetypetests`
- `temptests`, `morningworkouts` (test entities)

**Business Rationale**: Isolate testing data from production business data while maintaining comprehensive test coverage.

### 6. Internal Operations Domain

**Primary World**: `HR & Talent Management` (`01920000-1003-7003-8003-000000000030`)
**Secondary World**: `Company All-Hands` (`01920000-1003-7003-8003-000000000032`)

**Assigned Entities**:
- `meetings` (internal team meetings, all-hands)
- `discussions` (internal company communication)
- `files` (HR policies, procedures, handbooks)
- `timesheets` (employee productivity tracking)

**Business Rationale**: Support internal operations and human resources management.

## Implementation Strategy

### Phase 1: Core Business Entities (High Priority)
1. Assign `clients` to Sales & Client Success worlds
2. Organize `tasks` and `projects` for Engineering and Project Delivery
3. Set up `invoices` and `expenses` in Financial Operations

### Phase 2: Supporting Entities (Medium Priority)
1. Distribute `meetings`, `files`, `discussions` based on context
2. Organize `timesheets` across relevant business domains
3. Set up `contracts` in appropriate legal/financial contexts

### Phase 3: Testing Infrastructure (Low Priority)
1. Create dedicated QA/Testing world
2. Migrate all test entities to testing environment
3. Ensure proper isolation from production data

## Data Integrity Considerations

### World Ownership
- Sales entities → Sales team leads and Account Managers
- Engineering entities → CTO and Technical Leads  
- Project entities → Project Managers and Delivery Teams
- Financial entities → CFO and Finance Team
- Testing entities → QA Team and Developers

### Access Patterns
- **Cross-functional access**: Projects, Tasks, Clients
- **Department-specific**: Expenses (Finance), Files (IT/Legal)
- **Role-based**: Contracts (Legal/Sales), Timesheets (All)

### Sync Considerations
- High-frequency: `tasks`, `timesheets`, `meetings`
- Medium-frequency: `clients`, `projects`, `discussions`
- Low-frequency: `contracts`, `invoices`, `expenses`
- Test-only: All test entities (separate sync rules)

## Success Metrics

1. **Data Organization**: All 26 entity types assigned to appropriate worlds
2. **Business Alignment**: Entities grouped by actual business workflows
3. **User Experience**: Teams can find relevant data in their assigned worlds
4. **Testing Integrity**: Test data isolated from production business data
5. **Performance**: Sync efficiency improved through logical data grouping

## Next Steps

1. Create SQL migration to assign existing records to worlds
2. Update UI to reflect world-based entity organization
3. Configure sync rules based on world assignments
4. Train users on new data organization structure
5. Monitor usage patterns and adjust assignments as needed