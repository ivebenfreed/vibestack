import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import {
  // Phase 1 entities
  Account,
  User,
  Session,
  Project,
  Task,
  Comment,
  LocalChanges,
  EntityDependency,
  Tag,
  TagSet,
  StatusDefinition,
  StatusSet,
  Verification,
  ChangeHistory,
  Organization,
  OrganizationMember,
  DatabaseInstance,
  ContainerPermission,
  OptionSet,
  Option,
  StatusOptionMetadata,
  PriorityOptionMetadata,
  CategoryOptionMetadata,
  DiscussionTypeOptionMetadata,
  CustomFieldMetadata,
  CalculatedFieldMetadata,
  LookupFieldMetadata,
  EntityRelationship,
  Label,
  EntityLabel,
  // Phase 2 Week 5 concrete entities (not abstract archetypes)
  SoftwareProject,
  MarketingCampaign,
  ResearchProject,
  UserStory,
  Bug,
  MaintenanceTask,
  // Phase 2 Week 6 concrete entities (not abstract archetypes)
  MeetingNotes,
  TechnicalSpecification,
  ProcessDocumentation,
  Proposal,
  UserManual,
  Contract
} from '../entities/index.js';

export async function createTestDatabase(): Promise<MikroORM> {
  const orm = await MikroORM.init({
    driver: SqliteDriver,
    dbName: ':memory:',
    entities: [
      // Phase 1 entities
      Account,
      User,
      Session,
      Project,
      Task,
      Comment,
      LocalChanges,
      EntityDependency,
      Tag,
      TagSet,
      StatusDefinition,
      StatusSet,
      Verification,
      ChangeHistory,
      Organization,
      OrganizationMember,
      DatabaseInstance,
      ContainerPermission,
      OptionSet,
      Option,
      StatusOptionMetadata,
      PriorityOptionMetadata,
      CategoryOptionMetadata,
      DiscussionTypeOptionMetadata,
      CustomFieldMetadata,
      CalculatedFieldMetadata,
      LookupFieldMetadata,
      EntityRelationship,
      Label,
      EntityLabel,
      // Phase 2 Week 5 concrete entities (exclude abstract archetypes)
      SoftwareProject,
      MarketingCampaign,
      ResearchProject,
      UserStory,
      Bug,
      MaintenanceTask,
      // Phase 2 Week 6 concrete entities (exclude abstract archetypes)
      MeetingNotes,
      TechnicalSpecification,
      ProcessDocumentation,
      Proposal,
      UserManual,
      Contract
    ],
    forceUtcTimezone: true,
    allowGlobalContext: true,
    debug: false
  });

  await orm.schema.refreshDatabase();
  return orm;
}