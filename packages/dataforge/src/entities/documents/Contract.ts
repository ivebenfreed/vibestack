import { Entity, Property } from '@mikro-orm/core';
import { DocumentArchetype } from '../archetypes/DocumentArchetype.js';

/**
 * Legal contract document with terms, obligations, and lifecycle management
 * Extends DocumentArchetype with contract-specific business logic
 */
@Entity({ tableName: 'contract' })
export class Contract extends DocumentArchetype {
  @Property({ nullable: true, fieldName: 'contract_type' })
  contractType?: 'service' | 'employment' | 'vendor' | 'partnership' | 'license' | 'nda' | 'purchase' | 'lease' | 'consulting';

  @Property({ type: 'date', nullable: true, fieldName: 'execution_date' })
  executionDate?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'effective_date' })
  effectiveDate?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'expiration_date' })
  expirationDate?: Date;

  @Property({ nullable: true })
  jurisdiction?: string;

  @Property({ nullable: true, fieldName: 'governing_law' })
  governingLaw?: string;

  @Property({ type: 'json', nullable: true })
  parties?: Array<{
    name: string;
    type: 'individual' | 'corporation' | 'partnership' | 'government' | 'nonprofit';
    role: 'client' | 'vendor' | 'partner' | 'employer' | 'employee' | 'licensor' | 'licensee';
    address?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    taxId?: string;
    registrationNumber?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  terms?: Array<{
    id: string;
    section: string;
    title: string;
    content: string;
    type: 'obligation' | 'right' | 'restriction' | 'definition' | 'condition';
    applicableTo?: string[]; // Party names
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }>;

  @Property({ type: 'json', nullable: true })
  obligations?: Array<{
    id: string;
    party: string;
    description: string;
    type: 'delivery' | 'payment' | 'performance' | 'reporting' | 'compliance' | 'maintenance';
    dueDate?: Date;
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
      endDate?: Date;
    };
    status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived';
    dependencies?: string[];
    penalty?: {
      type: 'monetary' | 'termination' | 'other';
      amount?: number;
      description: string;
    };
  }>;

  @Property({ type: 'json', nullable: true })
  financials?: {
    totalValue?: number;
    currency?: string;
    paymentTerms?: {
      schedule: Array<{
        description: string;
        amount: number;
        dueDate: Date;
        status?: 'pending' | 'paid' | 'overdue';
      }>;
      method?: string;
      lateFee?: {
        type: 'percentage' | 'fixed';
        value: number;
        gracePeriod?: number; // days
      };
    };
    expenses?: Array<{
      category: string;
      amount: number;
      responsible: string;
      reimbursable?: boolean;
    }>;
    currency?: string;
  };

  @Property({ type: 'json', nullable: true })
  deliverables?: Array<{
    id: string;
    name: string;
    description: string;
    responsible: string;
    dueDate?: Date;
    acceptanceCriteria?: string[];
    status: 'not_started' | 'in_progress' | 'submitted' | 'accepted' | 'rejected';
    dependencies?: string[];
    milestonePayment?: number;
  }>;

  @Property({ type: 'json', nullable: true })
  milestones?: Array<{
    id: string;
    name: string;
    description: string;
    dueDate: Date;
    criteria: string[];
    paymentAmount?: number;
    status: 'upcoming' | 'in_progress' | 'completed' | 'delayed';
    dependencies?: string[];
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'termination_clauses' })
  terminationClauses?: {
    forCause?: {
      allowed: boolean;
      causes: string[];
      noticeRequired?: number; // days
      procedure?: string;
    };
    forConvenience?: {
      allowed: boolean;
      noticeRequired?: number; // days
      penalties?: string;
    };
    automatic?: {
      conditions: string[];
      effectiveDate?: 'immediate' | 'end_of_term';
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'renewal_terms' })
  renewalTerms?: {
    automatic?: boolean;
    renewalPeriod?: string;
    noticeRequired?: number; // days before expiration
    renegotiationRequired?: boolean;
    priceAdjustment?: {
      method: 'fixed_percentage' | 'inflation_index' | 'negotiated';
      value?: number;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'dispute_resolution' })
  disputeResolution?: {
    method: 'litigation' | 'arbitration' | 'mediation' | 'negotiation';
    jurisdiction?: string;
    arbitrationRules?: string;
    mediator?: string;
    costs?: 'each_party' | 'losing_party' | 'shared';
  };

  @Property({ type: 'json', nullable: true })
  amendments?: Array<{
    id: string;
    date: Date;
    description: string;
    changedSections: string[];
    approvedBy: string[];
    effectiveDate?: Date;
    reason?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'compliance_requirements' })
  complianceRequirements?: Array<{
    requirement: string;
    applicableTo: string;
    evidence?: string;
    frequency?: 'once' | 'annual' | 'quarterly' | 'monthly';
    nextDue?: Date;
    status: 'compliant' | 'non_compliant' | 'pending_review';
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'risk_factors' })
  riskFactors?: Array<{
    risk: string;
    category: 'financial' | 'legal' | 'operational' | 'reputational' | 'regulatory';
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
    owner?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'communication_log' })
  communicationLog?: Array<{
    date: Date;
    type: 'notice' | 'request' | 'response' | 'amendment' | 'termination';
    from: string;
    to: string[];
    subject: string;
    summary: string;
    response?: {
      required: boolean;
      dueDate?: Date;
      received?: boolean;
      receivedDate?: Date;
    };
  }>;

  @Property({ nullable: true, fieldName: 'contract_manager' })
  contractManager?: string;

  @Property({ nullable: true, fieldName: 'legal_reviewer' })
  legalReviewer?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'last_review_date' })
  lastReviewDate?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'next_review_date' })
  nextReviewDate?: Date;

  // Implementation of abstract methods
  getDocumentType(): string {
    return 'contract';
  }

  async validateDocumentRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Contract-specific validation
    if (!this.contractType) {
      return false; // Contract type is required
    }

    if (!this.parties || this.parties.length < 2) {
      return false; // Must have at least 2 parties
    }

    // Date validation
    if (this.effectiveDate && this.expirationDate && this.effectiveDate >= this.expirationDate) {
      return false; // Effective date must be before expiration
    }

    if (this.executionDate && this.effectiveDate && this.executionDate > this.effectiveDate) {
      return false; // Execution date cannot be after effective date
    }

    // Financial validation
    if (this.financials?.totalValue && this.financials.totalValue < 0) {
      return false; // Contract value cannot be negative
    }

    // Obligation validation
    if (this.obligations) {
      for (const obligation of this.obligations) {
        if (!this.parties.some(party => party.name === obligation.party)) {
          return false; // Obligation party must be a contract party
        }
      }
    }

    return true;
  }

  async generatePreview(): Promise<string> {
    const preview: string[] = [];

    preview.push(`CONTRACT: ${this.title}`);
    preview.push(`Type: ${this.contractType || 'General'}`);
    preview.push(`Status: ${this.status || 'Draft'}`);
    preview.push('');

    // Parties
    if (this.parties) {
      preview.push('PARTIES:');
      this.parties.forEach(party => {
        preview.push(`- ${party.name} (${party.role})`);
      });
      preview.push('');
    }

    // Key dates
    preview.push('KEY DATES:');
    if (this.executionDate) {
      preview.push(`Execution: ${this.executionDate.toDateString()}`);
    }
    if (this.effectiveDate) {
      preview.push(`Effective: ${this.effectiveDate.toDateString()}`);
    }
    if (this.expirationDate) {
      preview.push(`Expiration: ${this.expirationDate.toDateString()}`);
    }
    preview.push('');

    // Financial summary
    if (this.financials?.totalValue) {
      preview.push(`TOTAL VALUE: ${this.financials.currency || '$'}${this.financials.totalValue.toLocaleString()}`);
      preview.push('');
    }

    // Key obligations
    if (this.obligations && this.obligations.length > 0) {
      preview.push('KEY OBLIGATIONS:');
      this.obligations.slice(0, 3).forEach(obligation => {
        preview.push(`- ${obligation.party}: ${obligation.description}`);
      });
    }

    return preview.join('\n');
  }

  async processContentForExport(format: string): Promise<string> {
    const content: string[] = [];

    // Header
    content.push(`# ${this.title}`);
    content.push(`**Contract Type:** ${this.contractType || 'General'}`);
    content.push(`**Status:** ${this.status || 'Draft'}`);
    if (this.jurisdiction) {
      content.push(`**Jurisdiction:** ${this.jurisdiction}`);
    }
    content.push('');

    // Parties
    if (this.parties) {
      content.push('## Parties');
      this.parties.forEach(party => {
        content.push(`### ${party.name}`);
        content.push(`- **Type:** ${party.type}`);
        content.push(`- **Role:** ${party.role}`);
        if (party.address) content.push(`- **Address:** ${party.address}`);
        if (party.contactPerson) content.push(`- **Contact:** ${party.contactPerson}`);
        if (party.email) content.push(`- **Email:** ${party.email}`);
        content.push('');
      });
    }

    // Key Dates
    content.push('## Key Dates');
    if (this.executionDate) {
      content.push(`**Execution Date:** ${this.executionDate.toDateString()}`);
    }
    if (this.effectiveDate) {
      content.push(`**Effective Date:** ${this.effectiveDate.toDateString()}`);
    }
    if (this.expirationDate) {
      content.push(`**Expiration Date:** ${this.expirationDate.toDateString()}`);
    }
    content.push('');

    // Financial Terms
    if (this.financials) {
      content.push('## Financial Terms');
      if (this.financials.totalValue) {
        content.push(`**Total Contract Value:** ${this.financials.currency || '$'}${this.financials.totalValue.toLocaleString()}`);
      }
      if (this.financials.paymentTerms?.schedule) {
        content.push('### Payment Schedule:');
        this.financials.paymentTerms.schedule.forEach((payment, index) => {
          content.push(`${index + 1}. ${payment.description}: ${this.financials?.currency || '$'}${payment.amount.toLocaleString()} - Due: ${payment.dueDate.toDateString()}`);
        });
      }
      content.push('');
    }

    // Terms and Conditions
    if (this.terms) {
      content.push('## Terms and Conditions');
      this.terms.forEach(term => {
        content.push(`### ${term.title}`);
        content.push(term.content);
        content.push('');
      });
    }

    // Obligations
    if (this.obligations) {
      content.push('## Obligations');
      this.obligations.forEach((obligation, index) => {
        content.push(`### ${index + 1}. ${obligation.party} - ${obligation.type}`);
        content.push(obligation.description);
        if (obligation.dueDate) {
          content.push(`**Due Date:** ${obligation.dueDate.toDateString()}`);
        }
        content.push(`**Status:** ${obligation.status}`);
        content.push('');
      });
    }

    // Deliverables
    if (this.deliverables) {
      content.push('## Deliverables');
      this.deliverables.forEach(deliverable => {
        content.push(`### ${deliverable.name}`);
        content.push(deliverable.description);
        content.push(`**Responsible:** ${deliverable.responsible}`);
        if (deliverable.dueDate) {
          content.push(`**Due Date:** ${deliverable.dueDate.toDateString()}`);
        }
        content.push(`**Status:** ${deliverable.status}`);
        if (deliverable.acceptanceCriteria) {
          content.push('**Acceptance Criteria:**');
          deliverable.acceptanceCriteria.forEach(criteria => {
            content.push(`- ${criteria}`);
          });
        }
        content.push('');
      });
    }

    // Termination Clauses
    if (this.terminationClauses) {
      content.push('## Termination');
      if (this.terminationClauses.forCause?.allowed) {
        content.push('### Termination for Cause');
        content.push('**Allowed causes:**');
        this.terminationClauses.forCause.causes.forEach(cause => {
          content.push(`- ${cause}`);
        });
        if (this.terminationClauses.forCause.noticeRequired) {
          content.push(`**Notice Required:** ${this.terminationClauses.forCause.noticeRequired} days`);
        }
      }
      if (this.terminationClauses.forConvenience?.allowed) {
        content.push('### Termination for Convenience');
        if (this.terminationClauses.forConvenience.noticeRequired) {
          content.push(`**Notice Required:** ${this.terminationClauses.forConvenience.noticeRequired} days`);
        }
      }
      content.push('');
    }

    // Main Content
    if (this.content) {
      content.push('## Additional Terms');
      content.push(this.content);
    }

    const fullContent = content.join('\n');

    // Format-specific processing
    switch (format) {
      case 'html':
        return fullContent
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n/g, '<br>');
      case 'json':
        return JSON.stringify({
          title: this.title,
          type: this.contractType,
          parties: this.parties,
          financials: this.financials,
          terms: this.terms,
          obligations: this.obligations,
          content: fullContent
        }, null, 2);
      default:
        return fullContent;
    }
  }

  // Contract-specific business logic
  addParty(name: string, type: NonNullable<Contract['parties']>[0]['type'], role: NonNullable<Contract['parties']>[0]['role'], contactInfo?: Partial<NonNullable<Contract['parties']>[0]>): void {
    if (!this.parties) {
      this.parties = [];
    }

    this.parties.push({
      name,
      type,
      role,
      ...contactInfo
    });
  }

  addObligation(party: string, description: string, type: NonNullable<Contract['obligations']>[0]['type'], dueDate?: Date): string {
    if (!this.obligations) {
      this.obligations = [];
    }

    const obligationId = `obligation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.obligations.push({
      id: obligationId,
      party,
      description,
      type,
      dueDate,
      status: 'pending'
    });

    return obligationId;
  }

  updateObligationStatus(obligationId: string, status: NonNullable<Contract['obligations']>[0]['status']): void {
    const obligation = this.obligations?.find(o => o.id === obligationId);
    if (obligation) {
      obligation.status = status;
    }
  }

  addDeliverable(name: string, description: string, responsible: string, dueDate?: Date, acceptanceCriteria?: string[]): string {
    if (!this.deliverables) {
      this.deliverables = [];
    }

    const deliverableId = `deliverable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.deliverables.push({
      id: deliverableId,
      name,
      description,
      responsible,
      dueDate,
      acceptanceCriteria,
      status: 'not_started'
    });

    return deliverableId;
  }

  addAmendment(description: string, changedSections: string[], approvedBy: string[], reason?: string): string {
    if (!this.amendments) {
      this.amendments = [];
    }

    const amendmentId = `amendment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.amendments.push({
      id: amendmentId,
      date: new Date(),
      description,
      changedSections,
      approvedBy,
      reason
    });

    return amendmentId;
  }

  addCommunication(type: NonNullable<Contract['communicationLog']>[0]['type'], from: string, to: string[], subject: string, summary: string): void {
    if (!this.communicationLog) {
      this.communicationLog = [];
    }

    this.communicationLog.push({
      date: new Date(),
      type,
      from,
      to,
      subject,
      summary
    });
  }

  isActive(): boolean {
    const now = new Date();
    return (!this.effectiveDate || this.effectiveDate <= now) && 
           (!this.expirationDate || this.expirationDate > now) &&
           this.status !== 'terminated' && this.status !== 'expired';
  }

  isExpired(): boolean {
    return this.expirationDate ? new Date() > this.expirationDate : false;
  }

  isExpiringSoon(days: number = 30): boolean {
    if (!this.expirationDate) return false;
    const daysUntilExpiration = (this.expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiration <= days && daysUntilExpiration > 0;
  }

  getOverdueObligations(): NonNullable<Contract['obligations']> {
    if (!this.obligations) return [];
    
    const now = new Date();
    return this.obligations.filter(obligation => 
      obligation.dueDate && 
      now > obligation.dueDate && 
      obligation.status !== 'completed' &&
      obligation.status !== 'waived'
    );
  }

  getUpcomingObligations(days: number = 30): NonNullable<Contract['obligations']> {
    if (!this.obligations) return [];
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.obligations.filter(obligation => 
      obligation.dueDate && 
      obligation.dueDate <= futureDate && 
      obligation.dueDate > new Date() &&
      obligation.status === 'pending'
    );
  }

  getPartyObligations(partyName: string): NonNullable<Contract['obligations']> {
    return this.obligations?.filter(obligation => obligation.party === partyName) || [];
  }

  getTotalContractValue(): number {
    return this.financials?.totalValue || 0;
  }

  getOutstandingPayments(): NonNullable<NonNullable<Contract['financials']>['paymentTerms']>['schedule'] {
    if (!this.financials?.paymentTerms?.schedule) return [];
    
    return this.financials.paymentTerms.schedule.filter(payment => 
      payment.status === 'pending' || payment.status === 'overdue'
    );
  }

  calculateCompletionPercentage(): number {
    if (!this.obligations || this.obligations.length === 0) return 0;
    
    const completed = this.obligations.filter(o => o.status === 'completed').length;
    return (completed / this.obligations.length) * 100;
  }

  getContractHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Compliance (40%)
    factors.compliance = this.calculateComplianceScore();
    if (factors.compliance < 70) {
      issues.push('Contract compliance issues detected');
    }

    // Performance (35%)
    factors.performance = this.calculatePerformanceScore();
    if (factors.performance < 60) {
      issues.push('Contract performance below expectations');
    }

    // Risk management (25%)
    factors.riskManagement = this.calculateRiskScore();
    if (factors.riskManagement < 50) {
      issues.push('High risk factors require attention');
    }

    const totalScore = 
      factors.compliance * 0.4 + 
      factors.performance * 0.35 + 
      factors.riskManagement * 0.25;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateComplianceScore(): number {
    let score = 100;

    // Overdue obligations penalty
    const overdueObligations = this.getOverdueObligations().length;
    score -= overdueObligations * 15;

    // Missing key dates
    if (!this.effectiveDate) score -= 10;
    if (!this.expirationDate) score -= 10;

    // Compliance requirements
    const nonCompliantReqs = this.complianceRequirements?.filter(req => 
      req.status === 'non_compliant'
    ).length || 0;
    score -= nonCompliantReqs * 20;

    return Math.max(0, score);
  }

  private calculatePerformanceScore(): number {
    let score = 50; // Base score

    // Obligation completion rate
    const completionRate = this.calculateCompletionPercentage();
    score += completionRate * 0.4;

    // Deliverables performance
    if (this.deliverables) {
      const completedDeliverables = this.deliverables.filter(d => d.status === 'accepted').length;
      const deliverableRate = (completedDeliverables / this.deliverables.length) * 100;
      score += deliverableRate * 0.1;
    }

    return Math.min(100, score);
  }

  private calculateRiskScore(): number {
    let score = 80; // Base score

    // High risk factors
    const highRisks = this.riskFactors?.filter(risk => 
      risk.probability === 'high' || risk.impact === 'high'
    ).length || 0;
    score -= highRisks * 15;

    // Contract expiration
    if (this.isExpiringSoon(60)) score -= 10;
    if (this.isExpired()) score -= 30;

    // Financial risks
    const overduePayments = this.getOutstandingPayments().filter(p => 
      p.status === 'overdue'
    ).length;
    score -= overduePayments * 10;

    return Math.max(0, score);
  }
}