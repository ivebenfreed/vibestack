import { describe, it, expect, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { 
  // Phase 1 entities
  Project, Task,
  // Phase 2 entities
  SourceCode, Documentation, Media,
  Deployment, Testing, Review,
  Forum, Thread, Announcement,
  Dashboard
} from '../../entities/index.js';

describe('Phase 2: Complete Archetype Integration Test', () => {
  let orm: MikroORM;

  beforeEach(async () => {
    orm = await MikroORM.init({
      driver: SqliteDriver,
      dbName: ':memory:',
      entities: [
        Project, Task,
        SourceCode, Documentation, Media,
        Deployment, Testing, Review,
        Forum, Thread, Announcement,
        Dashboard
      ],
      forceUtcTimezone: true,
      allowGlobalContext: true,
      debug: false
    });

    await orm.schema.refreshDatabase();
  });

  it('should successfully create and integrate all archetype entities', async () => {
    const em = orm.em.fork();

    // Phase 1 entities (baseline)
    const project = em.create(Project, {
      name: 'Phase 2 Integration Test Project',
      description: 'Testing all archetype integrations',
      projectType: 'software',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'project'
    });

    const task = em.create(Task, {
      title: 'Test Task',
      description: 'Testing task integration',
      status: 'todo',
      priority: 'medium',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'task'
    });

    // File archetype entities
    const sourceCode = em.create(SourceCode, {
      filename: 'test.js',
      content: 'console.log("Hello World");',
      programmingLanguage: 'javascript',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'file'
    });

    const documentation = em.create(Documentation, {
      filename: 'README.md',
      content: '# Test Project Documentation',
      documentType: 'user_guide',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'file'
    });

    const media = em.create(Media, {
      filename: 'logo.png',
      content: 'binary-data',
      mediaType: 'image',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'file'
    });

    // Activity archetype entities
    const deployment = em.create(Deployment, {
      name: 'Production Deploy',
      description: 'Deploy to production environment',
      deploymentType: 'blue_green',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'activity'
    });

    const testing = em.create(Testing, {
      name: 'Integration Tests',
      description: 'Run full integration test suite',
      testType: 'integration',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'activity'
    });

    const review = em.create(Review, {
      name: 'Code Review',
      description: 'Review new feature implementation',
      reviewType: 'code',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'activity'
    });

    // Discussion archetype entities
    const forum = em.create(Forum, {
      title: 'Project Discussion',
      content: 'Main discussion forum for the project',
      forumCategory: 'technical',
      topicType: 'discussion',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'discussion'
    });

    const thread = em.create(Thread, {
      title: 'Implementation Thread',
      content: 'Discussion about implementation details',
      threadType: 'discussion',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'discussion'
    });

    const announcement = em.create(Announcement, {
      title: 'Project Launch',
      content: 'Official project launch announcement',
      announcementType: 'general',
      priority: 'high',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'discussion'
    });

    // Collection archetype entity (Dashboard)
    const dashboard = em.create(Dashboard, {
      name: 'Project Dashboard',
      description: 'Main project dashboard with all metrics',
      dashboardType: 'project',
      version: 1,
      containerId: 'test-container',
      containerType: 'project',
      archetype: 'collection'
    });

    // Persist all entities
    await em.persistAndFlush([
      project, task,
      sourceCode, documentation, media,
      deployment, testing, review,
      forum, thread, announcement,
      dashboard
    ]);

    // Verify all entities have proper IDs
    expect(project.id).toBeDefined();
    expect(task.id).toBeDefined();
    expect(sourceCode.id).toBeDefined();
    expect(documentation.id).toBeDefined();
    expect(media.id).toBeDefined();
    expect(deployment.id).toBeDefined();
    expect(testing.id).toBeDefined();
    expect(review.id).toBeDefined();
    expect(forum.id).toBeDefined();
    expect(thread.id).toBeDefined();
    expect(announcement.id).toBeDefined();
    expect(dashboard.id).toBeDefined();

    // Verify archetype types
    expect(project.archetype).toBe('project');
    expect(task.archetype).toBe('task');
    expect(sourceCode.archetype).toBe('file');
    expect(documentation.archetype).toBe('file');
    expect(media.archetype).toBe('file');
    expect(deployment.archetype).toBe('activity');
    expect(testing.archetype).toBe('activity');
    expect(review.archetype).toBe('activity');
    expect(forum.archetype).toBe('discussion');
    expect(thread.archetype).toBe('discussion');
    expect(announcement.archetype).toBe('discussion');
    expect(dashboard.archetype).toBe('collection');

    // Test abstract method implementations
    expect(sourceCode.getFileType()).toBe('source_code');
    expect(documentation.getFileType()).toBe('documentation');
    expect(media.getFileType()).toBe('media');
    
    expect(deployment.getActivityType()).toBe('deployment');
    expect(testing.getActivityType()).toBe('testing');
    expect(review.getActivityType()).toBe('review');

    expect(forum.getDiscussionType()).toBe('forum');
    expect(thread.getDiscussionType()).toBe('thread');
    expect(announcement.getDiscussionType()).toBe('announcement');

    expect(dashboard.getCollectionType()).toBe('dashboard');

    // Test cross-archetype collection integration
    dashboard.addCollectionItem('project', project.id);
    dashboard.addCollectionItem('task', task.id);
    dashboard.addCollectionItem('file', sourceCode.id);
    dashboard.addCollectionItem('activity', deployment.id);
    dashboard.addCollectionItem('discussion', forum.id);

    expect(dashboard.collectionItems).toHaveLength(5);

    // Test dashboard insights generation
    await dashboard.generateInsights();
    expect(dashboard.aiInsights).toBeDefined();
    expect(dashboard.crossArchetypeAnalysis).toBeDefined();

    await em.flush();

    console.log('✅ Phase 2 Complete: All archetype entities successfully integrated');
    console.log(`- Project: ${project.id}`);
    console.log(`- File entities: ${sourceCode.id}, ${documentation.id}, ${media.id}`);
    console.log(`- Activity entities: ${deployment.id}, ${testing.id}, ${review.id}`);
    console.log(`- Discussion entities: ${forum.id}, ${thread.id}, ${announcement.id}`);
    console.log(`- Collection entity (Dashboard): ${dashboard.id}`);
  });

  it('should demonstrate cross-archetype business workflow integration', async () => {
    const em = orm.em.fork();

    // Create a complete business workflow using all archetype types
    const project = em.create(Project, {
      name: 'E-commerce Platform',
      description: 'New e-commerce platform development',
      projectType: 'software',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'project'
    });

    // Related files for the project
    const apiDoc = em.create(Documentation, {
      filename: 'api-spec.md',
      content: '# E-commerce API Specification',
      documentType: 'api_documentation',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'file'
    });

    const sourceFile = em.create(SourceCode, {
      filename: 'payment.js',
      content: 'class PaymentProcessor { /* implementation */ }',
      programmingLanguage: 'javascript',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'file'
    });

    // Development activities
    const codeReview = em.create(Review, {
      name: 'Payment Module Review',
      description: 'Security review of payment processing code',
      reviewType: 'security',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'activity'
    });

    const testRun = em.create(Testing, {
      name: 'Payment Security Tests',
      description: 'Comprehensive security testing of payment flows',
      testType: 'security',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'activity'
    });

    const deploy = em.create(Deployment, {
      name: 'Production Deployment',
      description: 'Deploy payment module to production',
      deploymentType: 'canary',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'activity'
    });

    // Team collaboration
    const techForum = em.create(Forum, {
      title: 'Technical Architecture Discussion',
      content: 'Discuss architectural decisions for the platform',
      forumCategory: 'technical',
      topicType: 'discussion',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'discussion'
    });

    const launchAnnouncement = em.create(Announcement, {
      title: 'E-commerce Platform Go-Live',
      content: 'The new e-commerce platform is now live!',
      announcementType: 'milestone',
      priority: 'high',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'discussion'
    });

    // Project dashboard collecting all components
    const projectDashboard = em.create(Dashboard, {
      name: 'E-commerce Project Dashboard',
      description: 'Complete project oversight and metrics',
      dashboardType: 'project',
      version: 1,
      containerId: 'ecommerce-project',
      containerType: 'project',
      archetype: 'collection'
    });

    await em.persistAndFlush([
      project, apiDoc, sourceFile,
      codeReview, testRun, deploy,
      techForum, launchAnnouncement,
      projectDashboard
    ]);

    // Build cross-archetype relationships
    project.addRelatedEntity('file', apiDoc.id, 'includes');
    project.addRelatedEntity('file', sourceFile.id, 'includes');
    project.addRelatedEntity('activity', codeReview.id, 'requires');
    project.addRelatedEntity('activity', testRun.id, 'requires');
    project.addRelatedEntity('activity', deploy.id, 'results_in');
    project.addRelatedEntity('discussion', techForum.id, 'supports');
    project.addRelatedEntity('discussion', launchAnnouncement.id, 'announces');

    // Dashboard aggregates all project components
    projectDashboard.addCollectionItem('project', project.id);
    projectDashboard.addCollectionItem('file', apiDoc.id);
    projectDashboard.addCollectionItem('file', sourceFile.id);
    projectDashboard.addCollectionItem('activity', codeReview.id);
    projectDashboard.addCollectionItem('activity', testRun.id);
    projectDashboard.addCollectionItem('activity', deploy.id);
    projectDashboard.addCollectionItem('discussion', techForum.id);
    projectDashboard.addCollectionItem('discussion', launchAnnouncement.id);

    // Generate cross-archetype insights
    await projectDashboard.generateInsights();

    // Verify complete workflow integration
    expect(project.getRelatedEntities('includes')).toHaveLength(2); // 2 files
    expect(project.getRelatedEntities('requires')).toHaveLength(2); // 2 activities
    expect(project.getRelatedEntities('results_in')).toHaveLength(1); // 1 deployment
    expect(project.getRelatedEntities('supports')).toHaveLength(1); // 1 forum
    expect(project.getRelatedEntities('announces')).toHaveLength(1); // 1 announcement

    expect(projectDashboard.collectionItems).toHaveLength(8); // All components
    expect(projectDashboard.crossArchetypeAnalysis).toBeDefined();
    expect(projectDashboard.aiInsights).toBeDefined();

    await em.flush();

    console.log('✅ Cross-archetype business workflow successfully integrated');
    console.log(`Dashboard collected ${projectDashboard.collectionItems?.length} items across all archetype types`);
  });
});