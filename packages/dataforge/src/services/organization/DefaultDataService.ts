import { SoftwareProject } from '../../entities/projects/SoftwareProject.js';
import { MarketingCampaign } from '../../entities/projects/MarketingCampaign.js';
import { ResearchProject } from '../../entities/projects/ResearchProject.js';
import { UserStory } from '../../entities/tasks/UserStory.js';
import { Bug } from '../../entities/tasks/Bug.js';
import { MaintenanceTask } from '../../entities/tasks/MaintenanceTask.js';
import { MeetingNotes } from '../../entities/records/MeetingNotes.js';
import { TechnicalSpecification } from '../../entities/records/TechnicalSpecification.js';
import { Proposal } from '../../entities/documents/Proposal.js';
import { UserManual } from '../../entities/documents/UserManual.js';
import { SourceCode } from '../../entities/files/SourceCode.js';
import { Documentation } from '../../entities/files/Documentation.js';
import { Forum } from '../../entities/discussions/Forum.js';
import { Thread } from '../../entities/discussions/Thread.js';
import { Announcement } from '../../entities/discussions/Announcement.js';
import { Dashboard } from '../../entities/collections/Dashboard.js';
import { EntityRelationship } from '../../entities/EntityRelationship.js';
import { Label } from '../../entities/Label.js';
import { EntityLabel } from '../../entities/EntityLabel.js';
import { OrganizationTemplate } from './OrganizationSetupService.js';

/**
 * Default data service for creating sample data in new organizations
 * Generates realistic business data with proper relationships between archetypes
 * Co-located in DataForge for type safety and entity access
 */
export class DefaultDataService {

  /**
   * Create sample data for a new organization based on template
   */
  async createDefaultData(organizationId: string, template: OrganizationTemplate, userId: string): Promise<DefaultDataResult> {
    const result: DefaultDataResult = {
      organizationId,
      template,
      createdEntities: {
        projects: [],
        tasks: [],
        records: [],
        documents: [],
        files: [],
        discussions: [],
        collections: [],
        relationships: [],
        labels: []
      },
      success: false,
      errors: []
    };

    try {
      // Create template-specific sample data
      switch (template) {
        case 'software_team':
          await this.createSoftwareTeamData(result, userId);
          break;
        case 'marketing_agency':
          await this.createMarketingAgencyData(result, userId);
          break;
        case 'consulting_firm':
          await this.createConsultingFirmData(result, userId);
          break;
        case 'research_lab':
          await this.createResearchLabData(result, userId);
          break;
        default:
          await this.createGenericBusinessData(result, userId);
      }

      // Create universal labels
      await this.createUniversalLabels(result, userId);

      // Create entity relationships
      await this.createEntityRelationships(result, userId);

      // Create sample dashboard
      await this.createSampleDashboard(result, userId);

      result.success = true;
    } catch (error) {
      result.errors.push(`Default data creation failed: ${error}`);
    }

    return result;
  }

  /**
   * Create software team sample data
   */
  private async createSoftwareTeamData(result: DefaultDataResult, userId: string): Promise<void> {
    // Create sample software projects
    const webAppProject = this.createSoftwareProject({
      name: 'Customer Portal Web Application',
      description: 'Modern React-based customer portal with real-time features',
      repository: 'https://github.com/company/customer-portal',
      techStack: 'React, TypeScript, Node.js, PostgreSQL',
      deploymentUrl: 'https://portal.company.com',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-06-30'),
      budget: 150000,
      status: 'active',
      progressPercentage: 65,
      userId
    });

    const mobileAppProject = this.createSoftwareProject({
      name: 'Mobile App MVP',
      description: 'Cross-platform mobile application for iOS and Android',
      repository: 'https://github.com/company/mobile-app',
      techStack: 'React Native, TypeScript, Firebase',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-08-15'),
      budget: 80000,
      status: 'active',
      progressPercentage: 25,
      userId
    });

    const apiRefactorProject = this.createSoftwareProject({
      name: 'API Architecture Refactoring',
      description: 'Modernize legacy API with microservices architecture',
      repository: 'https://github.com/company/api-refactor',
      techStack: 'Node.js, Docker, Kubernetes, GraphQL',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-05-30'),
      budget: 120000,
      status: 'planning',
      progressPercentage: 10,
      userId
    });

    result.createdEntities.projects.push(webAppProject, mobileAppProject, apiRefactorProject);

    // Create sample user stories and bugs
    const userStories = [
      this.createUserStory({
        title: 'User Dashboard with Real-time Notifications',
        description: 'As a user, I want to see real-time notifications on my dashboard so I can stay updated with important information',
        acceptanceCriteria: ['Real-time WebSocket connection', 'Notification toast system', 'Mark as read functionality'],
        storyPoints: 8,
        priority: 'high',
        status: 'in_progress',
        projectId: webAppProject.id,
        userId
      }),
      this.createUserStory({
        title: 'Mobile Authentication Flow',
        description: 'As a mobile user, I want to authenticate using biometrics so I can access the app securely',
        acceptanceCriteria: ['Biometric authentication', 'Fallback to PIN', 'Session management'],
        storyPoints: 13,
        priority: 'high',
        status: 'todo',
        projectId: mobileAppProject.id,
        userId
      }),
      this.createUserStory({
        title: 'GraphQL API Design',
        description: 'As a developer, I want a unified GraphQL API so I can efficiently query data',
        acceptanceCriteria: ['Schema design', 'Resolver implementation', 'Performance optimization'],
        storyPoints: 21,
        priority: 'medium',
        status: 'todo',
        projectId: apiRefactorProject.id,
        userId
      })
    ];

    const bugs = [
      this.createBug({
        title: 'Dashboard Loading Performance Issue',
        description: 'Dashboard takes 8+ seconds to load with large datasets',
        severity: 'high',
        reproducibility: 'always',
        environment: 'Production',
        stepsToReproduce: ['Login to application', 'Navigate to dashboard', 'Observe loading time'],
        status: 'in_progress',
        projectId: webAppProject.id,
        userId
      }),
      this.createBug({
        title: 'Mobile App Crashes on iOS 17',
        description: 'App crashes immediately on startup for iOS 17 devices',
        severity: 'critical',
        reproducibility: 'always',
        environment: 'iOS 17',
        stepsToReproduce: ['Install app on iOS 17 device', 'Launch app', 'App crashes'],
        status: 'todo',
        projectId: mobileAppProject.id,
        userId
      })
    ];

    result.createdEntities.tasks.push(...userStories, ...bugs);

    // Create technical documentation
    const techSpecs = [
      this.createTechnicalSpecification({
        title: 'Real-time Notification System Architecture',
        requirements: ['WebSocket connection management', 'Event routing', 'Offline support'],
        architecture: 'Event-driven architecture with Redis pub/sub',
        dependencies: ['Redis', 'Socket.io', 'JWT authentication'],
        reviewStatus: 'approved',
        projectId: webAppProject.id,
        userId
      }),
      this.createTechnicalSpecification({
        title: 'Mobile App Security Architecture',
        requirements: ['Biometric authentication', 'Certificate pinning', 'Data encryption'],
        architecture: 'Zero-trust security model with JWT tokens',
        dependencies: ['React Native Keychain', 'Crypto libraries'],
        reviewStatus: 'pending',
        projectId: mobileAppProject.id,
        userId
      })
    ];

    result.createdEntities.records.push(...techSpecs);

    // Create sample source code files
    const codeFiles = [
      this.createSourceCode({
        filename: 'NotificationService.ts',
        language: 'typescript',
        framework: 'Node.js',
        repository: webAppProject.repository!,
        path: '/src/services/NotificationService.ts',
        linesOfCode: 245,
        complexity: 'medium',
        testCoverage: 85,
        projectId: webAppProject.id,
        userId
      }),
      this.createSourceCode({
        filename: 'AuthProvider.tsx',
        language: 'typescript',
        framework: 'React Native',
        repository: mobileAppProject.repository!,
        path: '/src/providers/AuthProvider.tsx',
        linesOfCode: 180,
        complexity: 'low',
        testCoverage: 92,
        projectId: mobileAppProject.id,
        userId
      })
    ];

    result.createdEntities.files.push(...codeFiles);

    // Create team discussions
    const discussions = [
      this.createThread({
        title: 'WebSocket vs Server-Sent Events for Real-time Features',
        content: 'We need to decide between WebSocket and SSE for our real-time notification system. What are the pros and cons?',
        authorId: userId,
        status: 'active',
        projectId: webAppProject.id
      }),
      this.createThread({
        title: 'iOS 17 Compatibility Issues',
        content: 'Has anyone encountered crashes on iOS 17? We\'re seeing consistent crashes on startup.',
        authorId: userId,
        status: 'active',
        projectId: mobileAppProject.id
      })
    ];

    result.createdEntities.discussions.push(...discussions);
  }

  /**
   * Create marketing agency sample data
   */
  private async createMarketingAgencyData(result: DefaultDataResult, userId: string): Promise<void> {
    // Create sample marketing campaigns
    const brandCampaign = this.createMarketingCampaign({
      name: 'Q2 Brand Awareness Campaign',
      description: 'Multi-channel brand awareness campaign targeting millennials',
      targetAudience: 'Millennials aged 25-35 interested in technology',
      budget: 75000,
      channels: ['social-media', 'influencer', 'content-marketing'],
      conversionGoals: 'Increase brand awareness by 40%, generate 500 qualified leads',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30'),
      status: 'active',
      progressPercentage: 45,
      userId
    });

    const productLaunchCampaign = this.createMarketingCampaign({
      name: 'New Product Launch Campaign',
      description: 'Comprehensive launch campaign for innovative SaaS product',
      targetAudience: 'B2B decision makers in mid-market companies',
      budget: 120000,
      channels: ['digital-advertising', 'email', 'webinars', 'pr'],
      conversionGoals: 'Generate 1000 sign-ups in first 30 days',
      startDate: new Date('2024-05-15'),
      endDate: new Date('2024-08-15'),
      status: 'planning',
      progressPercentage: 15,
      userId
    });

    result.createdEntities.projects.push(brandCampaign, productLaunchCampaign);

    // Create creative tasks
    const creativeTasks = [
      this.createUserStory({
        title: 'Social Media Creative Assets',
        description: 'Design engaging social media visuals for brand awareness campaign',
        acceptanceCriteria: ['Instagram posts (5)', 'Facebook ads (3)', 'LinkedIn banners (2)'],
        storyPoints: 5,
        priority: 'high',
        status: 'in_progress',
        projectId: brandCampaign.id,
        userId
      }),
      this.createUserStory({
        title: 'Product Demo Video Script',
        description: 'Write compelling script for 2-minute product demonstration video',
        acceptanceCriteria: ['60-second version', '2-minute version', 'Voiceover notes'],
        storyPoints: 3,
        priority: 'medium',
        status: 'todo',
        projectId: productLaunchCampaign.id,
        userId
      })
    ];

    result.createdEntities.tasks.push(...creativeTasks);

    // Create campaign documentation
    const proposals = [
      this.createProposal({
        title: 'Q2 Brand Awareness Campaign Strategy',
        proposalType: 'marketing',
        budget: 75000,
        deadline: new Date('2024-03-15'),
        approvalStatus: 'approved',
        projectId: brandCampaign.id,
        userId
      }),
      this.createProposal({
        title: 'Product Launch Media Strategy',
        proposalType: 'marketing',
        budget: 120000,
        deadline: new Date('2024-05-01'),
        approvalStatus: 'pending',
        projectId: productLaunchCampaign.id,
        userId
      })
    ];

    result.createdEntities.documents.push(...proposals);
  }

  /**
   * Create consulting firm sample data
   */
  private async createConsultingFirmData(result: DefaultDataResult, userId: string): Promise<void> {
    // Create sample consulting projects
    const strategyProject = this.createResearchProject({
      name: 'Digital Transformation Strategy',
      description: 'Comprehensive digital transformation roadmap for Fortune 500 client',
      hypothesis: 'Digital transformation will increase operational efficiency by 30%',
      methodology: 'Mixed-methods approach with stakeholder interviews and data analysis',
      expectedOutcomes: 'Strategic roadmap, implementation plan, ROI projections',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-04-30'),
      budget: 200000,
      status: 'active',
      progressPercentage: 70,
      userId
    });

    const operationsProject = this.createResearchProject({
      name: 'Operations Efficiency Optimization',
      description: 'Process improvement initiative for manufacturing operations',
      hypothesis: 'Lean methodology implementation will reduce waste by 25%',
      methodology: 'Value stream mapping and statistical analysis',
      expectedOutcomes: 'Process optimization recommendations, training plan',
      startDate: new Date('2024-02-15'),
      endDate: new Date('2024-07-15'),
      budget: 150000,
      status: 'active',
      progressPercentage: 40,
      userId
    });

    result.createdEntities.projects.push(strategyProject, operationsProject);

    // Create consulting deliverables
    const deliverables = [
      this.createUserStory({
        title: 'Current State Assessment Report',
        description: 'Comprehensive analysis of current digital capabilities and gaps',
        acceptanceCriteria: ['Technology audit', 'Process mapping', 'Gap analysis'],
        storyPoints: 8,
        priority: 'high',
        status: 'completed',
        projectId: strategyProject.id,
        userId
      }),
      this.createUserStory({
        title: 'Future State Vision Document',
        description: 'Detailed vision and roadmap for digital transformation',
        acceptanceCriteria: ['Vision statement', '3-year roadmap', 'Success metrics'],
        storyPoints: 13,
        priority: 'high',
        status: 'in_progress',
        projectId: strategyProject.id,
        userId
      })
    ];

    result.createdEntities.tasks.push(...deliverables);

    // Create meeting notes
    const meetingNotes = [
      this.createMeetingNotes({
        title: 'Client Stakeholder Kickoff Meeting',
        meetingDate: new Date('2024-01-05'),
        attendees: ['Client CTO', 'Client Operations Director', 'Lead Consultant', 'Project Manager'],
        actionItems: ['Schedule technology audit', 'Gather current process documentation', 'Set up weekly check-ins'],
        decisions: ['Project scope confirmed', 'Timeline approved', 'Access to systems granted'],
        projectId: strategyProject.id,
        userId
      })
    ];

    result.createdEntities.records.push(...meetingNotes);
  }

  /**
   * Create research lab sample data
   */
  private async createResearchLabData(result: DefaultDataResult, userId: string): Promise<void> {
    // Create sample research projects
    const clinicalStudy = this.createResearchProject({
      name: 'AI-Assisted Drug Discovery Platform',
      description: 'Machine learning platform for accelerating drug discovery processes',
      hypothesis: 'AI can reduce drug discovery timeline by 40% while maintaining safety standards',
      methodology: 'Controlled study with ML algorithms and traditional methods comparison',
      expectedOutcomes: 'Validated AI platform, published research paper, patent application',
      startDate: new Date('2023-09-01'),
      endDate: new Date('2024-12-31'),
      budget: 500000,
      status: 'active',
      progressPercentage: 60,
      userId
    });

    const basicResearch = this.createResearchProject({
      name: 'Quantum Computing Applications in Cryptography',
      description: 'Exploring quantum-resistant cryptographic algorithms',
      hypothesis: 'Quantum computing will require new cryptographic approaches by 2030',
      methodology: 'Theoretical analysis and simulation studies',
      expectedOutcomes: 'Research publications, proof-of-concept algorithms',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-06-30'),
      budget: 300000,
      status: 'active',
      progressPercentage: 25,
      userId
    });

    result.createdEntities.projects.push(clinicalStudy, basicResearch);

    // Create research tasks
    const researchTasks = [
      this.createUserStory({
        title: 'Literature Review on AI Drug Discovery',
        description: 'Comprehensive review of current AI applications in pharmaceutical research',
        acceptanceCriteria: ['50+ paper analysis', 'Comparative study', 'Gap identification'],
        storyPoints: 13,
        priority: 'high',
        status: 'completed',
        projectId: clinicalStudy.id,
        userId
      }),
      this.createUserStory({
        title: 'Quantum Algorithm Prototype',
        description: 'Develop and test prototype quantum-resistant encryption algorithm',
        acceptanceCriteria: ['Algorithm design', 'Security analysis', 'Performance testing'],
        storyPoints: 21,
        priority: 'high',
        status: 'in_progress',
        projectId: basicResearch.id,
        userId
      })
    ];

    result.createdEntities.tasks.push(...researchTasks);
  }

  /**
   * Create generic business sample data
   */
  private async createGenericBusinessData(result: DefaultDataResult, userId: string): Promise<void> {
    // Create sample business projects
    const operationsProject = this.createSoftwareProject({
      name: 'Customer Service Process Improvement',
      description: 'Streamline customer service workflows and implement new ticketing system',
      techStack: 'Zendesk, Slack integration, Analytics dashboard',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-05-31'),
      budget: 50000,
      status: 'active',
      progressPercentage: 35,
      userId
    });

    result.createdEntities.projects.push(operationsProject);

    // Create basic tasks
    const basicTasks = [
      this.createUserStory({
        title: 'Current Process Documentation',
        description: 'Document existing customer service processes and identify inefficiencies',
        acceptanceCriteria: ['Process flowcharts', 'Pain point analysis', 'Stakeholder interviews'],
        storyPoints: 5,
        priority: 'high',
        status: 'completed',
        projectId: operationsProject.id,
        userId
      }),
      this.createUserStory({
        title: 'New Ticketing System Implementation',
        description: 'Configure and deploy new customer service ticketing system',
        acceptanceCriteria: ['System setup', 'User training', 'Data migration'],
        storyPoints: 8,
        priority: 'high',
        status: 'in_progress',
        projectId: operationsProject.id,
        userId
      })
    ];

    result.createdEntities.tasks.push(...basicTasks);
  }

  /**
   * Create universal labels for all templates
   */
  private async createUniversalLabels(result: DefaultDataResult, userId: string): Promise<void> {
    const labels = [
      this.createLabel({
        name: 'High Priority',
        color: '#DC2626',
        description: 'Items requiring immediate attention',
        category: 'priority',
        userId
      }),
      this.createLabel({
        name: 'Client Facing',
        color: '#2563EB',
        description: 'Items that directly impact client experience',
        category: 'impact',
        userId
      }),
      this.createLabel({
        name: 'Technical Debt',
        color: '#7C2D12',
        description: 'Technical improvements needed for long-term maintainability',
        category: 'technical',
        userId
      }),
      this.createLabel({
        name: 'Innovation',
        color: '#7C3AED',
        description: 'Experimental or innovative initiatives',
        category: 'type',
        userId
      }),
      this.createLabel({
        name: 'Dependencies',
        color: '#F59E0B',
        description: 'Items with external dependencies',
        category: 'status',
        userId
      })
    ];

    result.createdEntities.labels.push(...labels);
  }

  /**
   * Create sample entity relationships
   */
  private async createEntityRelationships(result: DefaultDataResult, userId: string): Promise<void> {
    // Create relationships between projects and tasks
    if (result.createdEntities.projects.length > 0 && result.createdEntities.tasks.length > 0) {
      const relationships = result.createdEntities.tasks.map(task => 
        this.createEntityRelationship({
          sourceEntityId: task.id,
          sourceEntityType: 'task',
          targetEntityId: (task as any).projectId,
          targetEntityType: 'project',
          relationshipType: 'belongs_to',
          description: 'Task belongs to project',
          userId
        })
      );

      result.createdEntities.relationships.push(...relationships);
    }

    // Create dependencies between tasks
    if (result.createdEntities.tasks.length >= 2) {
      const dependencyRelationship = this.createEntityRelationship({
        sourceEntityId: result.createdEntities.tasks[0].id,
        sourceEntityType: 'task',
        targetEntityId: result.createdEntities.tasks[1].id,
        targetEntityType: 'task',
        relationshipType: 'depends_on',
        description: 'Task dependency for sequential work',
        userId
      });

      result.createdEntities.relationships.push(dependencyRelationship);
    }
  }

  /**
   * Create sample dashboard for organization overview
   */
  private async createSampleDashboard(result: DefaultDataResult, userId: string): Promise<void> {
    const dashboard = this.createDashboard({
      name: 'Organization Overview Dashboard',
      description: 'High-level overview of all projects, tasks, and key metrics',
      layout: 'grid',
      widgets: [
        {
          type: 'project_status',
          title: 'Project Status Overview',
          position: { x: 0, y: 0, width: 6, height: 4 },
          config: { showCompleted: true }
        },
        {
          type: 'task_metrics',
          title: 'Task Completion Metrics',
          position: { x: 6, y: 0, width: 6, height: 4 },
          config: { timeframe: 'last_30_days' }
        },
        {
          type: 'recent_activity',
          title: 'Recent Activity',
          position: { x: 0, y: 4, width: 12, height: 6 },
          config: { limit: 20 }
        }
      ],
      filters: {
        timeframe: 'last_30_days',
        includedArchetypes: ['project', 'task'],
        visibility: 'organization'
      },
      userId
    });

    result.createdEntities.collections.push(dashboard);
  }

  // Entity creation helper methods
  private createSoftwareProject(data: any): SoftwareProject {
    const project = new SoftwareProject();
    Object.assign(project, {
      id: this.generateId(),
      name: data.name,
      description: data.description,
      repository: data.repository,
      techStack: data.techStack,
      deploymentUrl: data.deploymentUrl,
      startDate: data.startDate,
      endDate: data.endDate,
      budget: data.budget,
      status: data.status,
      progressPercentage: data.progressPercentage,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: 'default-workspace',
      containerType: 'workspace'
    });
    return project;
  }

  private createMarketingCampaign(data: any): MarketingCampaign {
    const campaign = new MarketingCampaign();
    Object.assign(campaign, {
      id: this.generateId(),
      name: data.name,
      description: data.description,
      targetAudience: data.targetAudience,
      budget: data.budget,
      channels: data.channels,
      conversionGoals: data.conversionGoals,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      progressPercentage: data.progressPercentage,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: 'default-workspace',
      containerType: 'workspace'
    });
    return campaign;
  }

  private createResearchProject(data: any): ResearchProject {
    const project = new ResearchProject();
    Object.assign(project, {
      id: this.generateId(),
      name: data.name,
      description: data.description,
      hypothesis: data.hypothesis,
      methodology: data.methodology,
      expectedOutcomes: data.expectedOutcomes,
      startDate: data.startDate,
      endDate: data.endDate,
      budget: data.budget,
      status: data.status,
      progressPercentage: data.progressPercentage,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: 'default-workspace',
      containerType: 'workspace'
    });
    return project;
  }

  private createUserStory(data: any): UserStory {
    const story = new UserStory();
    Object.assign(story, {
      id: this.generateId(),
      title: data.title,
      description: data.description,
      acceptanceCriteria: data.acceptanceCriteria,
      storyPoints: data.storyPoints,
      priority: data.priority,
      status: data.status,
      projectId: data.projectId,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return story;
  }

  private createBug(data: any): Bug {
    const bug = new Bug();
    Object.assign(bug, {
      id: this.generateId(),
      title: data.title,
      description: data.description,
      severity: data.severity,
      reproducibility: data.reproducibility,
      environment: data.environment,
      stepsToReproduce: data.stepsToReproduce,
      status: data.status,
      projectId: data.projectId,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return bug;
  }

  private createTechnicalSpecification(data: any): TechnicalSpecification {
    const spec = new TechnicalSpecification();
    Object.assign(spec, {
      id: this.generateId(),
      title: data.title,
      requirements: data.requirements,
      architecture: data.architecture,
      dependencies: data.dependencies,
      reviewStatus: data.reviewStatus,
      projectId: data.projectId,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return spec;
  }

  private createMeetingNotes(data: any): MeetingNotes {
    const notes = new MeetingNotes();
    Object.assign(notes, {
      id: this.generateId(),
      title: data.title,
      meetingDate: data.meetingDate,
      attendees: data.attendees,
      actionItems: data.actionItems,
      decisions: data.decisions,
      projectId: data.projectId,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return notes;
  }

  private createProposal(data: any): Proposal {
    const proposal = new Proposal();
    Object.assign(proposal, {
      id: this.generateId(),
      title: data.title,
      proposalType: data.proposalType,
      budget: data.budget,
      deadline: data.deadline,
      approvalStatus: data.approvalStatus,
      projectId: data.projectId,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return proposal;
  }

  private createSourceCode(data: any): SourceCode {
    const code = new SourceCode();
    Object.assign(code, {
      id: this.generateId(),
      filename: data.filename,
      language: data.language,
      framework: data.framework,
      repository: data.repository,
      path: data.path,
      linesOfCode: data.linesOfCode,
      complexity: data.complexity,
      testCoverage: data.testCoverage,
      projectId: data.projectId,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return code;
  }

  private createThread(data: any): Thread {
    const thread = new Thread();
    Object.assign(thread, {
      id: this.generateId(),
      title: data.title,
      content: data.content,
      authorId: data.authorId,
      status: data.status,
      projectId: data.projectId,
      createdBy: data.authorId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: data.projectId,
      containerType: 'project'
    });
    return thread;
  }

  private createDashboard(data: any): Dashboard {
    const dashboard = new Dashboard();
    Object.assign(dashboard, {
      id: this.generateId(),
      name: data.name,
      description: data.description,
      layout: data.layout,
      widgets: data.widgets,
      filters: data.filters,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      containerId: 'organization',
      containerType: 'organization'
    });
    return dashboard;
  }

  private createLabel(data: any): Label {
    const label = new Label();
    Object.assign(label, {
      id: this.generateId(),
      name: data.name,
      color: data.color,
      description: data.description,
      category: data.category,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return label;
  }

  private createEntityRelationship(data: any): EntityRelationship {
    const relationship = new EntityRelationship();
    Object.assign(relationship, {
      id: this.generateId(),
      sourceEntityId: data.sourceEntityId,
      sourceEntityType: data.sourceEntityType,
      targetEntityId: data.targetEntityId,
      targetEntityType: data.targetEntityType,
      relationshipType: data.relationshipType,
      description: data.description,
      createdBy: data.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return relationship;
  }

  private generateId(): string {
    return `default_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type definitions for default data creation

export interface DefaultDataResult {
  organizationId: string;
  template: OrganizationTemplate;
  createdEntities: {
    projects: any[];
    tasks: any[];
    records: any[];
    documents: any[];
    files: any[];
    discussions: any[];
    collections: any[];
    relationships: any[];
    labels: any[];
  };
  success: boolean;
  errors: string[];
}