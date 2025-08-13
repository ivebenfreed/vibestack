import { describe, it, expect, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { 
  MeetingNotes, 
  TechnicalSpecification, 
  ProcessDocumentation,
  Proposal,
  UserManual,
  Contract
} from '../../entities/index.js';

describe('Week 6: Basic Entity Creation Test', () => {
  let orm: MikroORM;

  beforeEach(async () => {
    orm = await MikroORM.init({
      driver: SqliteDriver,
      dbName: ':memory:',
      entities: [
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
  });

  it('should create and persist MeetingNotes successfully', async () => {
    const em = orm.em.fork();

    const meetingNotes = em.create(MeetingNotes, {
      title: 'Weekly Team Standup',
      content: 'Discussed project progress and blockers',
      meetingDate: new Date('2024-01-15'),
      durationMinutes: 30,
      meetingType: 'standup',
      attendees: [
        { userId: 'user1', name: 'Alice Smith', status: 'present' },
        { userId: 'user2', name: 'Bob Jones', status: 'late' }
      ],
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'record'
    });

    await em.persistAndFlush(meetingNotes);

    expect(meetingNotes.id).toBeDefined();
    expect(meetingNotes.title).toBe('Weekly Team Standup');
    expect(meetingNotes.getRecordType()).toBe('meeting_notes');
    expect(await meetingNotes.validateRecordRules()).toBe(true);
  });

  it('should create and persist TechnicalSpecification successfully', async () => {
    const em = orm.em.fork();

    const spec = em.create(TechnicalSpecification, {
      title: 'User Authentication System',
      content: 'Complete specification for user authentication',
      specType: 'system',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'record'
    });

    await em.persistAndFlush(spec);

    expect(spec.id).toBeDefined();
    expect(spec.title).toBe('User Authentication System');
    expect(spec.getRecordType()).toBe('technical_specification');
    expect(await spec.validateRecordRules()).toBe(true);
  });

  it('should create and persist Proposal successfully', async () => {
    const em = orm.em.fork();

    const proposal = em.create(Proposal, {
      title: 'New Product Launch Proposal',
      content: 'Detailed proposal for new product launch',
      proposalType: 'business',
      problemStatement: 'Market gap identified in mobile solutions',
      proposedSolution: 'Develop innovative mobile app',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'document'
    });

    await em.persistAndFlush(proposal);

    expect(proposal.id).toBeDefined();
    expect(proposal.title).toBe('New Product Launch Proposal');
    expect(proposal.getDocumentType()).toBe('proposal');
    expect(await proposal.validateDocumentRules()).toBe(true);
  });

  it('should create and persist UserManual successfully', async () => {
    const em = orm.em.fork();

    const manual = em.create(UserManual, {
      title: 'API Integration Guide',
      content: 'Comprehensive guide for integrating with our API',
      manualType: 'api',
      targetAudience: 'developer',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'document'
    });

    await em.persistAndFlush(manual);

    expect(manual.id).toBeDefined();
    expect(manual.title).toBe('API Integration Guide');
    expect(manual.getDocumentType()).toBe('user_manual');
    expect(await manual.validateDocumentRules()).toBe(true);
  });

  it('should create and persist Contract successfully', async () => {
    const em = orm.em.fork();

    const contract = em.create(Contract, {
      title: 'Software Development Services Agreement',
      content: 'Agreement for custom software development services',
      contractType: 'service',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'document'
    });

    contract.parties = [
      { name: 'Client Corp', type: 'corporation', role: 'client' },
      { name: 'Dev Studio', type: 'corporation', role: 'vendor' }
    ];

    await em.persistAndFlush(contract);

    expect(contract.id).toBeDefined();
    expect(contract.title).toBe('Software Development Services Agreement');
    expect(contract.getDocumentType()).toBe('contract');
    expect(await contract.validateDocumentRules()).toBe(true);
  });
});