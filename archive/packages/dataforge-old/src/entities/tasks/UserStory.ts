import { Entity, Property } from '@mikro-orm/core';
import { TaskArchetype } from '../archetypes/TaskArchetype.js';

/**
 * User Story for agile development with story-specific fields and workflows
 * Extends TaskArchetype with agile development business logic
 */
@Entity({ tableName: 'user_story' })
export class UserStory extends TaskArchetype {
  @Property({ type: 'text', nullable: true, fieldName: 'acceptance_criteria' })
  acceptanceCriteria?: string;

  @Property({ type: 'integer', nullable: true, fieldName: 'story_points' })
  storyPoints?: number;

  @Property({ type: 'uuid', nullable: true, fieldName: 'epic_id' })
  epicId?: string;

  @Property({ nullable: true, fieldName: 'user_persona' })
  userPersona?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'user_goal' })
  userGoal?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'business_value' })
  businessValue?: string;

  @Property({ type: 'json', nullable: true })
  testCases?: Array<{
    scenario: string;
    given: string;
    when: string;
    then: string;
    status?: 'pending' | 'passed' | 'failed';
  }>;

  @Property({ nullable: true, fieldName: 'sprint_id' })
  sprintId?: string;

  @Property({ type: 'json', nullable: true })
  dependencies?: Array<{
    storyId: string;
    type: 'blocks' | 'depends_on' | 'relates_to';
    description?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'definition_of_done' })
  definitionOfDone?: string[];

  @Property({ nullable: true, fieldName: 'story_type' })
  storyType?: 'feature' | 'enhancement' | 'bug_fix' | 'technical_debt' | 'spike';

  @Property({ type: 'json', nullable: true })
  wireframes?: Array<{
    name: string;
    url: string;
    type: 'mockup' | 'wireframe' | 'prototype';
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'api_requirements' })
  apiRequirements?: Array<{
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    description: string;
    requestSchema?: any;
    responseSchema?: any;
  }>;

  @Property({ nullable: true, fieldName: 'ui_components' })
  uiComponents?: string[]; // List of UI components that need to be built

  // Implementation of abstract methods
  getTaskType(): string {
    return 'user_story';
  }

  async validateTaskRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // User story specific validation
    if (!this.userGoal || this.userGoal.trim().length === 0) {
      return false; // User goal is required for user stories
    }

    if (this.storyPoints && (this.storyPoints < 0 || this.storyPoints > 100)) {
      return false; // Story points should be reasonable
    }

    if (!this.acceptanceCriteria || this.acceptanceCriteria.trim().length === 0) {
      return false; // Acceptance criteria required
    }

    // Validate test cases format
    if (this.testCases) {
      for (const testCase of this.testCases) {
        if (!testCase.scenario || !testCase.given || !testCase.when || !testCase.then) {
          return false; // All BDD components required
        }
      }
    }

    return true;
  }

  async calculatePriority(): Promise<number> {
    let priorityScore = 50; // Base priority

    // Factor 1: Story points (complexity affects priority)
    if (this.storyPoints) {
      if (this.storyPoints <= 3) priorityScore += 20; // Small stories higher priority
      else if (this.storyPoints >= 8) priorityScore -= 10; // Large stories lower priority
    }

    // Factor 2: Business value
    if (this.businessValue) {
      const businessValueLength = this.businessValue.length;
      if (businessValueLength > 100) priorityScore += 15; // Well-defined business value
    }

    // Factor 3: Dependencies
    if (this.dependencies?.length) {
      const blockingDeps = this.dependencies.filter(dep => dep.type === 'blocks');
      priorityScore += blockingDeps.length * 10; // Blocking stories higher priority
    }

    // Factor 4: Due date proximity
    if (this.dueDate) {
      const daysUntilDue = this.getTimeRemaining().days ?? 0;
      if (daysUntilDue <= 3) priorityScore += 25;
      else if (daysUntilDue <= 7) priorityScore += 15;
    }

    // Factor 5: Story type
    switch (this.storyType) {
      case 'bug_fix':
        priorityScore += 20;
        break;
      case 'feature':
        priorityScore += 10;
        break;
      case 'technical_debt':
        priorityScore -= 5;
        break;
      case 'spike':
        priorityScore -= 10;
        break;
    }

    return Math.max(0, Math.min(100, priorityScore));
  }

  getRequiredSkills(): string[] {
    const skills: string[] = [];

    // Skills based on story type
    switch (this.storyType) {
      case 'feature':
      case 'enhancement':
        skills.push('Frontend Development', 'Backend Development');
        break;
      case 'bug_fix':
        skills.push('Debugging', 'Testing');
        break;
      case 'technical_debt':
        skills.push('Code Refactoring', 'Architecture');
        break;
      case 'spike':
        skills.push('Research', 'Prototyping');
        break;
    }

    // Skills based on UI components
    if (this.uiComponents?.length) {
      skills.push('UI/UX Design', 'Frontend Development');
    }

    // Skills based on API requirements
    if (this.apiRequirements?.length) {
      skills.push('API Development', 'Backend Development');
    }

    // Skills based on wireframes
    if (this.wireframes?.length) {
      skills.push('UI/UX Design');
    }

    // Always need these for user stories
    skills.push('Product Knowledge', 'Requirements Analysis');

    return [...new Set(skills)]; // Remove duplicates
  }

  // User story specific business logic
  addTestCase(testCase: NonNullable<UserStory['testCases']>[0]): void {
    if (!this.testCases) {
      this.testCases = [];
    }
    this.testCases.push(testCase);
  }

  updateTestCaseStatus(scenario: string, status: NonNullable<NonNullable<UserStory['testCases']>[0]['status']>): void {
    const testCase = this.testCases?.find(tc => tc.scenario === scenario);
    if (testCase) {
      testCase.status = status;
    }
  }

  getTestCoverage(): { total: number; passed: number; failed: number; pending: number; coverage: number } {
    if (!this.testCases || this.testCases.length === 0) {
      return { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 };
    }

    const total = this.testCases.length;
    const passed = this.testCases.filter(tc => tc.status === 'passed').length;
    const failed = this.testCases.filter(tc => tc.status === 'failed').length;
    const pending = this.testCases.filter(tc => !tc.status || tc.status === 'pending').length;
    const coverage = total > 0 ? (passed / total) * 100 : 0;

    return { total, passed, failed, pending, coverage };
  }

  // Story complexity analysis
  getComplexityFactors(): { score: number; factors: Record<string, number> } {
    const factors: Record<string, number> = {};

    // Base complexity from story points
    factors.storyPoints = this.storyPoints ?? 0;

    // API complexity
    factors.apiComplexity = (this.apiRequirements?.length ?? 0) * 2;

    // UI complexity
    factors.uiComplexity = (this.uiComponents?.length ?? 0) * 1.5;

    // Dependency complexity
    factors.dependencyComplexity = (this.dependencies?.length ?? 0) * 3;

    // Test complexity
    factors.testComplexity = (this.testCases?.length ?? 0) * 1;

    const totalScore = Object.values(factors).reduce((sum, value) => sum + value, 0);

    return { score: totalScore, factors };
  }

  // Agile workflow helpers
  isReadyForSprint(): boolean {
    return !!(
      this.acceptanceCriteria &&
      this.userGoal &&
      this.storyPoints &&
      this.definitionOfDone?.length
    );
  }

  isReadyForDevelopment(): boolean {
    return this.isReadyForSprint() && 
           !this.hasBlockingDependencies() &&
           this.testCases?.length! > 0;
  }

  hasBlockingDependencies(): boolean {
    return this.dependencies?.some(dep => dep.type === 'blocks') ?? false;
  }

  // Story progress tracking
  calculateStoryProgress(): number {
    let progress = 0;
    let totalWeight = 0;

    // Factor 1: Manual completion percentage (40% weight)
    if (this.completionPercentage !== undefined) {
      progress += this.completionPercentage * 0.4;
      totalWeight += 0.4;
    }

    // Factor 2: Test case completion (35% weight)
    const testCoverage = this.getTestCoverage();
    if (testCoverage.total > 0) {
      progress += testCoverage.coverage * 0.35;
      totalWeight += 0.35;
    }

    // Factor 3: Definition of Done checklist (25% weight)
    const dodProgress = this.calculateDoDProgress();
    progress += dodProgress * 0.25;
    totalWeight += 0.25;

    return totalWeight > 0 ? progress / totalWeight : 0;
  }

  private calculateDoDProgress(): number {
    if (!this.definitionOfDone || this.definitionOfDone.length === 0) return 100;

    // This would typically track which DoD items are completed
    // For now, we'll estimate based on overall completion
    return this.completionPercentage ?? 0;
  }

  // Sprint integration
  addToSprint(sprintId: string): void {
    if (!this.isReadyForSprint()) {
      throw new Error('Story is not ready for sprint - missing required fields');
    }
    this.sprintId = sprintId;
  }

  removeFromSprint(): void {
    this.sprintId = undefined;
  }

  // Epic relationship
  assignToEpic(epicId: string): void {
    this.epicId = epicId;
  }

  removeFromEpic(): void {
    this.epicId = undefined;
  }

  // Dependency management
  addDependency(dependency: NonNullable<UserStory['dependencies']>[0]): void {
    if (!this.dependencies) {
      this.dependencies = [];
    }
    this.dependencies.push(dependency);
  }

  removeDependency(storyId: string): void {
    if (!this.dependencies) return;
    this.dependencies = this.dependencies.filter(dep => dep.storyId !== storyId);
  }

  // API requirement management
  addApiRequirement(requirement: NonNullable<UserStory['apiRequirements']>[0]): void {
    if (!this.apiRequirements) {
      this.apiRequirements = [];
    }
    this.apiRequirements.push(requirement);
  }

  // Wireframe management
  addWireframe(wireframe: NonNullable<UserStory['wireframes']>[0]): void {
    if (!this.wireframes) {
      this.wireframes = [];
    }
    this.wireframes.push(wireframe);
  }

  // Story quality assessment
  getStoryQuality(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Completeness (40% of quality)
    factors.completeness = this.calculateCompletenessScore();
    if (factors.completeness < 70) {
      issues.push('Story lacks important details');
    }

    // Testability (30% of quality)
    factors.testability = this.calculateTestabilityScore();
    if (factors.testability < 60) {
      issues.push('Story needs better test coverage or acceptance criteria');
    }

    // Clarity (30% of quality)
    factors.clarity = this.calculateClarityScore();
    if (factors.clarity < 60) {
      issues.push('Story needs clearer user goal or business value');
    }

    const totalScore = 
      factors.completeness * 0.4 + 
      factors.testability * 0.3 + 
      factors.clarity * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateCompletenessScore(): number {
    let score = 0;
    let maxScore = 0;

    // Required fields
    if (this.userGoal) { score += 20; } maxScore += 20;
    if (this.acceptanceCriteria) { score += 20; } maxScore += 20;
    if (this.businessValue) { score += 15; } maxScore += 15;
    if (this.storyPoints) { score += 10; } maxScore += 10;
    if (this.definitionOfDone?.length) { score += 15; } maxScore += 15;

    // Optional but valuable fields
    if (this.testCases?.length) { score += 10; } maxScore += 10;
    if (this.wireframes?.length) { score += 5; } maxScore += 5;
    if (this.apiRequirements?.length) { score += 5; } maxScore += 5;

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  private calculateTestabilityScore(): number {
    let score = 0;

    // Acceptance criteria quality
    if (this.acceptanceCriteria && this.acceptanceCriteria.length > 50) {
      score += 40;
    } else if (this.acceptanceCriteria) {
      score += 20;
    }

    // Test cases
    const testCaseCount = this.testCases?.length ?? 0;
    if (testCaseCount >= 3) score += 40;
    else if (testCaseCount >= 1) score += 20;

    // Definition of Done
    const dodCount = this.definitionOfDone?.length ?? 0;
    if (dodCount >= 3) score += 20;
    else if (dodCount >= 1) score += 10;

    return score;
  }

  private calculateClarityScore(): number {
    let score = 0;

    // User goal clarity (length as proxy for detail)
    if (this.userGoal && this.userGoal.length > 30) {
      score += 30;
    } else if (this.userGoal) {
      score += 15;
    }

    // Business value clarity
    if (this.businessValue && this.businessValue.length > 50) {
      score += 30;
    } else if (this.businessValue) {
      score += 15;
    }

    // User persona specificity
    if (this.userPersona) {
      score += 20;
    }

    // Story type specificity
    if (this.storyType) {
      score += 20;
    }

    return score;
  }

  // Generate story format for documentation
  generateStoryFormat(): string {
    const persona = this.userPersona || 'a user';
    const goal = this.userGoal || 'accomplish a task';
    const value = this.businessValue || 'achieve business value';

    return `As ${persona}, I want to ${goal}, so that ${value}.`;
  }
}