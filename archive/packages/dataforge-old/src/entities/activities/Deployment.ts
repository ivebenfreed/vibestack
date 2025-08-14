import { Entity, Property } from '@mikro-orm/core';
import { ActivityArchetype } from '../archetypes/ActivityArchetype.js';

/**
 * Deployment activity with release management and infrastructure features
 * Extends ActivityArchetype with deployment-specific workflows
 */
@Entity({ tableName: 'deployment' })
export class Deployment extends ActivityArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'deployment_type' })
  deploymentType?: 'blue_green' | 'rolling' | 'canary' | 'recreate' | 'a_b_test' | 'hotfix';

  @Property({ type: 'string', nullable: true, fieldName: 'target_environment' })
  targetEnvironment?: 'development' | 'staging' | 'production' | 'testing' | 'demo';

  @Property({ type: 'string', nullable: true })
  version?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'release_branch' })
  releaseBranch?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'commit_hash' })
  commitHash?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'deployment_config' })
  deploymentConfig?: {
    replicas?: number;
    resources?: {
      cpu?: string;
      memory?: string;
      storage?: string;
    };
    environmentVariables?: Record<string, string>;
    secrets?: string[];
    configMaps?: string[];
    healthCheck?: {
      enabled: boolean;
      path?: string;
      port?: number;
      interval?: number;
      timeout?: number;
      retries?: number;
    };
    scaling?: {
      minReplicas?: number;
      maxReplicas?: number;
      targetCpuPercent?: number;
      targetMemoryPercent?: number;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'infrastructure' })
  infrastructure?: {
    provider?: 'aws' | 'gcp' | 'azure' | 'kubernetes' | 'docker' | 'on_premise';
    region?: string;
    cluster?: string;
    namespace?: string;
    nodes?: number;
    loadBalancer?: {
      type: string;
      endpoint?: string;
      healthCheck?: boolean;
    };
    database?: {
      migrationRequired?: boolean;
      backupRequired?: boolean;
      downtime?: boolean;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'rollback_config' })
  rollbackConfig?: {
    enabled: boolean;
    previousVersion?: string;
    previousCommit?: string;
    autoRollback?: {
      enabled: boolean;
      errorThreshold?: number;
      timeWindow?: number; // minutes
      conditions?: string[];
    };
    manualRollback?: {
      approvalRequired?: boolean;
      approvers?: string[];
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'monitoring_config' })
  monitoringConfig?: {
    healthChecks?: Array<{
      name: string;
      url: string;
      method: 'GET' | 'POST' | 'HEAD';
      expectedStatus: number;
      timeout: number;
      interval: number;
    }>;
    alerts?: Array<{
      metric: string;
      threshold: number;
      operator: 'gt' | 'lt' | 'eq' | 'ne';
      duration: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recipients: string[];
    }>;
    dashboards?: string[];
    logCollection?: boolean;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'security_config' })
  securityConfig?: {
    vulnerabilityScanning?: boolean;
    secretsManagement?: boolean;
    networkPolicies?: boolean;
    rbacEnabled?: boolean;
    tlsEnabled?: boolean;
    certificateManagement?: {
      provider?: string;
      autoRenewal?: boolean;
      domains?: string[];
    };
    compliance?: {
      standards?: string[];
      auditRequired?: boolean;
      dataEncryption?: boolean;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'traffic_management' })
  trafficManagement?: {
    strategy?: 'immediate' | 'gradual' | 'canary' | 'feature_flag';
    canaryConfig?: {
      percentage?: number;
      duration?: number; // minutes
      successCriteria?: Array<{
        metric: string;
        threshold: number;
        operator: string;
      }>;
    };
    featureFlags?: Array<{
      flag: string;
      enabled: boolean;
      percentage: number;
      audience?: string[];
    }>;
    loadBalancing?: {
      algorithm?: 'round_robin' | 'least_connections' | 'weighted' | 'ip_hash';
      stickySessions?: boolean;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'backup_strategy' })
  backupStrategy?: {
    databaseBackup?: {
      required: boolean;
      type?: 'full' | 'incremental' | 'differential';
      retention?: number; // days
      verification?: boolean;
    };
    applicationBackup?: {
      configBackup?: boolean;
      dataBackup?: boolean;
      userContentBackup?: boolean;
    };
    rollbackPoint?: {
      created: boolean;
      location?: string;
      expiresAt?: Date;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'deployment_metrics' })
  deploymentMetrics?: {
    deploymentTime?: number; // seconds
    downtime?: number; // seconds
    rollbackTime?: number; // seconds
    successRate?: number; // percentage
    meanTimeToRecovery?: number; // minutes
    changeFailureRate?: number; // percentage
    leadTime?: number; // hours from commit to deploy
    deploymentFrequency?: number; // deploys per day
    customMetrics?: Record<string, number>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'post_deployment' })
  postDeployment?: {
    smokeTests?: Array<{
      name: string;
      status: 'pending' | 'running' | 'passed' | 'failed';
      url?: string;
      duration?: number;
      error?: string;
    }>;
    verification?: Array<{
      check: string;
      status: 'pending' | 'passed' | 'failed';
      details?: string;
      verifiedBy?: string;
      verifiedAt?: Date;
    }>;
    notifications?: Array<{
      channel: string;
      message: string;
      sent: boolean;
      sentAt?: Date;
    }>;
    documentation?: {
      releaseNotes?: string;
      deploymentLog?: string;
      knownIssues?: string[];
      userImpact?: string;
    };
  };

  // Implementation of abstract methods
  getActivityType(): string {
    return 'deployment';
  }

  async validateActivityRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Deployment specific validation
    if (!this.version) {
      return false; // Version is required for deployments
    }

    if (!this.targetEnvironment) {
      return false; // Target environment is required
    }

    // Production deployment requires additional approvals
    if (this.targetEnvironment === 'production') {
      if (!this.requiresApproval()) {
        return false; // Production deployments must require approval
      }
    }

    // Validate rollback configuration for production
    if (this.targetEnvironment === 'production' && !this.rollbackConfig?.enabled) {
      return false; // Production deployments must have rollback enabled
    }

    return true;
  }

  async canExecute(): Promise<boolean> {
    // Check base conditions
    if (!this.isDependenciesSatisfied()) return false;
    if (this.requiresApproval() && !this.isApproved()) return false;

    // Deployment-specific checks
    if (this.targetEnvironment === 'production') {
      // Ensure all required backups are completed
      if (this.backupStrategy?.databaseBackup?.required && !this.hasCompletedBackup()) {
        return false;
      }

      // Ensure security scans passed
      if (this.securityConfig?.vulnerabilityScanning && !this.hasPassedSecurityScan()) {
        return false;
      }
    }

    // Check infrastructure readiness
    if (!this.isInfrastructureReady()) {
      return false;
    }

    return true;
  }

  async executeActivity(): Promise<void> {
    // Start deployment process
    this.startProcessing();
    
    try {
      // Step 1: Pre-deployment checks
      await this.runPreDeploymentChecks();
      
      // Step 2: Create backup/rollback point
      if (this.backupStrategy?.rollbackPoint) {
        await this.createRollbackPoint();
      }
      
      // Step 3: Execute deployment based on strategy
      await this.executeDeploymentStrategy();
      
      // Step 4: Health checks and verification
      await this.runHealthChecks();
      
      // Step 5: Post-deployment verification
      await this.runPostDeploymentVerification();
      
      // Step 6: Traffic management
      if (this.trafficManagement?.strategy !== 'immediate') {
        await this.manageTrafficTransition();
      }
      
      // Step 7: Enable monitoring and alerts
      await this.enableMonitoring();
      
      this.completeProcessing({
        deployed: true,
        version: this.version,
        environment: this.targetEnvironment,
        strategy: this.deploymentType
      });

    } catch (error) {
      this.failProcessing([error instanceof Error ? error.message : 'Unknown deployment error']);
      
      // Attempt automatic rollback if configured
      if (this.rollbackConfig?.autoRollback?.enabled) {
        await this.triggerAutoRollback();
      }
    }
  }

  // Deployment specific business logic
  private async runPreDeploymentChecks(): Promise<void> {
    // Validate deployment configuration
    if (!this.deploymentConfig) {
      throw new Error('Deployment configuration is required');
    }

    // Check resource availability
    if (this.deploymentConfig.resources) {
      // Simulate resource check
      const resourcesAvailable = await this.checkResourceAvailability();
      if (!resourcesAvailable) {
        throw new Error('Insufficient resources for deployment');
      }
    }

    // Validate environment variables and secrets
    if (this.deploymentConfig.secrets?.length) {
      const secretsValid = await this.validateSecrets();
      if (!secretsValid) {
        throw new Error('Required secrets are missing or invalid');
      }
    }
  }

  private async createRollbackPoint(): Promise<void> {
    // Create application and database backup
    const backupLocation = `/backups/${this.targetEnvironment}/${this.version}-${Date.now()}`;
    
    if (this.backupStrategy) {
      this.backupStrategy.rollbackPoint = {
        created: true,
        location: backupLocation,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };
    }
  }

  private async executeDeploymentStrategy(): Promise<void> {
    const startTime = Date.now();
    
    switch (this.deploymentType) {
      case 'blue_green':
        await this.executeBlueGreenDeployment();
        break;
      case 'rolling':
        await this.executeRollingDeployment();
        break;
      case 'canary':
        await this.executeCanaryDeployment();
        break;
      case 'recreate':
        await this.executeRecreateDeployment();
        break;
      default:
        await this.executeStandardDeployment();
    }
    
    // Record deployment time
    const deploymentTime = Math.floor((Date.now() - startTime) / 1000);
    this.updateDeploymentMetric('deploymentTime', deploymentTime);
  }

  private async executeBlueGreenDeployment(): Promise<void> {
    // Deploy to green environment
    this.setMetadata('deploymentPhase', 'green_deployment');
    
    // Simulate green environment deployment
    await this.simulateDeploymentStep('Deploy to green environment', 30000);
    
    // Run smoke tests on green
    await this.runSmokeTests('green');
    
    // Switch traffic from blue to green
    this.setMetadata('deploymentPhase', 'traffic_switch');
    await this.simulateDeploymentStep('Switch traffic to green', 5000);
    
    // Keep blue environment for quick rollback
    this.setMetadata('deploymentPhase', 'blue_standby');
  }

  private async executeRollingDeployment(): Promise<void> {
    const replicas = this.deploymentConfig?.replicas || 3;
    const batchSize = Math.max(1, Math.floor(replicas * 0.25)); // 25% at a time
    
    for (let i = 0; i < replicas; i += batchSize) {
      const currentBatch = Math.min(batchSize, replicas - i);
      this.setMetadata('deploymentPhase', `rolling_batch_${Math.floor(i / batchSize) + 1}`);
      
      await this.simulateDeploymentStep(`Deploy batch ${currentBatch} instances`, 15000);
      await this.runHealthChecks();
    }
  }

  private async executeCanaryDeployment(): Promise<void> {
    const canaryPercentage = this.trafficManagement?.canaryConfig?.percentage || 10;
    
    // Deploy canary version
    this.setMetadata('deploymentPhase', 'canary_deployment');
    await this.simulateDeploymentStep('Deploy canary version', 20000);
    
    // Route canary traffic
    await this.simulateDeploymentStep(`Route ${canaryPercentage}% traffic to canary`, 5000);
    
    // Monitor canary metrics
    const canarySuccess = await this.monitorCanaryMetrics();
    
    if (canarySuccess) {
      // Promote canary to full deployment
      await this.simulateDeploymentStep('Promote canary to full deployment', 25000);
    } else {
      throw new Error('Canary deployment failed success criteria');
    }
  }

  private async executeRecreateDeployment(): Promise<void> {
    // Stop old version (causes downtime)
    const downtimeStart = Date.now();
    await this.simulateDeploymentStep('Stop old version', 5000);
    
    // Deploy new version
    await this.simulateDeploymentStep('Deploy new version', 30000);
    
    // Start new version
    await this.simulateDeploymentStep('Start new version', 10000);
    
    // Record downtime
    const downtime = Math.floor((Date.now() - downtimeStart) / 1000);
    this.updateDeploymentMetric('downtime', downtime);
  }

  private async executeStandardDeployment(): Promise<void> {
    await this.simulateDeploymentStep('Standard deployment', 25000);
  }

  private async simulateDeploymentStep(stepName: string, duration: number): Promise<void> {
    // In a real implementation, this would execute actual deployment commands
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`Completed: ${stepName}`);
        resolve();
      }, Math.random() * duration);
    });
  }

  private async runHealthChecks(): Promise<void> {
    if (!this.monitoringConfig?.healthChecks) return;
    
    for (const healthCheck of this.monitoringConfig.healthChecks) {
      const success = Math.random() > 0.1; // 90% success rate simulation
      if (!success) {
        throw new Error(`Health check failed: ${healthCheck.name}`);
      }
    }
  }

  private async runPostDeploymentVerification(): Promise<void> {
    // Run smoke tests
    if (this.postDeployment?.smokeTests) {
      for (const test of this.postDeployment.smokeTests) {
        test.status = 'running';
        
        // Simulate test execution
        const success = Math.random() > 0.05; // 95% success rate
        test.status = success ? 'passed' : 'failed';
        test.duration = Math.floor(Math.random() * 30000); // 0-30 seconds
        
        if (!success) {
          test.error = 'Smoke test failed - service not responding correctly';
          throw new Error(`Smoke test failed: ${test.name}`);
        }
      }
    }

    // Run verification checks
    if (this.postDeployment?.verification) {
      for (const check of this.postDeployment.verification) {
        check.status = Math.random() > 0.02 ? 'passed' : 'failed'; // 98% success rate
        check.verifiedAt = new Date();
        
        if (check.status === 'failed') {
          throw new Error(`Verification failed: ${check.check}`);
        }
      }
    }
  }

  private async manageTrafficTransition(): Promise<void> {
    const strategy = this.trafficManagement?.strategy;
    
    switch (strategy) {
      case 'gradual':
        await this.executeGradualTrafficTransition();
        break;
      case 'canary':
        // Already handled in canary deployment
        break;
      case 'feature_flag':
        await this.updateFeatureFlags();
        break;
    }
  }

  private async executeGradualTrafficTransition(): Promise<void> {
    const percentages = [25, 50, 75, 100];
    
    for (const percentage of percentages) {
      await this.simulateDeploymentStep(`Route ${percentage}% traffic to new version`, 10000);
      
      // Monitor metrics for a period
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
      
      // Check if metrics are healthy
      const metricsHealthy = await this.checkMetricsHealth();
      if (!metricsHealthy) {
        throw new Error(`Metrics unhealthy at ${percentage}% traffic`);
      }
    }
  }

  private async updateFeatureFlags(): Promise<void> {
    if (!this.trafficManagement?.featureFlags) return;
    
    for (const flag of this.trafficManagement.featureFlags) {
      // Simulate feature flag update
      await this.simulateDeploymentStep(`Update feature flag: ${flag.flag}`, 2000);
    }
  }

  private async enableMonitoring(): Promise<void> {
    if (this.monitoringConfig?.alerts) {
      // Enable deployment-specific alerts
      await this.simulateDeploymentStep('Enable monitoring alerts', 5000);
    }
    
    if (this.monitoringConfig?.logCollection) {
      await this.simulateDeploymentStep('Start log collection', 3000);
    }
  }

  private async monitorCanaryMetrics(): Promise<boolean> {
    const config = this.trafficManagement?.canaryConfig;
    if (!config?.successCriteria) return true;
    
    // Monitor for the specified duration
    const duration = config.duration || 30; // minutes
    await new Promise(resolve => setTimeout(resolve, duration * 1000)); // Simulate monitoring
    
    // Check success criteria
    return config.successCriteria.every(criterion => {
      const actualValue = Math.random() * 100; // Simulate metric value
      switch (criterion.operator) {
        case 'lt': return actualValue < criterion.threshold;
        case 'gt': return actualValue > criterion.threshold;
        case 'eq': return actualValue === criterion.threshold;
        default: return true;
      }
    });
  }

  private async checkMetricsHealth(): Promise<boolean> {
    // Simulate metrics check
    const errorRate = Math.random() * 10; // 0-10% error rate
    const responseTime = Math.random() * 1000; // 0-1000ms response time
    
    return errorRate < 5 && responseTime < 500; // Healthy thresholds
  }

  // Helper methods for validation
  private async checkResourceAvailability(): Promise<boolean> {
    // Simulate resource availability check
    return Math.random() > 0.05; // 95% availability
  }

  private async validateSecrets(): Promise<boolean> {
    // Simulate secret validation
    return Math.random() > 0.02; // 98% success rate
  }

  private hasCompletedBackup(): boolean {
    return this.backupStrategy?.rollbackPoint?.created ?? false;
  }

  private hasPassedSecurityScan(): boolean {
    // In real implementation, check actual security scan results
    return Math.random() > 0.1; // 90% pass rate simulation
  }

  private isInfrastructureReady(): boolean {
    // Check if infrastructure is ready for deployment
    return Math.random() > 0.05; // 95% readiness simulation
  }

  private async runSmokeTests(environment: string): Promise<void> {
    // Simulate smoke test execution
    await this.simulateDeploymentStep(`Run smoke tests on ${environment}`, 15000);
  }

  private updateDeploymentMetric(metric: string, value: number): void {
    if (!this.deploymentMetrics) {
      this.deploymentMetrics = {};
    }
    
    if (!this.deploymentMetrics.customMetrics) {
      this.deploymentMetrics.customMetrics = {};
    }
    
    this.deploymentMetrics.customMetrics[metric] = value;
  }

  // Rollback functionality
  async triggerRollback(reason: string, userId?: string): Promise<boolean> {
    if (!this.rollbackConfig?.enabled) return false;
    
    const rollbackStartTime = Date.now();
    
    try {
      this.setMetadata('rollbackReason', reason);
      this.setMetadata('rollbackInitiatedBy', userId);
      this.setMetadata('rollbackStartTime', new Date().toISOString());
      
      // Execute rollback based on deployment type
      await this.executeRollback();
      
      // Record rollback time
      const rollbackTime = Math.floor((Date.now() - rollbackStartTime) / 1000);
      this.updateDeploymentMetric('rollbackTime', rollbackTime);
      
      this.setMetadata('rollbackCompleted', true);
      return true;
      
    } catch (error) {
      this.setMetadata('rollbackFailed', true);
      this.setMetadata('rollbackError', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  private async executeRollback(): Promise<void> {
    switch (this.deploymentType) {
      case 'blue_green':
        await this.simulateDeploymentStep('Switch traffic back to blue', 5000);
        break;
      case 'rolling':
        await this.simulateDeploymentStep('Rolling rollback to previous version', 20000);
        break;
      case 'canary':
        await this.simulateDeploymentStep('Remove canary and restore original', 10000);
        break;
      default:
        await this.simulateDeploymentStep('Restore from backup', 30000);
    }
  }

  private async triggerAutoRollback(): Promise<void> {
    const config = this.rollbackConfig?.autoRollback;
    if (!config?.enabled) return;
    
    // Check if conditions are met for auto-rollback
    const shouldRollback = await this.evaluateAutoRollbackConditions();
    
    if (shouldRollback) {
      await this.triggerRollback('Automatic rollback triggered due to deployment failure', 'system');
    }
  }

  private async evaluateAutoRollbackConditions(): Promise<boolean> {
    const config = this.rollbackConfig?.autoRollback;
    if (!config) return false;
    
    // Check error threshold
    if (config.errorThreshold) {
      const currentErrorRate = this.performanceMetrics?.errorRate || 0;
      if (currentErrorRate > config.errorThreshold) return true;
    }
    
    // Check other conditions
    if (config.conditions) {
      // In real implementation, evaluate actual conditions
      return Math.random() < 0.2; // 20% chance of meeting rollback conditions
    }
    
    return false;
  }

  // Deployment management methods
  isBlueGreenDeployment(): boolean {
    return this.deploymentType === 'blue_green';
  }

  isCanaryDeployment(): boolean {
    return this.deploymentType === 'canary';
  }

  isProductionDeployment(): boolean {
    return this.targetEnvironment === 'production';
  }

  getDeploymentProgress(): { phase: string; percentage: number; currentStep?: string } {
    const phase = this.getMetadata('deploymentPhase') || 'preparing';
    const progress = this.getExecutionProgress();
    
    return {
      phase,
      percentage: progress.percentage,
      currentStep: this.getMetadata('currentStep')
    };
  }

  calculateDeploymentHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const health = this.getActivityHealth();
    
    // Add deployment-specific factors
    const deploymentFactors: Record<string, number> = {};
    const deploymentIssues: string[] = [];
    
    // Security compliance
    if (this.isProductionDeployment()) {
      if (!this.securityConfig?.vulnerabilityScanning) {
        deploymentIssues.push('Production deployment missing vulnerability scanning');
        deploymentFactors.security = 60;
      } else {
        deploymentFactors.security = 90;
      }
    }
    
    // Rollback readiness
    if (this.isProductionDeployment() && !this.rollbackConfig?.enabled) {
      deploymentIssues.push('Production deployment without rollback capability');
      deploymentFactors.rollback = 40;
    } else {
      deploymentFactors.rollback = 85;
    }
    
    // Monitoring coverage
    if (!this.monitoringConfig?.healthChecks?.length) {
      deploymentIssues.push('Deployment lacks health checks');
      deploymentFactors.monitoring = 50;
    } else {
      deploymentFactors.monitoring = 80;
    }
    
    // Combine with base health factors
    const combinedFactors = { ...health.factors, ...deploymentFactors };
    const combinedIssues = [...health.issues, ...deploymentIssues];
    
    // Recalculate score with deployment factors
    const totalScore = Object.values(combinedFactors).reduce((sum, score) => sum + score, 0) / Object.keys(combinedFactors).length;
    
    return {
      score: Math.round(totalScore),
      factors: combinedFactors,
      issues: combinedIssues
    };
  }

  getEstimatedDowntime(): number {
    switch (this.deploymentType) {
      case 'blue_green':
      case 'canary':
        return 0; // Zero downtime deployments
      case 'rolling':
        return 0; // No downtime if done correctly
      case 'recreate':
        return this.estimatedDuration || 30; // Estimated downtime in minutes
      default:
        return 5; // Minimal downtime for standard deployment
    }
  }

  requiresMaintenanceWindow(): boolean {
    return this.deploymentType === 'recreate' || 
           this.infrastructure?.database?.migrationRequired ||
           this.isProductionDeployment() && this.getEstimatedDowntime() > 0;
  }
}