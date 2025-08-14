import { Entity, Property } from '@mikro-orm/core';
import { ProjectArchetype } from '../archetypes/ProjectArchetype.js';

/**
 * Marketing campaign project with campaign-specific fields and workflows
 * Extends ProjectArchetype with marketing business logic
 */
@Entity({ tableName: 'marketing_campaign' })
export class MarketingCampaign extends ProjectArchetype {
  @Property({ type: 'json', nullable: true, fieldName: 'target_audience' })
  targetAudience?: {
    demographics?: {
      ageRange?: string;
      gender?: string;
      income?: string;
      location?: string[];
    };
    interests?: string[];
    behaviors?: string[];
    segments?: string[];
  };

  @Property({ type: 'json', nullable: true })
  channels?: {
    digital?: string[]; // email, social, search, display
    traditional?: string[]; // tv, radio, print
    owned?: string[]; // website, blog, app
    earned?: string[]; // pr, influencer, word-of-mouth
  };

  @Property({ type: 'json', nullable: true, fieldName: 'conversion_goals' })
  conversionGoals?: {
    primary?: {
      type: 'leads' | 'sales' | 'awareness' | 'engagement' | 'traffic';
      target: number;
      current?: number;
    };
    secondary?: Array<{
      type: 'leads' | 'sales' | 'awareness' | 'engagement' | 'traffic';
      target: number;
      current?: number;
    }>;
  };

  @Property({ type: 'json', nullable: true })
  metrics?: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    cost?: number;
    revenue?: number;
    roas?: number; // Return on Ad Spend
    cpa?: number; // Cost Per Acquisition
    ctr?: number; // Click Through Rate
    lastUpdated?: Date;
  };

  @Property({ nullable: true, fieldName: 'campaign_type' })
  campaignType?: 'awareness' | 'consideration' | 'conversion' | 'retention' | 'advocacy';

  @Property({ nullable: true })
  theme?: string;

  @Property({ type: 'json', nullable: true })
  creative?: {
    messaging?: string[];
    visualStyle?: string;
    brandGuidelines?: string[];
    assets?: string[]; // file IDs or URLs
  };

  @Property({ type: 'json', nullable: true })
  schedule?: {
    phases?: Array<{
      name: string;
      startDate: Date;
      endDate: Date;
      activities: string[];
    }>;
    milestones?: Array<{
      name: string;
      date: Date;
      deliverables: string[];
    }>;
  };

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true, fieldName: 'cost_per_acquisition_target' })
  costPerAcquisitionTarget?: number;

  @Property({ type: 'decimal', precision: 5, scale: 2, nullable: true, fieldName: 'roas_target' })
  roasTarget?: number; // Return on Ad Spend target

  // Implementation of abstract methods
  getProjectType(): string {
    return 'marketing_campaign';
  }

  async validateProjectRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Marketing-specific validation
    if (!this.targetAudience || Object.keys(this.targetAudience).length === 0) {
      return false; // Must have target audience
    }

    if (!this.channels || this.getTotalChannels() === 0) {
      return false; // Must have at least one channel
    }

    if (!this.conversionGoals?.primary) {
      return false; // Must have primary conversion goal
    }

    if (this.costPerAcquisitionTarget && this.costPerAcquisitionTarget <= 0) {
      return false;
    }

    if (this.roasTarget && this.roasTarget <= 0) {
      return false;
    }

    return true;
  }

  async calculateProgress(): Promise<number> {
    let totalWeight = 0;
    let weightedProgress = 0;

    // Factor 1: Manual progress percentage (30% weight)
    if (this.progressPercentage !== undefined) {
      weightedProgress += this.progressPercentage * 0.3;
      totalWeight += 0.3;
    }

    // Factor 2: Goal achievement (50% weight)
    const goalProgress = this.calculateGoalProgress();
    weightedProgress += goalProgress * 0.5;
    totalWeight += 0.5;

    // Factor 3: Timeline progress (20% weight)
    const timelineProgress = this.calculateTimelineProgress();
    weightedProgress += timelineProgress * 0.2;
    totalWeight += 0.2;

    return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  }

  getRequiredResources(): string[] {
    const resources: string[] = ['Campaign Manager', 'Creative Director'];

    // Add resources based on channels
    const channels = this.channels;
    if (channels?.digital?.includes('social')) {
      resources.push('Social Media Manager');
    }
    if (channels?.digital?.includes('email')) {
      resources.push('Email Marketing Specialist');
    }
    if (channels?.digital?.includes('search') || channels?.digital?.includes('display')) {
      resources.push('Digital Advertising Specialist');
    }
    if (channels?.traditional?.length) {
      resources.push('Traditional Media Buyer');
    }
    if (channels?.earned?.includes('pr')) {
      resources.push('PR Specialist');
    }

    // Add resources based on campaign type
    if (this.campaignType === 'awareness') {
      resources.push('Brand Manager');
    }
    if (this.campaignType === 'conversion') {
      resources.push('Conversion Optimization Specialist');
    }

    resources.push('Data Analyst', 'Copywriter', 'Graphic Designer');

    return [...new Set(resources)]; // Remove duplicates
  }

  // Marketing-specific business logic methods
  private getTotalChannels(): number {
    const channels = this.channels;
    if (!channels) return 0;

    return (
      (channels.digital?.length ?? 0) +
      (channels.traditional?.length ?? 0) +
      (channels.owned?.length ?? 0) +
      (channels.earned?.length ?? 0)
    );
  }

  private calculateGoalProgress(): number {
    if (!this.conversionGoals?.primary) return 0;

    const primary = this.conversionGoals.primary;
    if (!primary.current || primary.target === 0) return 0;

    const primaryProgress = Math.min((primary.current / primary.target) * 100, 100);

    // Factor in secondary goals (weighted less)
    let secondaryProgress = 0;
    const secondary = this.conversionGoals.secondary ?? [];
    
    if (secondary.length > 0) {
      const secondarySum = secondary.reduce((sum, goal) => {
        if (!goal.current || goal.target === 0) return sum;
        return sum + Math.min((goal.current / goal.target) * 100, 100);
      }, 0);
      secondaryProgress = secondarySum / secondary.length;
    }

    // Primary goal: 80% weight, Secondary goals: 20% weight
    return secondary.length > 0 
      ? primaryProgress * 0.8 + secondaryProgress * 0.2
      : primaryProgress;
  }

  private calculateTimelineProgress(): number {
    if (!this.schedule?.phases) return 100;

    const now = new Date();
    let completedPhases = 0;
    let totalPhases = this.schedule.phases.length;

    for (const phase of this.schedule.phases) {
      if (now > phase.endDate) {
        completedPhases++;
      }
    }

    return totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 100;
  }

  // Campaign performance helpers
  calculateROAS(): number | null {
    if (!this.metrics?.cost || !this.metrics?.revenue || this.metrics.cost === 0) {
      return null;
    }
    return this.metrics.revenue / this.metrics.cost;
  }

  calculateCPA(): number | null {
    if (!this.metrics?.cost || !this.metrics?.conversions || this.metrics.conversions === 0) {
      return null;
    }
    return this.metrics.cost / this.metrics.conversions;
  }

  calculateCTR(): number | null {
    if (!this.metrics?.impressions || !this.metrics?.clicks || this.metrics.impressions === 0) {
      return null;
    }
    return (this.metrics.clicks / this.metrics.impressions) * 100;
  }

  // Goal tracking
  updateGoalProgress(goalType: 'primary' | 'secondary', value: number, secondaryIndex?: number): void {
    if (!this.conversionGoals) return;

    if (goalType === 'primary' && this.conversionGoals.primary) {
      this.conversionGoals.primary.current = value;
    } else if (goalType === 'secondary' && this.conversionGoals.secondary && secondaryIndex !== undefined) {
      if (this.conversionGoals.secondary[secondaryIndex]) {
        this.conversionGoals.secondary[secondaryIndex].current = value;
      }
    }
  }

  // Metrics updating
  updateMetrics(newMetrics: Partial<NonNullable<MarketingCampaign['metrics']>>): void {
    this.metrics = {
      ...this.metrics,
      ...newMetrics,
      lastUpdated: new Date()
    };

    // Auto-calculate derived metrics
    if (this.metrics.cost && this.metrics.revenue) {
      this.metrics.roas = this.calculateROAS() ?? undefined;
    }
    if (this.metrics.cost && this.metrics.conversions) {
      this.metrics.cpa = this.calculateCPA() ?? undefined;
    }
    if (this.metrics.impressions && this.metrics.clicks) {
      this.metrics.ctr = this.calculateCTR() ?? undefined;
    }
  }

  // Campaign health assessment
  getCampaignHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Goal performance (40% of health)
    factors.goalPerformance = this.calculateGoalProgress();
    if (factors.goalPerformance < 50) {
      issues.push('Campaign goals are significantly underperforming');
    }

    // Cost efficiency (30% of health)
    factors.costEfficiency = this.calculateCostEfficiency();
    if (factors.costEfficiency < 50) {
      issues.push('Campaign cost efficiency is below targets');
    }

    // Timeline adherence (30% of health)
    factors.timelineAdherence = this.calculateTimelineProgress();
    if (factors.timelineAdherence < this.calculateGoalProgress()) {
      issues.push('Campaign is behind schedule relative to performance');
    }

    const totalScore = 
      factors.goalPerformance * 0.4 + 
      factors.costEfficiency * 0.3 + 
      factors.timelineAdherence * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateCostEfficiency(): number {
    let score = 100;

    // Check CPA vs target
    const actualCPA = this.calculateCPA();
    if (actualCPA && this.costPerAcquisitionTarget) {
      if (actualCPA > this.costPerAcquisitionTarget) {
        score -= Math.min(50, ((actualCPA - this.costPerAcquisitionTarget) / this.costPerAcquisitionTarget) * 100);
      }
    }

    // Check ROAS vs target
    const actualROAS = this.calculateROAS();
    if (actualROAS && this.roasTarget) {
      if (actualROAS < this.roasTarget) {
        score -= Math.min(50, ((this.roasTarget - actualROAS) / this.roasTarget) * 100);
      }
    }

    return Math.max(0, score);
  }

  // Channel optimization
  getChannelPerformance(): Record<string, { spend?: number; conversions?: number; efficiency?: number }> {
    // This would typically pull from detailed channel-specific metrics
    // For now, return a placeholder structure
    const performance: Record<string, { spend?: number; conversions?: number; efficiency?: number }> = {};

    const allChannels = [
      ...(this.channels?.digital ?? []),
      ...(this.channels?.traditional ?? []),
      ...(this.channels?.owned ?? []),
      ...(this.channels?.earned ?? [])
    ];

    allChannels.forEach(channel => {
      performance[channel] = {
        spend: 0,
        conversions: 0,
        efficiency: 0
      };
    });

    return performance;
  }

  // Add channel to campaign
  addChannel(category: keyof NonNullable<MarketingCampaign['channels']>, channel: string): void {
    if (!this.channels) {
      this.channels = {};
    }
    if (!this.channels[category]) {
      this.channels[category] = [];
    }
    if (!this.channels[category]!.includes(channel)) {
      this.channels[category]!.push(channel);
    }
  }

  // Remove channel from campaign
  removeChannel(category: keyof NonNullable<MarketingCampaign['channels']>, channel: string): void {
    if (!this.channels?.[category]) return;
    
    const index = this.channels[category]!.indexOf(channel);
    if (index > -1) {
      this.channels[category]!.splice(index, 1);
    }
  }
}