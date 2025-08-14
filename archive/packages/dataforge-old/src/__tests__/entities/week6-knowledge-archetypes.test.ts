import { describe, it, expect, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import { 
  MeetingNotes, 
  TechnicalSpecification, 
  ProcessDocumentation,
  Proposal,
  UserManual,
  Contract
} from '../../entities/index.js';
import { createTestDatabase } from '../test-helpers.js';

describe('Week 6: Knowledge Archetypes (Records & Documents)', () => {
  let orm: MikroORM;

  beforeEach(async () => {
    orm = await createTestDatabase();
  });

  describe('RecordArchetype', () => {
    it('should provide abstract base functionality for records', async () => {
      const em = orm.em.fork();

      // Create a meeting notes record (concrete implementation)
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

      // Test abstract methods are implemented
      expect(meetingNotes.getRecordType()).toBe('meeting_notes');
      expect(await meetingNotes.validateRecordRules()).toBe(true);
      
      // Test common record functionality
      expect(meetingNotes.archetype).toBe('record');
      expect(meetingNotes.containerType).toBe('flexible');
      expect(meetingNotes.isDraft()).toBe(true);
      expect(meetingNotes.isPublished()).toBe(false);

      // Test version management
      meetingNotes.createRevision('user1', 'Added action items');
      expect(meetingNotes.getCurrentVersion()).toBe(2);
      expect(meetingNotes.getRevisionHistory().length).toBe(1);

      // Test publishing workflow
      meetingNotes.publish('user1');
      expect(meetingNotes.isPublished()).toBe(true);
      expect(meetingNotes.publishedAt).toBeInstanceOf(Date);

      // Test content processing
      await meetingNotes.processContent();
      expect(meetingNotes.searchContent).toContain('weekly team standup');
      expect(meetingNotes.summary).toContain('standup held on');

      await em.flush();
    });

    it('should handle access control correctly', async () => {
      const em = orm.em.fork();

      const record = em.create(MeetingNotes, {
        title: 'Confidential Meeting',
        content: 'Sensitive information',
        meetingDate: new Date(),
        attendees: [{ userId: 'user1', name: 'Alice', status: 'present' }],
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      });

      // Test default access (open)
      expect(record.canAccess('user1')).toBe(true);
      expect(record.canAccess('user2')).toBe(true);

      // Test private access
      record.setAccessControl('private', undefined, undefined);
      record.authorId = 'user1';
      expect(record.canAccess('user1')).toBe(true);
      expect(record.canAccess('user2')).toBe(false);

      // Test restricted access
      record.setAccessControl('restricted', ['user1', 'user3'], ['admin']);
      expect(record.canAccess('user1')).toBe(true);
      expect(record.canAccess('user2')).toBe(false);
      expect(record.canAccess('user3')).toBe(true);
      expect(record.canAccess('user4', ['admin'])).toBe(true);

      await em.persistAndFlush(record);
    });

    it('should manage tags and keywords effectively', async () => {
      const em = orm.em.fork();

      const record = em.create(TechnicalSpecification, {
        title: 'API Documentation',
        content: 'REST API specification',
        specType: 'api',
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      });

      // Test tag management
      record.addTag('documentation');
      record.addTag('api');
      record.addTag('rest');
      expect(record.hasTag('api')).toBe(true);
      expect(record.hasTag('missing')).toBe(false);

      record.removeTag('rest');
      expect(record.hasTag('rest')).toBe(false);

      // Test keyword management
      record.addKeyword('endpoint');
      record.addKeyword('authentication');
      record.setKeywords(['endpoint', 'authentication', 'json', 'http']);
      expect(record.keywords).toHaveLength(4);

      await em.persistAndFlush(record);
    });
  });

  describe('DocumentArchetype', () => {
    it('should provide comprehensive document management features', async () => {
      const em = orm.em.fork();

      // Create a proposal document (concrete implementation)
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

      // Test abstract methods are implemented
      expect(proposal.getDocumentType()).toBe('proposal');
      expect(await proposal.validateDocumentRules()).toBe(true);

      // Test document archetype functionality
      expect(proposal.archetype).toBe('document');
      expect(proposal.containerType).toBe('flexible');

      // Test collaboration features
      proposal.addCollaborator('user1', 'editor', ['edit', 'comment']);
      proposal.addCollaborator('user2', 'reviewer', ['comment']);
      expect(proposal.canUserEdit('user1')).toBe(true);
      expect(proposal.canUserEdit('user2')).toBe(false);
      expect(proposal.canUserComment('user2')).toBe(true);

      // Test comment system
      const commentId = proposal.addComment('user2', 'Great proposal!');
      const replyId = proposal.replyToComment(commentId, 'user1', 'Thank you!');
      expect(proposal.comments).toHaveLength(1);
      expect(proposal.comments![0].replies).toHaveLength(1);

      proposal.resolveComment(commentId, 'user1');
      expect(proposal.comments![0].resolved).toBe(true);
      expect(proposal.getUnresolvedComments()).toHaveLength(0);

      // Test approval workflow
      proposal.initializeApprovalWorkflow([
        { userId: 'manager1', role: 'manager' },
        { userId: 'exec1', role: 'executive' }
      ]);
      
      proposal.submitForApproval();
      expect(proposal.requiresApproval()).toBe(true);
      expect(proposal.isApproved()).toBe(false);

      proposal.approve('manager1', 'Looks good');
      proposal.approve('exec1', 'Approved');
      expect(proposal.isApproved()).toBe(true);

      await em.flush();
    });

    it('should handle version control and content management', async () => {
      const em = orm.em.fork();

      const document = em.create(UserManual, {
        title: 'User Guide v1.0',
        content: 'Initial user guide content',
        manualType: 'software',
        targetAudience: 'end_user',
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      });

      // Test version management
      document.createVersion('author1', 'Initial version', 'Created first draft');
      expect(document.getCurrentVersion()).toBe(2);

      document.updateContent('Updated user guide content', 'author1', 'Added new sections');
      expect(document.content).toBe('Updated user guide content');
      expect(document.getCurrentVersion()).toBe(3);

      // Test rollback
      const success = document.rollbackToVersion(2, 'author1');
      expect(success).toBe(true);
      expect(document.content).toBe('Initial user guide content');

      // Test publishing workflow
      expect(document.isDraft()).toBe(true);
      document.publish('author1');
      expect(document.isPublished()).toBe(true);
      expect(document.isDraft()).toBe(false);

      document.unpublish();
      expect(document.isDraft()).toBe(true);
      expect(document.isPublished()).toBe(false);

      await em.persistAndFlush(document);
    });

    it('should manage attachments and sharing settings', async () => {
      const em = orm.em.fork();

      const document = em.create(Contract, {
        title: 'Service Agreement',
        content: 'Terms and conditions',
        contractType: 'service',
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      });

      // Test attachment management
      const attachmentId = document.addAttachment(
        'contract-terms.pdf',
        'application/pdf',
        1024000,
        '/uploads/contract-terms.pdf',
        'user1',
        'Official contract terms'
      );
      expect(document.attachments).toHaveLength(1);
      expect(document.getTotalAttachmentSize()).toBe(1024000);

      document.removeAttachment(attachmentId);
      expect(document.attachments).toHaveLength(0);

      // Test sharing settings
      document.setSharing('private', { allowedUsers: ['user1', 'user2'] });
      expect(document.canUserAccess('user1')).toBe(true);
      expect(document.canUserAccess('user3')).toBe(false);

      document.setSharing('organization');
      expect(document.canUserAccess('user3')).toBe(true);

      await em.persistAndFlush(document);
    });
  });

  describe('Concrete Record Entities', () => {
    it('should handle MeetingNotes with comprehensive meeting management', async () => {
      const em = orm.em.fork();

      const meeting = em.create(MeetingNotes, {
        title: 'Q1 Planning Meeting',
        content: 'Strategic planning session for Q1 objectives',
        meetingDate: new Date('2024-01-15'),
        durationMinutes: 120,
        meetingType: 'planning',
        location: 'Conference Room A'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      // Test attendee management
      meeting.addAttendee('user1', 'Alice Smith', 'Product Manager', 'present');
      meeting.addAttendee('user2', 'Bob Jones', 'Developer', 'late');
      meeting.markAttendeeStatus('user2', 'present');
      
      const stats = meeting.getAttendanceStats();
      expect(stats.total).toBe(2);
      expect(stats.present).toBe(2);

      // Test agenda management
      meeting.addAgendaItem('Review Q4 Results', 30, 'Alice');
      meeting.addAgendaItem('Q1 Objectives', 60, 'Bob');
      meeting.updateAgendaItemStatus(0, 'completed', 'Positive results discussed');
      
      const progress = meeting.getAgendaProgress();
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(50);

      // Test action item management
      const actionId = meeting.addActionItem(
        'Prepare Q1 roadmap',
        'Alice',
        new Date('2024-01-22'),
        'high'
      );
      
      meeting.updateActionItemStatus(actionId, 'in_progress', 'Started initial draft');
      const actionStats = meeting.getActionItemStats();
      expect(actionStats.total).toBe(1);
      expect(actionStats.inProgress).toBe(1);

      // Test decision tracking
      meeting.addDecision(
        'Proceed with mobile app development',
        'Market research supports mobile-first approach',
        'Alice',
        ['Web-first approach', 'Desktop application'],
        'high'
      );

      // Test meeting effectiveness metrics
      const effectiveness = meeting.getMeetingEffectiveness();
      expect(effectiveness.score).toBeGreaterThan(50);
      expect(effectiveness.factors.attendance).toBe(100);

      await em.persistAndFlush(meeting);
    });

    it('should handle TechnicalSpecification with requirements and architecture', async () => {
      const em = orm.em.fork();

      const spec = em.create(TechnicalSpecification, {
        title: 'User Authentication System',
        content: 'Complete specification for user authentication',
        specType: 'system'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      // Test requirement management
      spec.addFunctionalRequirement(
        'AUTH-001',
        'Users must be able to login with email and password',
        'must_have',
        ['Valid email format', 'Password meets complexity requirements']
      );

      spec.addNonFunctionalRequirement(
        'PERF-001',
        'performance',
        'Login process must complete within 2 seconds',
        '< 2 seconds'
      );

      spec.updateRequirementStatus('AUTH-001', 'approved');
      
      const reqStats = spec.getRequirementStats();
      expect(reqStats.total).toBe(2);
      expect(reqStats.approved).toBe(1);

      // Test architecture components
      spec.addComponent(
        'Authentication Service',
        'service',
        'Handles user authentication requests',
        ['Validate credentials', 'Generate tokens', 'Manage sessions']
      );

      spec.addDataFlow(
        'Client',
        'Authentication Service',
        'Login request with credentials',
        'HTTPS',
        'JSON'
      );

      // Test review management
      spec.addReviewer('architect1', 'architect');
      spec.addReviewer('security1', 'security');
      
      spec.submitReview('architect1', 'approved', 'Architecture looks solid');
      spec.submitReview('security1', 'needs_changes', 'Add MFA requirement');
      
      const reviewProgress = spec.getReviewProgress();
      expect(reviewProgress.total).toBe(2);
      expect(reviewProgress.approved).toBe(1);
      expect(reviewProgress.needsChanges).toBe(1);

      // Test specification quality assessment
      const quality = spec.getSpecificationQuality();
      expect(quality.score).toBeGreaterThan(50);
      expect(quality.factors.completeness).toBeGreaterThan(0);

      await em.persistAndFlush(spec);
    });

    it('should handle ProcessDocumentation with workflow and compliance', async () => {
      const em = orm.em.fork();

      const process = em.create(ProcessDocumentation, {
        title: 'Code Review Process',
        content: 'Standard process for code review in development',
        processType: 'technical',
        processCategory: 'Engineering',
        frequency: 'on_demand'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      // Test step management
      process.addStep(1, 'Create Pull Request', 'Developer creates PR with changes', 15);
      process.addStep(2, 'Assign Reviewers', 'Assign appropriate reviewers', 5);
      process.addStep(3, 'Code Review', 'Reviewers examine code and provide feedback', 30);

      process.addInputToStep(1, {
        name: 'Code Changes',
        type: 'data',
        required: true,
        description: 'Modified source code files'
      });

      process.addOutputToStep(3, {
        name: 'Review Feedback',
        type: 'data',
        description: 'Comments and approval status'
      });

      // Test role management
      process.addRole(
        'Developer',
        'Creates and modifies code',
        ['Write code', 'Create pull requests', 'Address feedback'],
        ['Programming', 'Version control']
      );

      process.assignRoleToStep(1, 'Developer');

      // Test compliance and quality controls
      process.addComplianceRegulation(
        'SOX Compliance',
        'Sarbanes-Oxley code review requirements',
        ['All financial code must be reviewed', 'Review history must be retained'],
        'annually'
      );

      process.addQualityControl(
        'Code Style Check',
        'automated_check',
        ['Follows style guide', 'No linting errors'],
        'CI System'
      );

      // Test audit management
      process.addAuditFinding(
        'Internal Auditor',
        'quality',
        [
          {
            type: 'observation',
            description: 'Review times could be improved',
            recommendation: 'Set SLA for review completion',
            status: 'open'
          }
        ]
      );

      // Test process health assessment
      const health = process.getProcessHealth();
      expect(health.score).toBeGreaterThan(50);
      expect(health.factors.documentation).toBeGreaterThan(0);

      // Test improvement suggestions
      process.addImprovementSuggestion(
        'dev1',
        'Implement automated code review for style checks',
        'time_saving',
        'medium'
      );

      process.reviewImprovementSuggestion(0, 'manager1', 'approved', 'Good suggestion, will implement');

      await em.persistAndFlush(process);
    });
  });

  describe('Concrete Document Entities', () => {
    it('should handle Proposal with business logic and decision tracking', async () => {
      const em = orm.em.fork();

      const proposal = em.create(Proposal, {
        title: 'Digital Transformation Initiative',
        content: 'Comprehensive digital transformation proposal',
        proposalType: 'business',
        problemStatement: 'Current systems are outdated and inefficient',
        proposedSolution: 'Implement modern cloud-based infrastructure',
        expectedOutcomes: 'Improved efficiency and reduced costs',
        executiveSummary: 'Strategic initiative to modernize our technology stack'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      // Test budget management
      proposal.addBudgetItem('Cloud Infrastructure', 500000, 'AWS/Azure migration costs', 'Required for scalability');
      proposal.addBudgetItem('Software Licenses', 200000, 'New software tools and platforms');
      proposal.addBudgetItem('Training', 100000, 'Staff training on new systems');

      expect(proposal.getTotalBudget()).toBe(800000);

      // Test stakeholder management
      proposal.addStakeholder('John Smith', 'sponsor', 'high', 'IT Department');
      proposal.addStakeholder('Jane Doe', 'approver', 'high', 'Executive Team');
      
      const keyStakeholders = proposal.getKeyStakeholders();
      expect(keyStakeholders).toHaveLength(2);

      // Test risk assessment
      proposal.addRisk(
        'Technology adoption challenges',
        'technical',
        'medium',
        'high',
        'Comprehensive training program and phased rollout'
      );

      const highRisks = proposal.getHighRisks();
      expect(highRisks).toHaveLength(1);

      // Test success criteria
      proposal.addSuccessCriterion(
        'Reduce processing time by 50%',
        true,
        'Average processing time',
        '< 30 minutes'
      );

      // Test decision tracking
      proposal.addDecision('approved', 'Executive Committee', 'Strategic alignment confirmed');
      expect(proposal.isApproved()).toBe(true);
      expect(proposal.status).toBe('approved');

      // Test proposal health assessment
      const health = proposal.getProposalHealth();
      expect(health.score).toBeGreaterThan(60);
      expect(health.factors.completeness).toBeGreaterThan(70);

      await em.persistAndFlush(proposal);
    });

    it('should handle UserManual with structured content and user feedback', async () => {
      const em = orm.em.fork();

      const manual = em.create(UserManual, {
        title: 'API Integration Guide',
        content: 'Comprehensive guide for integrating with our API',
        manualType: 'api',
        targetAudience: 'developer',
        productVersion: '2.1.0',
        difficultyLevel: 'intermediate'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      // Test section management
      const introId = manual.addSection(
        'Introduction',
        'Overview of the API and its capabilities',
        'overview'
      );

      const quickStartId = manual.addSection(
        'Quick Start',
        'Get up and running in 5 minutes',
        'procedure'
      );

      // Test procedure management
      const authProcedure = manual.addProcedure(
        'Authentication Setup',
        'How to authenticate API requests',
        [
          {
            stepNumber: 1,
            instruction: 'Obtain API key from dashboard',
            expectedResult: 'API key displayed in dashboard',
            tips: ['Save key securely', 'Never commit to version control']
          },
          {
            stepNumber: 2,
            instruction: 'Include key in Authorization header',
            expectedResult: 'Request authenticated successfully',
            warnings: ['Use HTTPS only']
          }
        ]
      );

      // Test troubleshooting
      manual.addTroubleshootingIssue(
        'API returns 401 Unauthorized',
        ['Request fails with 401 status', 'Error message about invalid credentials'],
        'Check API key is correctly included in Authorization header',
        ['Verify API key in dashboard', 'Check header format: "Bearer {api_key}"']
      );

      // Test FAQ
      manual.addFAQ(
        'What is the rate limit for API calls?',
        'The default rate limit is 1000 requests per hour per API key',
        'limits'
      );

      // Test glossary
      manual.addGlossaryTerm('API Key', 'Unique identifier used to authenticate API requests', 'authentication');
      manual.addGlossaryTerm('Rate Limit', 'Maximum number of requests allowed in a time period', 'limits');

      // Test user feedback
      manual.addUserFeedback('user1', 5, true, 'Very helpful guide!', introId);
      manual.addUserFeedback('user2', 4, true, 'Clear instructions', quickStartId);
      manual.addUserFeedback('user3', 3, false, 'Could use more examples');

      expect(manual.getAverageRating()).toBe(4);
      expect(manual.getHelpfulnessRatio()).toBeCloseTo(0.67, 2);

      // Test content search
      const searchResults = manual.searchContent('authentication');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].type).toBe('procedure');

      // Test manual health assessment
      const health = manual.getManualHealth();
      expect(health.score).toBeGreaterThan(70);
      expect(health.factors.completeness).toBeGreaterThan(80);

      await em.persistAndFlush(manual);
    });

    it('should handle Contract with legal terms and lifecycle management', async () => {
      const em = orm.em.fork();

      const contract = em.create(Contract, {
        title: 'Software Development Services Agreement',
        content: 'Agreement for custom software development services',
        contractType: 'service',
        executionDate: new Date('2024-01-01'),
        effectiveDate: new Date('2024-01-01'),
        expirationDate: new Date('2024-12-31'),
        jurisdiction: 'State of California',
        governingLaw: 'California State Law'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      // Test party management
      contract.addParty('TechCorp Inc.', 'corporation', 'client', {
        address: '123 Business St, San Francisco, CA',
        contactPerson: 'John Smith',
        email: 'john@techcorp.com'
      });

      contract.addParty('DevStudio LLC', 'corporation', 'vendor', {
        address: '456 Developer Ave, San Jose, CA',
        contactPerson: 'Jane Developer',
        email: 'jane@devstudio.com'
      });

      // Test financial terms
      contract.financials = {
        totalValue: 500000,
        currency: 'USD',
        paymentTerms: {
          schedule: [
            {
              description: 'Initial payment',
              amount: 100000,
              dueDate: new Date('2024-01-15'),
              status: 'paid'
            },
            {
              description: 'Milestone 1 payment',
              amount: 200000,
              dueDate: new Date('2024-06-01'),
              status: 'pending'
            },
            {
              description: 'Final payment',
              amount: 200000,
              dueDate: new Date('2024-11-30'),
              status: 'pending'
            }
          ],
          method: 'Wire transfer'
        }
      };

      // Test obligation management
      const devObligationId = contract.addObligation(
        'DevStudio LLC',
        'Deliver functional software according to specifications',
        'delivery',
        new Date('2024-10-31')
      );

      const clientObligationId = contract.addObligation(
        'TechCorp Inc.',
        'Provide necessary access and requirements',
        'performance',
        new Date('2024-02-01')
      );

      contract.updateObligationStatus(clientObligationId, 'completed');

      // Test deliverable management
      const deliverableId = contract.addDeliverable(
        'MVP Application',
        'Minimum viable product with core features',
        'DevStudio LLC',
        new Date('2024-06-01'),
        ['All core features implemented', 'Passes quality assurance testing']
      );

      // Test communication logging
      contract.addCommunication(
        'notice',
        'TechCorp Inc.',
        ['DevStudio LLC'],
        'Requirements Update',
        'Updated requirements document with additional features'
      );

      // Test contract status checks
      expect(contract.isActive()).toBe(true);
      expect(contract.isExpired()).toBe(false);
      expect(contract.isExpiringSoon(60)).toBe(false);

      // Test obligation tracking
      const overdueObligations = contract.getOverdueObligations();
      expect(overdueObligations.length).toBe(0);

      const upcomingObligations = contract.getUpcomingObligations(365);
      expect(upcomingObligations.length).toBeGreaterThan(0);

      // Test financial calculations
      expect(contract.getTotalContractValue()).toBe(500000);
      
      const outstanding = contract.getOutstandingPayments();
      expect(outstanding.length).toBe(2); // Two pending payments

      // Test completion tracking
      const completionRate = contract.calculateCompletionPercentage();
      expect(completionRate).toBe(50); // One of two obligations completed

      // Test contract health assessment
      const health = contract.getContractHealth();
      expect(health.score).toBeGreaterThan(70);
      expect(health.factors.compliance).toBeGreaterThan(80);

      await em.persistAndFlush(contract);
    });
  });

  describe('Integration with Phase 1 Universal Systems', () => {
    it('should integrate with universal relationship system', async () => {
      const em = orm.em.fork();

      const project = em.create(MeetingNotes, {
        title: 'Project Planning Meeting',
        content: 'Planning meeting for software project',
        meetingDate: new Date(),
        attendees: [{ userId: 'user1', name: 'Alice', status: 'present' }]
      });

      const spec = em.create(TechnicalSpecification, {
        title: 'Project Technical Specification',
        content: 'Technical requirements for the project',
        specType: 'system'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      const contract = em.create(Contract, {
        title: 'Development Contract',
        content: 'Contract for development services',
        contractType: 'service'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      await em.persistAndFlush([project, spec, contract]);

      // Test related entity management
      project.addRelatedEntity('TechnicalSpecification', spec.id, 'references', 'Meeting discusses this specification');
      spec.addRelatedEntity('Contract', contract.id, 'supports', 'Specification supports contract deliverables');

      expect(project.getRelatedEntities('references')).toHaveLength(1);
      expect(spec.getRelatedEntities('supports')).toHaveLength(1);

      await em.flush();
    });

    it('should integrate with universal labeling system', async () => {
      const em = orm.em.fork();

      const proposal = em.create(Proposal, {
        title: 'Infrastructure Upgrade Proposal',
        content: 'Proposal for upgrading IT infrastructure',
        proposalType: 'technical',
        problemStatement: 'Current infrastructure is outdated',
        proposedSolution: 'Upgrade to modern cloud infrastructure'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      const manual = em.create(UserManual, {
        title: 'Infrastructure Management Guide',
        content: 'Guide for managing IT infrastructure',
        manualType: 'technical',
        targetAudience: 'administrator'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      await em.persistAndFlush([proposal, manual]);

      // Test tag management (part of labeling system)
      proposal.addTag('infrastructure');
      proposal.addTag('cloud');
      proposal.addTag('upgrade');

      manual.addTag('infrastructure');
      manual.addTag('management');
      manual.addTag('documentation');

      // Test keyword management for search
      proposal.setKeywords(['infrastructure', 'cloud', 'aws', 'migration', 'scalability']);
      manual.setKeywords(['administration', 'monitoring', 'maintenance', 'troubleshooting']);

      expect(proposal.hasTag('infrastructure')).toBe(true);
      expect(manual.hasTag('infrastructure')).toBe(true);
      expect(proposal.keywords).toHaveLength(5);

      await em.flush();
    });

    it('should support container-based access control', async () => {
      const em = orm.em.fork();

      const meetingNotes = em.create(MeetingNotes, {
        title: 'Department Meeting',
        content: 'Quarterly department review',
        meetingDate: new Date(),
        attendees: [{ userId: 'user1', name: 'Manager', status: 'present' }]
      });

      const processDoc = em.create(ProcessDocumentation, {
        title: 'Department Process',
        content: 'Standard operating procedure for department',
        processType: 'operational',
        processCategory: 'HR'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      // Test container-based organization
      expect(meetingNotes.containerType).toBe('flexible');
      expect(processDoc.containerType).toBe('flexible');

      // Both can belong to projects, departments, etc.
      meetingNotes.containerId = 'dept-123';
      processDoc.containerId = 'dept-123';

      await em.persistAndFlush([meetingNotes, processDoc]);
    });
  });

  describe('Cross-Archetype Business Workflows', () => {
    it('should support comprehensive business workflows across record and document types', async () => {
      const em = orm.em.fork();

      // Create a complete business workflow involving multiple archetype types
      
      // 1. Meeting notes that identify a need
      const planningMeeting = em.create(MeetingNotes, {
        title: 'Q2 Planning Meeting',
        content: 'Discussed need for new customer portal',
        meetingDate: new Date('2024-03-01'),
        meetingType: 'planning',
        attendees: [
          { userId: 'pm1', name: 'Product Manager', status: 'present' },
          { userId: 'eng1', name: 'Engineering Lead', status: 'present' }
        ]
      });

      planningMeeting.addDecision(
        'Proceed with customer portal development',
        'Customer feedback indicates strong need',
        'Product Manager',
        ['Enhance existing portal', 'Third-party solution'],
        'high'
      );

      // 2. Proposal created based on meeting decision
      const proposal = em.create(Proposal, {
        title: 'Customer Portal Development Proposal',
        content: 'Proposal to develop new customer self-service portal',
        proposalType: 'technical',
        problemStatement: 'Customers need better self-service capabilities',
        proposedSolution: 'Develop modern web-based customer portal'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      proposal.addBudgetItem('Development Team', 300000, 'Full-stack developers for 6 months');
      proposal.addSuccessCriterion('Reduce support tickets by 40%', true, 'Support ticket count', '< 60% of current');

      // 3. Technical specification created after proposal approval
      const specification = em.create(TechnicalSpecification, {
        title: 'Customer Portal Technical Specification',
        content: 'Detailed technical requirements for customer portal',
        specType: 'system'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      specification.addFunctionalRequirement(
        'PORTAL-001',
        'Users can view account information',
        'must_have',
        ['Account balance displayed', 'Transaction history available']
      );

      specification.addComponent(
        'Authentication Service',
        'service',
        'Handles customer authentication',
        ['Validate credentials', 'Manage sessions', 'Support SSO']
      );

      // 4. Process documentation for development workflow
      const devProcess = em.create(ProcessDocumentation, {
        title: 'Customer Portal Development Process',
        content: 'Development workflow for customer portal project',
        processType: 'technical',
        processCategory: 'Engineering'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'record'
      }); 

      devProcess.addStep(1, 'Requirements Review', 'Review and validate requirements with stakeholders');
      devProcess.addStep(2, 'Technical Design', 'Create detailed technical design documents');
      devProcess.addStep(3, 'Implementation', 'Develop portal features according to specification');

      // 5. User manual for the completed system
      const userManual = em.create(UserManual, {
        title: 'Customer Portal User Guide',
        content: 'Guide for customers using the new portal',
        manualType: 'software',
        targetAudience: 'end_user',
        productVersion: '1.0'
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      userManual.addSection('Getting Started', 'How to access and login to the portal', 'overview');
      userManual.addProcedure(
        'View Account Balance',
        'Check your current account balance',
        [
          { stepNumber: 1, instruction: 'Login to the portal', expectedResult: 'Dashboard displayed' },
          { stepNumber: 2, instruction: 'Click on Account tab', expectedResult: 'Account details shown' }
        ]
      );

      // 6. Contract for any external services
      const contract = em.create(Contract, {
        title: 'Customer Portal Hosting Agreement',
        content: 'Agreement for cloud hosting services',
        contractType: 'service',
        effectiveDate: new Date('2024-06-01'),
        expirationDate: new Date('2025-05-31')
      ,
        version: 1,
        containerId: 'test-container',
        containerType: 'project',
        archetype: 'document'
      }); 

      contract.addParty('Our Company', 'corporation', 'client');
      contract.addParty('CloudHost Inc.', 'corporation', 'vendor');
      contract.addObligation('CloudHost Inc.', 'Provide 99.9% uptime SLA', 'performance');

      await em.persistAndFlush([
        planningMeeting, 
        proposal, 
        specification, 
        devProcess, 
        userManual, 
        contract
      ]);

      // Test cross-references between documents
      proposal.addRelatedEntity('MeetingNotes', planningMeeting.id, 'derives_from', 'Based on planning meeting decision');
      specification.addRelatedEntity('Proposal', proposal.id, 'derives_from', 'Implements approved proposal');
      devProcess.addRelatedEntity('TechnicalSpecification', specification.id, 'supports', 'Process for implementing specification');
      userManual.addRelatedEntity('TechnicalSpecification', specification.id, 'documents', 'User guide for specified system');
      contract.addRelatedEntity('Proposal', proposal.id, 'supports', 'Hosting services for proposed system');

      // Verify workflow integrity
      expect(proposal.getRelatedEntities('derives_from')).toHaveLength(1);
      expect(specification.getRelatedEntities('derives_from')).toHaveLength(1);
      expect(devProcess.getRelatedEntities('supports')).toHaveLength(1);
      expect(userManual.getRelatedEntities('documents')).toHaveLength(1);
      expect(contract.getRelatedEntities('supports')).toHaveLength(1);

      await em.flush();
    });
  });
});