import { Entity, Property } from '@mikro-orm/core';
import { ProjectArchetype } from '../archetypes/ProjectArchetype.js';

/**
 * Research project with research-specific fields and academic workflows
 * Extends ProjectArchetype with research methodology and publication tracking
 */
@Entity({ tableName: 'research_project' })
export class ResearchProject extends ProjectArchetype {
  @Property({ type: 'text', nullable: true })
  hypothesis?: string;

  @Property({ type: 'text', nullable: true })
  methodology?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'research_questions' })
  researchQuestions?: string[];

  @Property({ type: 'json', nullable: true, fieldName: 'expected_outcomes' })
  expectedOutcomes?: {
    primary?: string[];
    secondary?: string[];
    deliverables?: string[];
    timeline?: Array<{
      milestone: string;
      expectedDate: Date;
      status?: 'planned' | 'in_progress' | 'completed' | 'delayed';
    }>;
  };

  @Property({ type: 'json', nullable: true })
  publications?: Array<{
    title: string;
    type: 'paper' | 'report' | 'presentation' | 'poster' | 'thesis' | 'article';
    status: 'planned' | 'draft' | 'review' | 'submitted' | 'accepted' | 'published';
    venue?: string;
    authors?: string[];
    submissionDate?: Date;
    publicationDate?: Date;
    doi?: string;
    url?: string;
  }>;

  @Property({ nullable: true, fieldName: 'research_field' })
  researchField?: string;

  @Property({ type: 'json', nullable: true })
  disciplines?: string[]; // interdisciplinary research

  @Property({ nullable: true, fieldName: 'ethics_approval' })
  ethicsApproval?: 'not_required' | 'pending' | 'approved' | 'rejected';

  @Property({ nullable: true, fieldName: 'ethics_approval_number' })
  ethicsApprovalNumber?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'data_collection' })
  dataCollection?: {
    methods?: string[]; // surveys, interviews, experiments, observations
    sources?: string[];
    sampleSize?: number;
    targetPopulation?: string;
    status?: 'planned' | 'active' | 'completed' | 'paused';
    startDate?: Date;
    endDate?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'data_analysis' })
  dataAnalysis?: {
    methods?: string[]; // statistical, qualitative, mixed-methods
    tools?: string[]; // R, SPSS, NVivo, Python
    status?: 'not_started' | 'in_progress' | 'completed';
    findings?: string[];
  };

  @Property({ type: 'json', nullable: true })
  collaborations?: Array<{
    institution: string;
    collaborators: string[];
    role: 'lead' | 'partner' | 'contributor';
    contribution?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  funding?: Array<{
    source: string;
    amount: number;
    currency: string;
    type: 'grant' | 'fellowship' | 'contract' | 'internal';
    status: 'applied' | 'awarded' | 'rejected' | 'pending';
    startDate?: Date;
    endDate?: Date;
    grantNumber?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'risk_assessment' })
  riskAssessment?: {
    risks?: Array<{
      description: string;
      probability: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
    contingencyPlans?: string[];
  };

  // Implementation of abstract methods
  getProjectType(): string {
    return 'research';
  }

  async validateProjectRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Research-specific validation
    if (!this.hypothesis && !this.researchQuestions?.length) {
      return false; // Must have either hypothesis or research questions
    }

    if (!this.methodology) {
      return false; // Methodology is required for research
    }

    if (!this.researchField) {
      return false; // Research field is required
    }

    if (this.dataCollection?.sampleSize && this.dataCollection.sampleSize <= 0) {
      return false;
    }

    // Validate ethics approval for human subjects research
    if (this.requiresEthicsApproval() && this.ethicsApproval !== 'approved') {
      return false;
    }

    return true;
  }

  async calculateProgress(): Promise<number> {
    let totalWeight = 0;
    let weightedProgress = 0;

    // Factor 1: Manual progress percentage (20% weight)
    if (this.progressPercentage !== undefined) {
      weightedProgress += this.progressPercentage * 0.2;
      totalWeight += 0.2;
    }

    // Factor 2: Research phases completion (40% weight)
    const phaseProgress = this.calculatePhaseProgress();
    weightedProgress += phaseProgress * 0.4;
    totalWeight += 0.4;

    // Factor 3: Milestone completion (25% weight)
    const milestoneProgress = this.calculateMilestoneProgress();
    weightedProgress += milestoneProgress * 0.25;
    totalWeight += 0.25;

    // Factor 4: Publication status (15% weight)
    const publicationProgress = this.calculatePublicationProgress();
    weightedProgress += publicationProgress * 0.15;
    totalWeight += 0.15;

    return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  }

  getRequiredResources(): string[] {
    const resources: string[] = ['Principal Investigator', 'Research Assistant'];

    // Add resources based on research field
    if (this.researchField?.toLowerCase().includes('psychology')) {
      resources.push('Research Psychologist');
    }
    if (this.researchField?.toLowerCase().includes('statistics') || 
        this.dataAnalysis?.methods?.includes('statistical')) {
      resources.push('Statistician');
    }
    if (this.researchField?.toLowerCase().includes('biology') || 
        this.researchField?.toLowerCase().includes('chemistry')) {
      resources.push('Lab Technician');
    }

    // Add resources based on data collection methods
    if (this.dataCollection?.methods?.includes('interviews')) {
      resources.push('Interviewer');
    }
    if (this.dataCollection?.methods?.includes('surveys')) {
      resources.push('Survey Designer');
    }
    if (this.dataCollection?.methods?.includes('experiments')) {
      resources.push('Experimental Designer');
    }

    // Add resources based on analysis tools
    if (this.dataAnalysis?.tools?.includes('R') || this.dataAnalysis?.tools?.includes('Python')) {
      resources.push('Data Scientist');
    }

    // Administrative resources
    if (this.ethicsApproval !== 'not_required') {
      resources.push('Ethics Committee Liaison');
    }
    if (this.funding?.length) {
      resources.push('Grant Administrator');
    }

    resources.push('Research Coordinator', 'Technical Writer');

    return [...new Set(resources)]; // Remove duplicates
  }

  // Research-specific business logic methods
  private requiresEthicsApproval(): boolean {
    const humanSubjectMethods = ['interviews', 'surveys', 'experiments', 'observations'];
    return this.dataCollection?.methods?.some(method => 
      humanSubjectMethods.includes(method.toLowerCase())
    ) ?? false;
  }

  private calculatePhaseProgress(): number {
    // Standard research phases with weights
    const phases = [
      { name: 'planning', weight: 0.15, completed: this.isPlanningComplete() },
      { name: 'ethics_approval', weight: 0.05, completed: this.isEthicsComplete() },
      { name: 'data_collection', weight: 0.35, completed: this.isDataCollectionComplete() },
      { name: 'data_analysis', weight: 0.25, completed: this.isDataAnalysisComplete() },
      { name: 'writing', weight: 0.20, completed: this.isWritingComplete() }
    ];

    let completedWeight = 0;
    phases.forEach(phase => {
      if (phase.completed) {
        completedWeight += phase.weight;
      }
    });

    return completedWeight * 100;
  }

  private isPlanningComplete(): boolean {
    return !!(this.hypothesis || this.researchQuestions?.length) && 
           !!this.methodology && 
           !!this.researchField;
  }

  private isEthicsComplete(): boolean {
    return !this.requiresEthicsApproval() || this.ethicsApproval === 'approved';
  }

  private isDataCollectionComplete(): boolean {
    return this.dataCollection?.status === 'completed';
  }

  private isDataAnalysisComplete(): boolean {
    return this.dataAnalysis?.status === 'completed';
  }

  private isWritingComplete(): boolean {
    return this.publications?.some(pub => 
      pub.status === 'published' || pub.status === 'accepted'
    ) ?? false;
  }

  private calculateMilestoneProgress(): number {
    const milestones = this.expectedOutcomes?.timeline ?? [];
    if (milestones.length === 0) return 100;

    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    return (completedMilestones / milestones.length) * 100;
  }

  private calculatePublicationProgress(): number {
    const publications = this.publications ?? [];
    if (publications.length === 0) return 0;

    const statusWeights = {
      'planned': 0,
      'draft': 20,
      'review': 40,
      'submitted': 60,
      'accepted': 80,
      'published': 100
    };

    const totalWeight = publications.reduce((sum, pub) => 
      sum + (statusWeights[pub.status] || 0), 0
    );

    return totalWeight / publications.length;
  }

  // Research workflow helpers
  addPublication(publication: NonNullable<ResearchProject['publications']>[0]): void {
    if (!this.publications) {
      this.publications = [];
    }
    this.publications.push(publication);
  }

  updatePublicationStatus(publicationTitle: string, newStatus: NonNullable<ResearchProject['publications']>[0]['status']): void {
    const publication = this.publications?.find(p => p.title === publicationTitle);
    if (publication) {
      publication.status = newStatus;
      
      // Auto-set dates based on status
      if (newStatus === 'submitted' && !publication.submissionDate) {
        publication.submissionDate = new Date();
      }
      if (newStatus === 'published' && !publication.publicationDate) {
        publication.publicationDate = new Date();
      }
    }
  }

  addFunding(funding: NonNullable<ResearchProject['funding']>[0]): void {
    if (!this.funding) {
      this.funding = [];
    }
    this.funding.push(funding);
  }

  getTotalFunding(): { awarded: number; pending: number; applied: number } {
    const funding = this.funding ?? [];
    
    return funding.reduce((totals, fund) => {
      switch (fund.status) {
        case 'awarded':
          totals.awarded += fund.amount;
          break;
        case 'pending':
          totals.pending += fund.amount;
          break;
        case 'applied':
          totals.applied += fund.amount;
          break;
      }
      return totals;
    }, { awarded: 0, pending: 0, applied: 0 });
  }

  // Risk management
  addRisk(risk: NonNullable<NonNullable<ResearchProject['riskAssessment']>['risks']>[0]): void {
    if (!this.riskAssessment) {
      this.riskAssessment = { risks: [] };
    }
    if (!this.riskAssessment.risks) {
      this.riskAssessment.risks = [];
    }
    this.riskAssessment.risks.push(risk);
  }

  getHighRisks(): NonNullable<NonNullable<ResearchProject['riskAssessment']>['risks']> {
    return this.riskAssessment?.risks?.filter(risk => 
      risk.probability === 'high' || risk.impact === 'high'
    ) ?? [];
  }

  // Collaboration management
  addCollaboration(collaboration: NonNullable<ResearchProject['collaborations']>[0]): void {
    if (!this.collaborations) {
      this.collaborations = [];
    }
    this.collaborations.push(collaboration);
  }

  // Data collection management
  updateDataCollectionStatus(status: NonNullable<NonNullable<ResearchProject['dataCollection']>['status']>): void {
    if (!this.dataCollection) {
      this.dataCollection = {};
    }
    this.dataCollection.status = status;

    // Auto-set dates
    if (status === 'active' && !this.dataCollection.startDate) {
      this.dataCollection.startDate = new Date();
    }
    if (status === 'completed' && !this.dataCollection.endDate) {
      this.dataCollection.endDate = new Date();
    }
  }

  // Data analysis management
  updateDataAnalysisStatus(status: NonNullable<NonNullable<ResearchProject['dataAnalysis']>['status']>): void {
    if (!this.dataAnalysis) {
      this.dataAnalysis = {};
    }
    this.dataAnalysis.status = status;
  }

  addFinding(finding: string): void {
    if (!this.dataAnalysis) {
      this.dataAnalysis = {};
    }
    if (!this.dataAnalysis.findings) {
      this.dataAnalysis.findings = [];
    }
    this.dataAnalysis.findings.push(finding);
  }

  // Research health assessment
  getResearchHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Timeline adherence (30% of health)
    factors.timeline = this.calculateTimelineAdherence();
    if (factors.timeline < 50) {
      issues.push('Research is significantly behind schedule');
    }

    // Milestone completion (25% of health)
    factors.milestones = this.calculateMilestoneProgress();
    if (factors.milestones < factors.timeline) {
      issues.push('Milestone completion is lagging behind timeline');
    }

    // Publication progress (25% of health)
    factors.publications = this.calculatePublicationProgress();
    if (factors.publications < 20 && this.getDurationInDays() && this.getDurationInDays()! > 365) {
      issues.push('Publication progress is low for project duration');
    }

    // Risk management (20% of health)
    factors.riskManagement = this.calculateRiskScore();
    if (factors.riskManagement < 60) {
      issues.push('High-risk factors need attention');
    }

    const totalScore = 
      factors.timeline * 0.3 + 
      factors.milestones * 0.25 + 
      factors.publications * 0.25 + 
      factors.riskManagement * 0.2;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateTimelineAdherence(): number {
    if (!this.startDate || !this.endDate) return 100;

    const totalDuration = this.getDurationInDays() ?? 0;
    const remainingDays = this.getRemainingDays() ?? 0;
    const elapsedDays = totalDuration - remainingDays;

    if (totalDuration === 0) return 100;

    const expectedProgress = (elapsedDays / totalDuration) * 100;
    const actualProgress = this.calculatePhaseProgress();

    if (actualProgress >= expectedProgress) return 100;
    
    const progressRatio = actualProgress / expectedProgress;
    return Math.max(0, progressRatio * 100);
  }

  private calculateRiskScore(): number {
    const risks = this.riskAssessment?.risks ?? [];
    if (risks.length === 0) return 100;

    const riskValues = { low: 1, medium: 2, high: 3 };
    let totalRiskScore = 0;

    risks.forEach(risk => {
      const probability = riskValues[risk.probability];
      const impact = riskValues[risk.impact];
      totalRiskScore += probability * impact;
    });

    const maxPossibleScore = risks.length * 9; // 3 * 3 for each risk
    const riskPercentage = (totalRiskScore / maxPossibleScore) * 100;

    return Math.max(0, 100 - riskPercentage);
  }
}