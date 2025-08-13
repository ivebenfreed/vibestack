import { Entity, Property } from '@mikro-orm/core';
import { TaskArchetype } from '../archetypes/TaskArchetype.js';

/**
 * Maintenance task with recurring and preventive maintenance workflows
 * Extends TaskArchetype with maintenance management business logic
 */
@Entity({ tableName: 'maintenance_task' })
export class MaintenanceTask extends TaskArchetype {
  @Property({ nullable: true })
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'as_needed' | 'condition_based';

  @Property({ type: 'date', nullable: true, fieldName: 'last_completed' })
  lastCompleted?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'next_due' })
  nextDue?: Date;

  @Property({ type: 'uuid', nullable: true, fieldName: 'equipment_id' })
  equipmentId?: string;

  @Property({ nullable: true, fieldName: 'equipment_name' })
  equipmentName?: string;

  @Property({ nullable: true, fieldName: 'maintenance_type' })
  maintenanceType?: 'preventive' | 'corrective' | 'predictive' | 'routine' | 'emergency' | 'shutdown';

  @Property({ type: 'json', nullable: true })
  procedures?: Array<{
    step: number;
    description: string;
    estimatedTime?: number; // minutes
    requiredTools?: string[];
    safetyNotes?: string;
    completed?: boolean;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'required_parts' })
  requiredParts?: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    unit: string;
    cost?: number;
    supplier?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'required_tools' })
  requiredTools?: string[];

  @Property({ type: 'json', nullable: true, fieldName: 'safety_requirements' })
  safetyRequirements?: {
    ppe?: string[]; // Personal Protective Equipment
    lockoutTagout?: boolean;
    specialPrecautions?: string[];
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };

  @Property({ type: 'json', nullable: true, fieldName: 'completion_checklist' })
  completionChecklist?: Array<{
    item: string;
    required: boolean;
    completed?: boolean;
    notes?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'condition_monitoring' })
  conditionMonitoring?: {
    parameters?: Array<{
      name: string;
      currentValue?: number;
      targetValue?: number;
      unit: string;
      status?: 'good' | 'warning' | 'critical';
    }>;
    lastInspection?: Date;
    nextInspection?: Date;
  };

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true, fieldName: 'estimated_cost' })
  estimatedCost?: number;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true, fieldName: 'actual_cost' })
  actualCost?: number;

  @Property({ type: 'integer', nullable: true, fieldName: 'estimated_downtime' })
  estimatedDowntime?: number; // minutes

  @Property({ type: 'integer', nullable: true, fieldName: 'actual_downtime' })
  actualDowntime?: number; // minutes

  @Property({ type: 'json', nullable: true, fieldName: 'work_order' })
  workOrder?: {
    number: string;
    type: string;
    requestedBy?: string;
    approvedBy?: string;
    scheduledDate?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'compliance_requirements' })
  complianceRequirements?: {
    regulations?: string[];
    certifications?: string[];
    inspectionRequired?: boolean;
    documentationRequired?: boolean;
  };

  @Property({ type: 'text', nullable: true, fieldName: 'completion_notes' })
  completionNotes?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'findings' })
  findings?: Array<{
    type: 'wear' | 'damage' | 'replacement_needed' | 'adjustment_made' | 'normal';
    description: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    actionRequired?: string;
    followUpTask?: string;
  }>;

  // Implementation of abstract methods
  getTaskType(): string {
    return 'maintenance_task';
  }

  async validateTaskRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Maintenance-specific validation
    if (!this.equipmentId && !this.equipmentName) {
      return false; // Must have equipment reference
    }

    if (!this.maintenanceType) {
      return false; // Maintenance type is required
    }

    if (this.frequency !== 'as_needed' && this.frequency !== 'condition_based' && !this.nextDue) {
      return false; // Scheduled maintenance must have next due date
    }

    if (this.estimatedCost && this.estimatedCost < 0) {
      return false; // Cost cannot be negative
    }

    if (this.actualCost && this.actualCost < 0) {
      return false; // Cost cannot be negative
    }

    if (this.estimatedDowntime && this.estimatedDowntime < 0) {
      return false; // Downtime cannot be negative
    }

    if (this.actualDowntime && this.actualDowntime < 0) {
      return false; // Downtime cannot be negative
    }

    return true;
  }

  async calculatePriority(): Promise<number> {
    let priorityScore = 50; // Base priority

    // Factor 1: Maintenance type (30% of priority)
    switch (this.maintenanceType) {
      case 'emergency':
        priorityScore += 50;
        break;
      case 'corrective':
        priorityScore += 30;
        break;
      case 'predictive':
        priorityScore += 20;
        break;
      case 'preventive':
        priorityScore += 15;
        break;
      case 'routine':
        priorityScore += 10;
        break;
      case 'shutdown':
        priorityScore += 5; // Planned, lower urgency
        break;
    }

    // Factor 2: Overdue status (25% of priority)
    if (this.isOverdue()) {
      const daysOverdue = this.getDaysOverdue();
      priorityScore += Math.min(25, daysOverdue * 2);
    }

    // Factor 3: Safety risk (20% of priority)
    switch (this.safetyRequirements?.riskLevel) {
      case 'critical':
        priorityScore += 20;
        break;
      case 'high':
        priorityScore += 15;
        break;
      case 'medium':
        priorityScore += 10;
        break;
      case 'low':
        priorityScore += 5;
        break;
    }

    // Factor 4: Equipment criticality (15% of priority)
    // This would typically come from equipment master data
    // For now, we'll use estimated downtime as a proxy
    if (this.estimatedDowntime) {
      if (this.estimatedDowntime > 480) priorityScore += 15; // > 8 hours
      else if (this.estimatedDowntime > 240) priorityScore += 10; // > 4 hours
      else if (this.estimatedDowntime > 60) priorityScore += 5; // > 1 hour
    }

    // Factor 5: Condition monitoring alerts (10% of priority)
    const criticalConditions = this.conditionMonitoring?.parameters?.filter(p => p.status === 'critical').length ?? 0;
    const warningConditions = this.conditionMonitoring?.parameters?.filter(p => p.status === 'warning').length ?? 0;
    priorityScore += criticalConditions * 8 + warningConditions * 3;

    return Math.max(0, Math.min(100, priorityScore));
  }

  getRequiredSkills(): string[] {
    const skills: string[] = [];

    // Skills based on maintenance type
    switch (this.maintenanceType) {
      case 'preventive':
        skills.push('Preventive Maintenance', 'Equipment Inspection');
        break;
      case 'corrective':
        skills.push('Troubleshooting', 'Repair Techniques');
        break;
      case 'predictive':
        skills.push('Condition Monitoring', 'Data Analysis');
        break;
      case 'emergency':
        skills.push('Emergency Response', 'Rapid Diagnosis');
        break;
      case 'shutdown':
        skills.push('Shutdown Planning', 'Project Management');
        break;
    }

    // Skills based on required tools
    if (this.requiredTools) {
      if (this.requiredTools.includes('multimeter')) skills.push('Electrical Testing');
      if (this.requiredTools.includes('torque wrench')) skills.push('Mechanical Assembly');
      if (this.requiredTools.includes('vibration analyzer')) skills.push('Vibration Analysis');
      if (this.requiredTools.includes('thermal camera')) skills.push('Thermal Imaging');
    }

    // Safety skills based on requirements
    if (this.safetyRequirements?.lockoutTagout) {
      skills.push('Lockout/Tagout Procedures');
    }
    if (this.safetyRequirements?.riskLevel === 'critical' || this.safetyRequirements?.riskLevel === 'high') {
      skills.push('High-Risk Work Procedures');
    }

    // Compliance skills
    if (this.complianceRequirements?.regulations?.length) {
      skills.push('Regulatory Compliance');
    }

    // Always need these for maintenance
    skills.push('Equipment Maintenance', 'Safety Procedures', 'Documentation');

    return [...new Set(skills)]; // Remove duplicates
  }

  // Maintenance-specific business logic
  isOverdue(): boolean {
    if (!this.nextDue || this.isCompleted()) return false;
    return new Date() > this.nextDue;
  }

  getDaysOverdue(): number {
    if (!this.isOverdue()) return 0;
    const diffTime = new Date().getTime() - this.nextDue!.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Scheduling helpers
  calculateNextDueDate(completionDate: Date = new Date()): Date | null {
    if (!this.frequency || this.frequency === 'as_needed' || this.frequency === 'condition_based') {
      return null;
    }

    const date = new Date(completionDate);

    switch (this.frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    return date;
  }

  scheduleNext(): void {
    if (this.isCompleted()) {
      this.lastCompleted = this.completedAt;
      this.nextDue = this.calculateNextDueDate(this.completedAt!);
    }
  }

  // Procedure management
  addProcedure(procedure: NonNullable<MaintenanceTask['procedures']>[0]): void {
    if (!this.procedures) {
      this.procedures = [];
    }
    this.procedures.push(procedure);
    this.procedures.sort((a, b) => a.step - b.step);
  }

  completeProcedureStep(stepNumber: number): void {
    const procedure = this.procedures?.find(p => p.step === stepNumber);
    if (procedure) {
      procedure.completed = true;
    }
  }

  getProcedureProgress(): { completed: number; total: number; percentage: number } {
    if (!this.procedures || this.procedures.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = this.procedures.filter(p => p.completed).length;
    const total = this.procedures.length;
    const percentage = (completed / total) * 100;

    return { completed, total, percentage };
  }

  // Parts management
  addRequiredPart(part: NonNullable<MaintenanceTask['requiredParts']>[0]): void {
    if (!this.requiredParts) {
      this.requiredParts = [];
    }
    this.requiredParts.push(part);
  }

  getTotalPartsValue(): number {
    if (!this.requiredParts) return 0;
    return this.requiredParts.reduce((total, part) => {
      return total + (part.cost ?? 0) * part.quantity;
    }, 0);
  }

  // Checklist management
  addChecklistItem(item: NonNullable<MaintenanceTask['completionChecklist']>[0]): void {
    if (!this.completionChecklist) {
      this.completionChecklist = [];
    }
    this.completionChecklist.push(item);
  }

  completeChecklistItem(itemIndex: number, notes?: string): void {
    if (this.completionChecklist && this.completionChecklist[itemIndex]) {
      this.completionChecklist[itemIndex].completed = true;
      if (notes) {
        this.completionChecklist[itemIndex].notes = notes;
      }
    }
  }

  getChecklistProgress(): { completed: number; total: number; percentage: number; requiredCompleted: number; requiredTotal: number } {
    if (!this.completionChecklist || this.completionChecklist.length === 0) {
      return { completed: 0, total: 0, percentage: 0, requiredCompleted: 0, requiredTotal: 0 };
    }

    const completed = this.completionChecklist.filter(item => item.completed).length;
    const total = this.completionChecklist.length;
    const requiredItems = this.completionChecklist.filter(item => item.required);
    const requiredCompleted = requiredItems.filter(item => item.completed).length;
    const requiredTotal = requiredItems.length;
    const percentage = (completed / total) * 100;

    return { completed, total, percentage, requiredCompleted, requiredTotal };
  }

  isChecklistComplete(): boolean {
    const progress = this.getChecklistProgress();
    return progress.requiredCompleted === progress.requiredTotal;
  }

  // Condition monitoring
  updateConditionParameter(parameterName: string, value: number): void {
    if (!this.conditionMonitoring) {
      this.conditionMonitoring = { parameters: [] };
    }
    if (!this.conditionMonitoring.parameters) {
      this.conditionMonitoring.parameters = [];
    }

    const parameter = this.conditionMonitoring.parameters.find(p => p.name === parameterName);
    if (parameter) {
      parameter.currentValue = value;
      // Determine status based on target value (simplified logic)
      if (parameter.targetValue) {
        const deviation = Math.abs(value - parameter.targetValue) / parameter.targetValue;
        if (deviation > 0.2) parameter.status = 'critical';
        else if (deviation > 0.1) parameter.status = 'warning';
        else parameter.status = 'good';
      }
    }
  }

  getCriticalConditions(): NonNullable<NonNullable<MaintenanceTask['conditionMonitoring']>['parameters']> {
    return this.conditionMonitoring?.parameters?.filter(p => p.status === 'critical') ?? [];
  }

  // Findings management
  addFinding(finding: NonNullable<MaintenanceTask['findings']>[0]): void {
    if (!this.findings) {
      this.findings = [];
    }
    this.findings.push(finding);
  }

  getCriticalFindings(): NonNullable<MaintenanceTask['findings']> {
    return this.findings?.filter(f => f.severity === 'critical') ?? [];
  }

  // Cost tracking
  updateActualCost(cost: number): void {
    if (cost < 0) throw new Error('Cost cannot be negative');
    this.actualCost = cost;
  }

  getCostVariance(): { amount: number; percentage: number } | null {
    if (!this.estimatedCost || !this.actualCost) return null;

    const amount = this.actualCost - this.estimatedCost;
    const percentage = (amount / this.estimatedCost) * 100;

    return { amount, percentage };
  }

  // Downtime tracking
  updateActualDowntime(minutes: number): void {
    if (minutes < 0) throw new Error('Downtime cannot be negative');
    this.actualDowntime = minutes;
  }

  getDowntimeVariance(): { amount: number; percentage: number } | null {
    if (!this.estimatedDowntime || !this.actualDowntime) return null;

    const amount = this.actualDowntime - this.estimatedDowntime;
    const percentage = (amount / this.estimatedDowntime) * 100;

    return { amount, percentage };
  }

  // Maintenance effectiveness
  calculateMaintenanceEffectiveness(): { score: number; factors: Record<string, number> } {
    const factors: Record<string, number> = {};

    // Schedule adherence (25%)
    factors.scheduleAdherence = this.calculateScheduleAdherence();

    // Cost efficiency (25%)
    factors.costEfficiency = this.calculateCostEfficiency();

    // Quality (25%)
    factors.quality = this.calculateQualityScore();

    // Safety (25%)
    factors.safety = this.calculateSafetyScore();

    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0) / 4;

    return { score: Math.round(totalScore), factors };
  }

  private calculateScheduleAdherence(): number {
    if (this.isCompleted() && this.dueDate && this.completedAt) {
      return this.completedAt <= this.dueDate ? 100 : 50;
    }
    return this.isOverdue() ? 0 : 100;
  }

  private calculateCostEfficiency(): number {
    const variance = this.getCostVariance();
    if (!variance) return 100;

    if (variance.percentage <= 0) return 100; // Under or on budget
    if (variance.percentage <= 10) return 90;
    if (variance.percentage <= 25) return 70;
    return 50;
  }

  private calculateQualityScore(): number {
    let score = 100;

    // Deduct for critical findings
    const criticalFindings = this.getCriticalFindings().length;
    score -= criticalFindings * 20;

    // Deduct for incomplete required checklist items
    const checklistProgress = this.getChecklistProgress();
    if (checklistProgress.requiredTotal > 0) {
      const incompletePenalty = ((checklistProgress.requiredTotal - checklistProgress.requiredCompleted) / checklistProgress.requiredTotal) * 30;
      score -= incompletePenalty;
    }

    return Math.max(0, score);
  }

  private calculateSafetyScore(): number {
    let score = 100;

    // Check for safety requirement compliance
    if (this.safetyRequirements?.riskLevel === 'critical' || this.safetyRequirements?.riskLevel === 'high') {
      // High-risk tasks require perfect safety compliance
      if (!this.safetyRequirements.ppe?.length) score -= 30;
      if (this.safetyRequirements.lockoutTagout && !this.completionChecklist?.some(item => item.item.toLowerCase().includes('lockout'))) {
        score -= 40;
      }
    }

    return Math.max(0, score);
  }

  // Complete maintenance task with full workflow
  completeMaintenanceTask(completionNotes?: string): void {
    // Validate required checklist items are completed
    if (!this.isChecklistComplete()) {
      throw new Error('All required checklist items must be completed');
    }

    this.completionNotes = completionNotes;
    this.completeTask();
    this.scheduleNext();
  }
}