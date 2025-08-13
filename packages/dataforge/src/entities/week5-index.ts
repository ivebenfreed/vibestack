// Phase 2 Week 5: Project and Task Archetypes

// Abstract archetype base classes
export { ProjectArchetype } from './archetypes/ProjectArchetype.js';
export { TaskArchetype } from './archetypes/TaskArchetype.js';

// Concrete project entities
export { SoftwareProject } from './projects/SoftwareProject.js';
export { MarketingCampaign } from './projects/MarketingCampaign.js';
export { ResearchProject } from './projects/ResearchProject.js';

// Concrete task entities
export { UserStory } from './tasks/UserStory.js';
export { Bug } from './tasks/Bug.js';
export { MaintenanceTask } from './tasks/MaintenanceTask.js';

// Phase 1 Foundation (for reference)
export { BaseDomainEntity } from './BaseDomainEntity.js';
export { BaseSystemEntity } from './BaseSystemEntity.js';
export { BaseAuthEntity } from './BaseAuthEntity.js';