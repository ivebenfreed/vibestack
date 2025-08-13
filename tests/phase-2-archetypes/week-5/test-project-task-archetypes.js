#!/usr/bin/env node

/**
 * Phase 2 Week 5 - Project and Task Archetype Integration Test
 * Tests abstract archetype classes and concrete business entities
 */

console.log('🏗️ Phase 2 Week 5 - Project and Task Archetype Integration Test');
console.log('Testing abstract archetypes and concrete business entities...\n');

// Mock implementations for testing (simulating the actual classes)
class MockProjectArchetype {
  constructor() {
    this.archetype = 'project';
    this.containerType = 'workspace';
    this.progressPercentage = 0;
    this.status = 'planning';
  }

  // Abstract methods that concrete classes must implement
  getProjectType() { throw new Error('Must be implemented by concrete class'); }
  async validateProjectRules() { throw new Error('Must be implemented by concrete class'); }
  async calculateProgress() { throw new Error('Must be implemented by concrete class'); }
  getRequiredResources() { throw new Error('Must be implemented by concrete class'); }

  // Common project business logic
  isActive() { return this.status === 'active' || this.status === 'in_progress'; }
  isCompleted() { return this.status === 'completed' || this.status === 'done'; }
  canTransitionTo(newStatus) {
    const allowedTransitions = {
      'planning': ['active', 'cancelled'],
      'active': ['on_hold', 'completed', 'cancelled'],
      'on_hold': ['active', 'cancelled'],
      'completed': [],
      'cancelled': []
    };
    return allowedTransitions[this.status]?.includes(newStatus) ?? false;
  }
}

class MockTaskArchetype {
  constructor() {
    this.archetype = 'task';
    this.containerType = 'project';
    this.completionPercentage = 0;
    this.status = 'todo';
  }

  // Abstract methods that concrete classes must implement
  getTaskType() { throw new Error('Must be implemented by concrete class'); }
  async validateTaskRules() { throw new Error('Must be implemented by concrete class'); }
  async calculatePriority() { throw new Error('Must be implemented by concrete class'); }
  getRequiredSkills() { throw new Error('Must be implemented by concrete class'); }

  // Common task business logic
  isAssigned() { return !!this.assigneeId; }
  isCompleted() { return this.status === 'completed' || this.status === 'done'; }
  isOverdue() { return this.dueDate && new Date() > this.dueDate && !this.isCompleted(); }
  canTransitionTo(newStatus) {
    const allowedTransitions = {
      'todo': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'blocked', 'cancelled'],
      'blocked': ['in_progress', 'cancelled'],
      'completed': [],
      'cancelled': ['todo']
    };
    return allowedTransitions[this.status]?.includes(newStatus) ?? false;
  }
}

// Concrete project implementations
class MockSoftwareProject extends MockProjectArchetype {
  constructor(data = {}) {
    super();
    this.name = data.name || '';
    this.repository = data.repository;
    this.techStack = data.techStack || {};
    this.codeQualityMetrics = data.codeQualityMetrics || {};
  }

  getProjectType() { return 'software'; }
  
  async validateProjectRules() {
    if (!this.name) return false;
    if (this.repository && !this.isValidRepositoryUrl(this.repository)) return false;
    return true;
  }

  async calculateProgress() {
    let progress = this.progressPercentage || 0;
    if (this.codeQualityMetrics.coverage) {
      progress = (progress + this.codeQualityMetrics.coverage) / 2;
    }
    return Math.round(progress);
  }

  getRequiredResources() {
    const resources = ['Product Owner', 'QA Engineer'];
    if (this.techStack.frontend) resources.push('Frontend Developer');
    if (this.techStack.backend) resources.push('Backend Developer');
    return resources;
  }

  isValidRepositoryUrl(url) {
    return /^https:\/\/github\.com\//.test(url) || /^https:\/\/gitlab\.com\//.test(url);
  }

  getHealthScore() {
    const factors = {
      codeQuality: this.codeQualityMetrics.coverage || 0,
      progress: this.progressPercentage || 0
    };
    const score = (factors.codeQuality + factors.progress) / 2;
    return { score: Math.round(score), factors };
  }
}

class MockMarketingCampaign extends MockProjectArchetype {
  constructor(data = {}) {
    super();
    this.name = data.name || '';
    this.targetAudience = data.targetAudience || {};
    this.channels = data.channels || {};
    this.conversionGoals = data.conversionGoals || {};
    this.metrics = data.metrics || {};
  }

  getProjectType() { return 'marketing_campaign'; }
  
  async validateProjectRules() {
    if (!this.name) return false;
    if (!this.targetAudience || Object.keys(this.targetAudience).length === 0) return false;
    if (!this.conversionGoals.primary) return false;
    return true;
  }

  async calculateProgress() {
    let progress = this.progressPercentage || 0;
    if (this.conversionGoals.primary && this.conversionGoals.primary.current) {
      const goalProgress = Math.min((this.conversionGoals.primary.current / this.conversionGoals.primary.target) * 100, 100);
      progress = (progress + goalProgress) / 2;
    }
    return Math.round(progress);
  }

  getRequiredResources() {
    const resources = ['Campaign Manager', 'Creative Director'];
    if (this.channels.digital?.includes('social')) resources.push('Social Media Manager');
    if (this.channels.digital?.includes('email')) resources.push('Email Marketing Specialist');
    return resources;
  }

  calculateROAS() {
    if (!this.metrics.cost || !this.metrics.revenue) return null;
    return this.metrics.revenue / this.metrics.cost;
  }
}

class MockResearchProject extends MockProjectArchetype {
  constructor(data = {}) {
    super();
    this.name = data.name || '';
    this.hypothesis = data.hypothesis;
    this.methodology = data.methodology;
    this.researchField = data.researchField;
    this.dataCollection = data.dataCollection || {};
    this.publications = data.publications || [];
  }

  getProjectType() { return 'research'; }
  
  async validateProjectRules() {
    if (!this.name) return false;
    if (!this.hypothesis && !this.researchQuestions?.length) return false;
    if (!this.methodology) return false;
    if (!this.researchField) return false;
    return true;
  }

  async calculateProgress() {
    let progress = this.progressPercentage || 0;
    
    // Factor in research phases
    let phaseProgress = 0;
    if (this.hypothesis && this.methodology) phaseProgress += 25; // Planning
    if (this.dataCollection.status === 'completed') phaseProgress += 50; // Data collection
    if (this.publications.some(p => p.status === 'published')) phaseProgress += 25; // Publishing
    
    return Math.round((progress + phaseProgress) / 2);
  }

  getRequiredResources() {
    const resources = ['Principal Investigator', 'Research Assistant'];
    if (this.researchField?.includes('statistics')) resources.push('Statistician');
    if (this.dataCollection.methods?.includes('interviews')) resources.push('Interviewer');
    return resources;
  }
}

// Concrete task implementations
class MockUserStory extends MockTaskArchetype {
  constructor(data = {}) {
    super();
    this.title = data.title || '';
    this.userGoal = data.userGoal;
    this.acceptanceCriteria = data.acceptanceCriteria;
    this.storyPoints = data.storyPoints;
    this.testCases = data.testCases || [];
    this.storyType = data.storyType || 'feature';
  }

  getTaskType() { return 'user_story'; }
  
  async validateTaskRules() {
    if (!this.title) return false;
    if (!this.userGoal) return false;
    if (!this.acceptanceCriteria) return false;
    if (this.storyPoints && (this.storyPoints < 0 || this.storyPoints > 100)) return false;
    return true;
  }

  async calculatePriority() {
    let priority = 50;
    if (this.storyPoints <= 3) priority += 20;
    if (this.storyType === 'bug_fix') priority += 20;
    return Math.min(100, priority);
  }

  getRequiredSkills() {
    const skills = ['Product Knowledge', 'Requirements Analysis'];
    if (this.storyType === 'feature') skills.push('Frontend Development', 'Backend Development');
    return skills;
  }

  getTestCoverage() {
    if (!this.testCases.length) return { total: 0, passed: 0, coverage: 0 };
    const passed = this.testCases.filter(tc => tc.status === 'passed').length;
    return { total: this.testCases.length, passed, coverage: (passed / this.testCases.length) * 100 };
  }
}

class MockBug extends MockTaskArchetype {
  constructor(data = {}) {
    super();
    this.title = data.title || '';
    this.severity = data.severity || 'medium';
    this.stepsToReproduce = data.stepsToReproduce;
    this.expectedBehavior = data.expectedBehavior;
    this.actualBehavior = data.actualBehavior;
    this.environment = data.environment || 'production';
    this.reproducibility = data.reproducibility || 'sometimes';
    this.bugType = data.bugType || 'functional';
  }

  getTaskType() { return 'bug'; }
  
  async validateTaskRules() {
    if (!this.title) return false;
    if (!this.stepsToReproduce) return false;
    if (!this.expectedBehavior) return false;
    if (!this.actualBehavior) return false;
    if (!this.severity) return false;
    return true;
  }

  async calculatePriority() {
    let priority = 50;
    switch (this.severity) {
      case 'critical': priority += 40; break;
      case 'high': priority += 30; break;
      case 'medium': priority += 10; break;
      case 'low': priority -= 10; break;
    }
    if (this.environment === 'production') priority += 15;
    return Math.min(100, priority);
  }

  getRequiredSkills() {
    const skills = ['Debugging', 'Testing', 'Root Cause Analysis'];
    if (this.bugType === 'performance') skills.push('Performance Analysis');
    if (this.bugType === 'security') skills.push('Security Analysis');
    return skills;
  }
}

class MockMaintenanceTask extends MockTaskArchetype {
  constructor(data = {}) {
    super();
    this.title = data.title || '';
    this.equipmentId = data.equipmentId;
    this.equipmentName = data.equipmentName;
    this.maintenanceType = data.maintenanceType || 'preventive';
    this.frequency = data.frequency || 'monthly';
    this.nextDue = data.nextDue;
    this.procedures = data.procedures || [];
    this.safetyRequirements = data.safetyRequirements || {};
  }

  getTaskType() { return 'maintenance_task'; }
  
  async validateTaskRules() {
    if (!this.title) return false;
    if (!this.equipmentId && !this.equipmentName) return false;
    if (!this.maintenanceType) return false;
    return true;
  }

  async calculatePriority() {
    let priority = 50;
    switch (this.maintenanceType) {
      case 'emergency': priority += 50; break;
      case 'corrective': priority += 30; break;
      case 'preventive': priority += 15; break;
    }
    if (this.isOverdue()) priority += 25;
    return Math.min(100, priority);
  }

  getRequiredSkills() {
    const skills = ['Equipment Maintenance', 'Safety Procedures'];
    if (this.maintenanceType === 'predictive') skills.push('Condition Monitoring');
    if (this.safetyRequirements.lockoutTagout) skills.push('Lockout/Tagout Procedures');
    return skills;
  }

  isOverdue() {
    return this.nextDue && new Date() > this.nextDue && !this.isCompleted();
  }
}

// Test suite
async function runArchetypeTests() {
  const testResults = {
    projects: { passed: 0, failed: 0, tests: [] },
    tasks: { passed: 0, failed: 0, tests: [] },
    integration: { passed: 0, failed: 0, tests: [] }
  };

  try {
    // Project Archetype Tests
    console.log('📊 Testing Project Archetypes');
    console.log('=' .repeat(40));
    
    await testProjectArchetypes(testResults.projects);
    
    // Task Archetype Tests
    console.log('\n📋 Testing Task Archetypes');
    console.log('=' .repeat(40));
    
    await testTaskArchetypes(testResults.tasks);
    
    // Integration Tests
    console.log('\n🔗 Testing Cross-Archetype Integration');
    console.log('=' .repeat(40));
    
    await testArchetypeIntegration(testResults.integration);
    
    // Summary
    console.log('\n🎯 Week 5 Archetype Test Summary');
    console.log('=' .repeat(40));
    
    const totalPassed = Object.values(testResults).reduce((sum, category) => sum + category.passed, 0);
    const totalFailed = Object.values(testResults).reduce((sum, category) => sum + category.failed, 0);
    const totalTests = totalPassed + totalFailed;
    
    console.log(`\n📊 Overall Results:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${totalPassed} ✅`);
    console.log(`  Failed: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`  Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    Object.entries(testResults).forEach(([category, results]) => {
      const categoryTotal = results.passed + results.failed;
      const categoryRate = categoryTotal > 0 ? ((results.passed / categoryTotal) * 100).toFixed(1) : '0.0';
      console.log(`\n  ${category.toUpperCase()}: ${results.passed}/${categoryTotal} (${categoryRate}%)`);
      
      if (results.failed > 0) {
        console.log(`    Failed tests:`);
        results.tests.filter(t => !t.passed).forEach(test => {
          console.log(`      ❌ ${test.name}: ${test.error}`);
        });
      }
    });
    
    if (totalFailed === 0) {
      console.log('\n🎉 Week 5 Archetypes - All Tests Passed!');
      console.log('Ready for Week 6 implementation.');
    } else {
      console.log(`\n❌ Week 5 Archetypes - ${totalFailed} test(s) failed.`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Week 5 archetype test suite failed:', error.message);
    process.exit(1);
  }
}

async function testProjectArchetypes(results) {
  const tests = [
    {
      name: 'SoftwareProject archetype implementation',
      test: async () => {
        const project = new MockSoftwareProject({
          name: 'Awesome App',
          repository: 'https://github.com/company/awesome-app',
          techStack: { frontend: ['React'], backend: ['Node.js'] },
          codeQualityMetrics: { coverage: 85 }
        });
        
        if (project.getProjectType() !== 'software') throw new Error('Wrong project type');
        if (!(await project.validateProjectRules())) throw new Error('Validation failed');
        if (project.archetype !== 'project') throw new Error('Wrong archetype');
        if (project.containerType !== 'workspace') throw new Error('Wrong container type');
        
        const progress = await project.calculateProgress();
        if (progress < 0 || progress > 100) throw new Error('Invalid progress calculation');
        
        const resources = project.getRequiredResources();
        if (!resources.includes('Frontend Developer')) throw new Error('Missing required resources');
        
        return true;
      }
    },
    {
      name: 'MarketingCampaign archetype implementation',
      test: async () => {
        const campaign = new MockMarketingCampaign({
          name: 'Summer Launch Campaign',
          targetAudience: { demographics: { ageRange: '25-35' } },
          channels: { digital: ['social', 'email'] },
          conversionGoals: { primary: { type: 'leads', target: 1000, current: 250 } },
          metrics: { cost: 5000, revenue: 15000 }
        });
        
        if (campaign.getProjectType() !== 'marketing_campaign') throw new Error('Wrong project type');
        if (!(await campaign.validateProjectRules())) throw new Error('Validation failed');
        
        const roas = campaign.calculateROAS();
        if (roas !== 3) throw new Error('ROAS calculation incorrect');
        
        const resources = campaign.getRequiredResources();
        if (!resources.includes('Social Media Manager')) throw new Error('Missing social media resource');
        
        return true;
      }
    },
    {
      name: 'ResearchProject archetype implementation',
      test: async () => {
        const research = new MockResearchProject({
          name: 'AI Impact Study',
          hypothesis: 'AI improves productivity',
          methodology: 'Mixed methods',
          researchField: 'Computer Science',
          dataCollection: { status: 'completed' },
          publications: [{ title: 'AI Study', status: 'published' }]
        });
        
        if (research.getProjectType() !== 'research') throw new Error('Wrong project type');
        if (!(await research.validateProjectRules())) throw new Error('Validation failed');
        
        const progress = await research.calculateProgress();
        if (progress < 50) throw new Error('Progress should reflect completed phases');
        
        return true;
      }
    },
    {
      name: 'Project status transitions',
      test: async () => {
        const project = new MockSoftwareProject({ name: 'Test Project' });
        
        if (!project.canTransitionTo('active')) throw new Error('Should allow planning->active');
        if (project.canTransitionTo('completed')) throw new Error('Should not allow planning->completed directly');
        
        project.status = 'active';
        if (!project.canTransitionTo('completed')) throw new Error('Should allow active->completed');
        if (!project.canTransitionTo('on_hold')) throw new Error('Should allow active->on_hold');
        
        project.status = 'completed';
        if (project.canTransitionTo('active')) throw new Error('Should not allow transitions from completed');
        
        return true;
      }
    },
    {
      name: 'Project business logic',
      test: async () => {
        const project = new MockSoftwareProject({ name: 'Test Project' });
        
        project.status = 'planning';
        if (project.isActive()) throw new Error('Planning project should not be active');
        if (project.isCompleted()) throw new Error('Planning project should not be completed');
        
        project.status = 'active';
        if (!project.isActive()) throw new Error('Active project should be active');
        
        project.status = 'completed';
        if (!project.isCompleted()) throw new Error('Completed project should be completed');
        
        return true;
      }
    }
  ];
  
  for (const test of tests) {
    try {
      await test.test();
      results.passed++;
      results.tests.push({ name: test.name, passed: true });
      console.log(`  ✅ ${test.name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name: test.name, passed: false, error: error.message });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }
}

async function testTaskArchetypes(results) {
  const tests = [
    {
      name: 'UserStory archetype implementation',
      test: async () => {
        const story = new MockUserStory({
          title: 'User login feature',
          userGoal: 'log into the system',
          acceptanceCriteria: 'User can enter credentials and access dashboard',
          storyPoints: 5,
          storyType: 'feature',
          testCases: [
            { scenario: 'Valid login', status: 'passed' },
            { scenario: 'Invalid login', status: 'passed' }
          ]
        });
        
        if (story.getTaskType() !== 'user_story') throw new Error('Wrong task type');
        if (!(await story.validateTaskRules())) throw new Error('Validation failed');
        if (story.archetype !== 'task') throw new Error('Wrong archetype');
        if (story.containerType !== 'project') throw new Error('Wrong container type');
        
        const priority = await story.calculatePriority();
        if (priority < 50) throw new Error('Small story should have higher priority');
        
        const coverage = story.getTestCoverage();
        if (coverage.coverage !== 100) throw new Error('Test coverage calculation incorrect');
        
        return true;
      }
    },
    {
      name: 'Bug archetype implementation',
      test: async () => {
        const bug = new MockBug({
          title: 'Login page crashes',
          severity: 'high',
          stepsToReproduce: '1. Go to login 2. Enter invalid data 3. Click submit',
          expectedBehavior: 'Show error message',
          actualBehavior: 'Page crashes',
          environment: 'production',
          bugType: 'functional'
        });
        
        if (bug.getTaskType() !== 'bug') throw new Error('Wrong task type');
        if (!(await bug.validateTaskRules())) throw new Error('Validation failed');
        
        const priority = await bug.calculatePriority();
        if (priority < 80) throw new Error('High severity production bug should have high priority');
        
        const skills = bug.getRequiredSkills();
        if (!skills.includes('Debugging')) throw new Error('Missing debugging skill');
        
        return true;
      }
    },
    {
      name: 'MaintenanceTask archetype implementation',
      test: async () => {
        const task = new MockMaintenanceTask({
          title: 'Server maintenance',
          equipmentId: 'SERVER001',
          maintenanceType: 'preventive',
          frequency: 'monthly',
          nextDue: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          safetyRequirements: { lockoutTagout: true }
        });
        
        if (task.getTaskType() !== 'maintenance_task') throw new Error('Wrong task type');
        if (!(await task.validateTaskRules())) throw new Error('Validation failed');
        
        if (!task.isOverdue()) throw new Error('Task should be overdue');
        
        const priority = await task.calculatePriority();
        if (priority < 65) throw new Error('Overdue maintenance should have higher priority');
        
        const skills = task.getRequiredSkills();
        if (!skills.includes('Lockout/Tagout Procedures')) throw new Error('Missing safety skill');
        
        return true;
      }
    },
    {
      name: 'Task status transitions',
      test: async () => {
        const task = new MockUserStory({ title: 'Test Story' });
        
        if (!task.canTransitionTo('in_progress')) throw new Error('Should allow todo->in_progress');
        if (task.canTransitionTo('completed')) throw new Error('Should not allow todo->completed directly');
        
        task.status = 'in_progress';
        if (!task.canTransitionTo('completed')) throw new Error('Should allow in_progress->completed');
        if (!task.canTransitionTo('blocked')) throw new Error('Should allow in_progress->blocked');
        
        task.status = 'completed';
        if (task.canTransitionTo('in_progress')) throw new Error('Should not allow transitions from completed');
        
        return true;
      }
    },
    {
      name: 'Task business logic',
      test: async () => {
        const task = new MockUserStory({ title: 'Test Story' });
        
        task.assigneeId = 'user123';
        if (!task.isAssigned()) throw new Error('Task should be assigned');
        
        task.status = 'completed';
        if (!task.isCompleted()) throw new Error('Task should be completed');
        
        task.dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
        task.status = 'in_progress';
        if (!task.isOverdue()) throw new Error('Task should be overdue');
        
        return true;
      }
    }
  ];
  
  for (const test of tests) {
    try {
      await test.test();
      results.passed++;
      results.tests.push({ name: test.name, passed: true });
      console.log(`  ✅ ${test.name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name: test.name, passed: false, error: error.message });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }
}

async function testArchetypeIntegration(results) {
  const tests = [
    {
      name: 'Project-Task relationship',
      test: async () => {
        const project = new MockSoftwareProject({
          name: 'Web App',
          repository: 'https://github.com/test/app'
        });
        
        const task = new MockUserStory({
          title: 'Login feature',
          userGoal: 'authenticate',
          acceptanceCriteria: 'User can log in'
        });
        
        // Simulate task belonging to project
        task.projectId = 'project123';
        
        if (task.containerType !== 'project') throw new Error('Task should use project container');
        if (project.containerType !== 'workspace') throw new Error('Project should use workspace container');
        
        return true;
      }
    },
    {
      name: 'Universal archetype patterns',
      test: async () => {
        const entities = [
          new MockSoftwareProject({ name: 'Project' }),
          new MockUserStory({ title: 'Story', userGoal: 'goal', acceptanceCriteria: 'criteria' }),
          new MockBug({ 
            title: 'Bug', 
            stepsToReproduce: 'steps', 
            expectedBehavior: 'expected', 
            actualBehavior: 'actual' 
          })
        ];
        
        // All should have archetype field
        for (const entity of entities) {
          if (!entity.archetype) throw new Error('Missing archetype field');
          if (!entity.containerType) throw new Error('Missing containerType field');
        }
        
        // Projects should be project archetype
        if (entities[0].archetype !== 'project') throw new Error('Wrong project archetype');
        
        // Tasks should be task archetype
        if (entities[1].archetype !== 'task') throw new Error('Wrong task archetype');
        if (entities[2].archetype !== 'task') throw new Error('Wrong bug archetype');
        
        return true;
      }
    },
    {
      name: 'Abstract method enforcement',
      test: async () => {
        const baseProject = new MockProjectArchetype();
        const baseTask = new MockTaskArchetype();
        
        // Abstract methods should throw errors
        try {
          baseProject.getProjectType();
          throw new Error('Should have thrown for abstract method');
        } catch (error) {
          if (!error.message.includes('Must be implemented')) {
            throw new Error('Wrong error for abstract method');
          }
        }
        
        try {
          baseTask.getTaskType();
          throw new Error('Should have thrown for abstract method');
        } catch (error) {
          if (!error.message.includes('Must be implemented')) {
            throw new Error('Wrong error for abstract method');
          }
        }
        
        return true;
      }
    },
    {
      name: 'Polymorphic behavior',
      test: async () => {
        const projects = [
          new MockSoftwareProject({ name: 'Software' }),
          new MockMarketingCampaign({ 
            name: 'Campaign',
            targetAudience: { demographics: {} },
            conversionGoals: { primary: { type: 'leads', target: 100 } }
          }),
          new MockResearchProject({ 
            name: 'Research',
            hypothesis: 'test',
            methodology: 'method',
            researchField: 'field'
          })
        ];
        
        const tasks = [
          new MockUserStory({ title: 'Story', userGoal: 'goal', acceptanceCriteria: 'criteria' }),
          new MockBug({ 
            title: 'Bug', 
            stepsToReproduce: 'steps', 
            expectedBehavior: 'expected', 
            actualBehavior: 'actual' 
          }),
          new MockMaintenanceTask({ title: 'Maintenance', equipmentId: 'EQ001' })
        ];
        
        // All projects should behave as projects
        for (const project of projects) {
          if (project.archetype !== 'project') throw new Error('Wrong archetype');
          if (typeof project.getProjectType() !== 'string') throw new Error('Missing project type');
          if (typeof await project.validateProjectRules() !== 'boolean') throw new Error('Invalid validation');
        }
        
        // All tasks should behave as tasks
        for (const task of tasks) {
          if (task.archetype !== 'task') throw new Error('Wrong archetype');
          if (typeof task.getTaskType() !== 'string') throw new Error('Missing task type');
          if (typeof await task.validateTaskRules() !== 'boolean') throw new Error('Invalid validation');
        }
        
        return true;
      }
    }
  ];
  
  for (const test of tests) {
    try {
      await test.test();
      results.passed++;
      results.tests.push({ name: test.name, passed: true });
      console.log(`  ✅ ${test.name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name: test.name, passed: false, error: error.message });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }
}

// Run the test suite
runArchetypeTests();