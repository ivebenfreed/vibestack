import { Entity, Property } from '@mikro-orm/core';
import { CollectionArchetype } from '../archetypes/CollectionArchetype.js';

/**
 * Dashboard collection with real-time monitoring and visualization features
 * Extends CollectionArchetype with dashboard-specific functionality
 * Demonstrates cross-archetype integration and universal container capabilities
 */
@Entity({ tableName: 'dashboard' })
export class Dashboard extends CollectionArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'dashboard_type' })
  dashboardType?: 'executive' | 'operational' | 'analytical' | 'personal' | 'team' | 'project' | 'system';

  @Property({ type: 'string', nullable: true, fieldName: 'refresh_frequency' })
  refreshFrequency?: 'realtime' | '1min' | '5min' | '15min' | '1hour' | '1day' | 'manual';

  @Property({ type: 'json', nullable: true, fieldName: 'layout_config' })
  layoutConfig?: {
    type: 'grid' | 'masonry' | 'flow' | 'tabs' | 'accordion';
    columns: number;
    rowHeight: number;
    gap: number;
    responsive: boolean;
    breakpoints?: Record<string, { columns: number; gap: number }>;
    customCSS?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'widget_definitions' })
  widgetDefinitions?: Array<{
    widgetId: string;
    title: string;
    type: 'metric' | 'chart' | 'table' | 'list' | 'progress' | 'status' | 'activity' | 'custom';
    position: { x: number; y: number; width: number; height: number };
    dataSource: {
      archetype: 'project' | 'task' | 'file' | 'activity' | 'discussion' | 'record' | 'document' | 'collection';
      entityIds?: string[];
      query?: {
        filters: Record<string, any>;
        aggregations: Array<{
          field: string;
          operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
          groupBy?: string;
        }>;
        sorting?: Array<{
          field: string;
          direction: 'asc' | 'desc';
        }>;
        limit?: number;
      };
      refreshInterval: number; // milliseconds
    };
    visualization: {
      chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'scatter' | 'gauge' | 'table' | 'kanban';
      options?: Record<string, any>;
      formatting?: {
        numberFormat?: string;
        dateFormat?: string;
        colorScheme?: string[];
        thresholds?: Array<{
          value: number;
          color: string;
          label?: string;
        }>;
      };
    };
    interactions?: {
      clickable: boolean;
      drillDown?: {
        enabled: boolean;
        target: 'modal' | 'page' | 'sidebar';
        url?: string;
      };
      filters?: Array<{
        field: string;
        type: 'dropdown' | 'range' | 'date' | 'search';
        options?: any[];
      }>;
    };
    permissions?: {
      viewRoles: string[];
      editRoles: string[];
      hideWhenEmpty: boolean;
    };
    caching?: {
      enabled: boolean;
      ttl: number; // seconds
      invalidateOn: string[];
    };
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'realtime_config' })
  realtimeConfig?: {
    enabled: boolean;
    websocketEndpoint?: string;
    eventTypes: string[];
    subscriptions: Array<{
      archetype: string;
      entityIds: string[];
      events: string[];
      widgetIds: string[];
    }>;
    reconnectSettings: {
      maxRetries: number;
      retryDelay: number; // milliseconds
      exponentialBackoff: boolean;
    };
    heartbeat: {
      enabled: boolean;
      interval: number; // milliseconds
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'performance_monitoring' })
  performanceMonitoring?: {
    enabled: boolean;
    metrics: {
      loadTime: number; // milliseconds
      renderTime: number; // milliseconds
      dataFetchTime: number; // milliseconds
      memoryUsage: number; // bytes
      widgetPerformance: Record<string, {
        avgLoadTime: number;
        errorCount: number;
        lastError?: string;
        cacheHitRate: number;
      }>;
    };
    alerts: Array<{
      metric: 'loadTime' | 'renderTime' | 'dataFetchTime' | 'memoryUsage' | 'errorCount';
      threshold: number;
      operator: 'gt' | 'lt' | 'eq';
      action: 'log' | 'notify' | 'disable_widget';
      recipients?: string[];
      enabled: boolean;
    }>;
    optimization: {
      autoOptimize: boolean;
      lazyLoading: boolean;
      virtualScrolling: boolean;
      dataCompression: boolean;
      widgetPooling: boolean;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'user_personalization' })
  userPersonalization?: Record<string, {
    layout?: any;
    widgetSettings?: Record<string, any>;
    filters?: Record<string, any>;
    preferences?: {
      theme: 'light' | 'dark' | 'auto';
      animations: boolean;
      notifications: boolean;
      autoRefresh: boolean;
      defaultView: string;
    };
    bookmarks?: Array<{
      name: string;
      filters: Record<string, any>;
      view: string;
      createdAt: Date;
    }>;
    recentActivity?: Array<{
      action: string;
      widgetId: string;
      timestamp: Date;
      details: Record<string, any>;
    }>;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'alert_system' })
  alertSystem?: {
    enabled: boolean;
    globalAlerts: Array<{
      id: string;
      name: string;
      description: string;
      condition: {
        archetype: string;
        field: string;
        operator: 'gt' | 'lt' | 'eq' | 'ne' | 'in' | 'not_in' | 'contains' | 'regex';
        value: any;
        aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
      };
      severity: 'info' | 'warning' | 'error' | 'critical';
      notifications: {
        channels: Array<'email' | 'slack' | 'webhook' | 'in_app' | 'sms'>;
        recipients: string[];
        template?: string;
        throttling: {
          enabled: boolean;
          interval: number; // minutes
          maxPerInterval: number;
        };
      };
      enabled: boolean;
      createdBy: string;
      createdAt: Date;
      lastTriggered?: Date;
      triggerCount: number;
    }>;
    alertHistory: Array<{
      alertId: string;
      triggeredAt: Date;
      value: any;
      recipients: string[];
      resolved?: boolean;
      resolvedAt?: Date;
      resolvedBy?: string;
      notes?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'automation_workflows' })
  automationWorkflows?: Array<{
    id: string;
    name: string;
    description: string;
    trigger: {
      type: 'schedule' | 'data_change' | 'threshold' | 'event';
      configuration: Record<string, any>;
    };
    conditions: Array<{
      archetype: string;
      field: string;
      operator: string;
      value: any;
    }>;
    actions: Array<{
      type: 'update_widget' | 'send_notification' | 'create_task' | 'update_collection' | 'export_data';
      parameters: Record<string, any>;
      delay?: number; // milliseconds
    }>;
    enabled: boolean;
    createdBy: string;
    createdAt: Date;
    lastExecuted?: Date;
    executionCount: number;
    successRate: number; // percentage
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'data_sources' })
  dataSources?: Array<{
    id: string;
    name: string;
    type: 'internal' | 'api' | 'database' | 'file' | 'webhook';
    configuration: {
      endpoint?: string;
      authentication?: {
        type: 'none' | 'api_key' | 'oauth' | 'basic';
        credentials?: Record<string, any>;
      };
      connection?: {
        host?: string;
        port?: number;
        database?: string;
        ssl?: boolean;
      };
      polling?: {
        enabled: boolean;
        interval: number; // seconds
        timeout: number; // seconds
      };
    };
    schema: {
      fields: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
        description?: string;
        nullable: boolean;
      }>;
      relationships?: Array<{
        field: string;
        relatedSource: string;
        relatedField: string;
      }>;
    };
    status: 'active' | 'inactive' | 'error' | 'testing';
    lastSync?: Date;
    nextSync?: Date;
    errorCount: number;
    lastError?: string;
    performance: {
      avgResponseTime: number; // milliseconds
      successRate: number; // percentage
      dataVolume: number; // bytes per sync
    };
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'cross_archetype_insights' })
  crossArchetypeInsights?: {
    correlationAnalysis: Array<{
      archetype1: string;
      archetype2: string;
      metric1: string;
      metric2: string;
      correlation: number; // -1 to 1
      pValue: number;
      significance: 'high' | 'medium' | 'low' | 'none';
      insights: string[];
    }>;
    trendAnalysis: Array<{
      archetype: string;
      metric: string;
      trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
      changeRate: number; // percentage
      confidence: number; // 0-100
      predictions: Array<{
        period: string;
        value: number;
        confidence: number;
      }>;
    }>;
    impactAnalysis: Array<{
      sourceArchetype: string;
      sourceMetric: string;
      targetArchetype: string;
      targetMetric: string;
      impactStrength: number; // 0-100
      delayDays: number;
      description: string;
    }>;
    anomalies: Array<{
      archetype: string;
      entityId: string;
      metric: string;
      expectedValue: number;
      actualValue: number;
      deviation: number;
      severity: 'low' | 'medium' | 'high';
      detectedAt: Date;
      resolved: boolean;
      possibleCauses: string[];
    }>;
    recommendations: Array<{
      type: 'optimization' | 'integration' | 'automation' | 'monitoring';
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      effort: 'low' | 'medium' | 'high';
      expectedImpact: string;
      actionItems: string[];
      relatedArchetypes: string[];
    }>;
  };

  // Implementation of abstract methods
  getCollectionType(): string {
    return 'dashboard';
  }

  async validateCollectionRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Dashboard specific validation
    if (!this.dashboardType) {
      return false; // Dashboard type is required
    }

    // Validate widget definitions
    if (this.widgetDefinitions) {
      for (const widget of this.widgetDefinitions) {
        if (!widget.widgetId || !widget.title || !widget.type) {
          return false; // Widget must have ID, title, and type
        }
        
        if (!widget.dataSource || !widget.dataSource.archetype) {
          return false; // Widget must have valid data source
        }
      }
    }

    // Validate layout configuration
    if (this.layoutConfig) {
      if (this.layoutConfig.columns < 1 || this.layoutConfig.columns > 12) {
        return false; // Invalid column count
      }
    }

    return true;
  }

  async processCollectionData(): Promise<void> {
    try {
      // Process all widget data sources
      await this.processWidgetData();
      
      // Update cross-archetype analysis
      await this.updateCrossArchetypeAnalysis();
      
      // Generate performance metrics
      this.updatePerformanceMetrics();
      
      // Process automation workflows
      await this.processAutomationWorkflows();
      
      // Update real-time subscriptions
      this.updateRealtimeSubscriptions();
      
    } catch (error) {
      console.error('Dashboard processing error:', error);
    }
  }

  async generateInsights(): Promise<void> {
    try {
      // Generate cross-archetype insights
      await this.analyzeCrossArchetypePatterns();
      
      // Detect anomalies across all archetypes
      await this.detectAnomalies();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Update AI insights if enabled
      if (this.aiInsights?.enabled) {
        await this.updateAIInsights();
      }
      
    } catch (error) {
      console.error('Dashboard insight generation error:', error);
    }
  }

  // Dashboard-specific business logic
  private async processWidgetData(): Promise<void> {
    if (!this.widgetDefinitions) return;

    for (const widget of this.widgetDefinitions) {
      await this.refreshWidgetData(widget);
    }
  }

  private async refreshWidgetData(widget: NonNullable<Dashboard['widgetDefinitions']>[0]): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simulate data fetching based on archetype
      const data = await this.fetchArchetypeData(widget.dataSource);
      
      // Update widget cache if enabled
      if (widget.caching?.enabled) {
        this.cacheWidgetData(widget.widgetId, data, widget.caching.ttl);
      }

      // Record performance metrics
      const loadTime = Date.now() - startTime;
      this.updateWidgetPerformance(widget.widgetId, loadTime, true);

    } catch (error) {
      const loadTime = Date.now() - startTime;
      this.updateWidgetPerformance(widget.widgetId, loadTime, false, error instanceof Error ? error.message : 'Unknown error');
      
      console.error(`Widget ${widget.widgetId} data refresh failed:`, error);
    }
  }

  private async fetchArchetypeData(dataSource: NonNullable<Dashboard['widgetDefinitions']>[0]['dataSource']): Promise<any[]> {
    // Simulate fetching data from different archetypes
    const { archetype, query, entityIds } = dataSource;
    
    // In a real implementation, this would query the actual entities
    switch (archetype) {
      case 'project':
        return this.mockProjectData(query, entityIds);
      case 'task':
        return this.mockTaskData(query, entityIds);
      case 'file':
        return this.mockFileData(query, entityIds);
      case 'activity':
        return this.mockActivityData(query, entityIds);
      case 'discussion':
        return this.mockDiscussionData(query, entityIds);
      default:
        return [];
    }
  }

  private mockProjectData(query?: any, entityIds?: string[]): any[] {
    // Mock project data
    return [
      { id: '1', name: 'Project Alpha', status: 'active', progress: 75, team_size: 5, budget: 100000 },
      { id: '2', name: 'Project Beta', status: 'completed', progress: 100, team_size: 3, budget: 75000 },
      { id: '3', name: 'Project Gamma', status: 'planning', progress: 25, team_size: 8, budget: 150000 }
    ];
  }

  private mockTaskData(query?: any, entityIds?: string[]): any[] {
    // Mock task data
    return [
      { id: '1', title: 'Design UI', status: 'completed', priority: 'high', assigned_to: 'user1' },
      { id: '2', title: 'Implement API', status: 'in_progress', priority: 'high', assigned_to: 'user2' },
      { id: '3', title: 'Write Tests', status: 'pending', priority: 'medium', assigned_to: 'user3' },
      { id: '4', title: 'Deploy to Staging', status: 'pending', priority: 'low', assigned_to: 'user1' }
    ];
  }

  private mockFileData(query?: any, entityIds?: string[]): any[] {
    // Mock file data
    return [
      { id: '1', name: 'design.sketch', type: 'design', size: 2048000, downloads: 15 },
      { id: '2', name: 'api.js', type: 'code', size: 51200, downloads: 8 },
      { id: '3', name: 'README.md', type: 'documentation', size: 8192, downloads: 25 }
    ];
  }

  private mockActivityData(query?: any, entityIds?: string[]): any[] {
    // Mock activity data
    return [
      { id: '1', type: 'deployment', status: 'success', duration: 120, environment: 'production' },
      { id: '2', type: 'testing', status: 'running', duration: 45, environment: 'staging' },
      { id: '3', type: 'review', status: 'completed', duration: 30, reviewers: 2 }
    ];
  }

  private mockDiscussionData(query?: any, entityIds?: string[]): any[] {
    // Mock discussion data
    return [
      { id: '1', title: 'Sprint Planning', type: 'forum', messages: 24, participants: 8, activity_score: 85 },
      { id: '2', title: 'Bug Reports', type: 'thread', messages: 12, participants: 5, activity_score: 65 },
      { id: '3', title: 'New Feature Announcement', type: 'announcement', views: 156, acknowledgments: 89 }
    ];
  }

  private cacheWidgetData(widgetId: string, data: any, ttl: number): void {
    // In a real implementation, this would use a proper cache
    this.setMetadata(`cache_${widgetId}`, {
      data,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + ttl * 1000)
    });
  }

  private updateWidgetPerformance(widgetId: string, loadTime: number, success: boolean, error?: string): void {
    if (!this.performanceMonitoring) {
      this.performanceMonitoring = {
        enabled: true,
        metrics: {
          loadTime: 0,
          renderTime: 0,
          dataFetchTime: 0,
          memoryUsage: 0,
          widgetPerformance: {}
        },
        alerts: [],
        optimization: {
          autoOptimize: false,
          lazyLoading: true,
          virtualScrolling: false,
          dataCompression: false,
          widgetPooling: false
        }
      };
    }

    const widgetPerf = this.performanceMonitoring.metrics.widgetPerformance[widgetId] || {
      avgLoadTime: 0,
      errorCount: 0,
      cacheHitRate: 0
    };

    // Update average load time (simple moving average)
    widgetPerf.avgLoadTime = (widgetPerf.avgLoadTime + loadTime) / 2;
    
    if (!success) {
      widgetPerf.errorCount++;
      widgetPerf.lastError = error;
    }

    this.performanceMonitoring.metrics.widgetPerformance[widgetId] = widgetPerf;
  }

  private async processAutomationWorkflows(): Promise<void> {
    if (!this.automationWorkflows) return;

    const activeWorkflows = this.automationWorkflows.filter(wf => wf.enabled);

    for (const workflow of activeWorkflows) {
      if (await this.shouldExecuteWorkflow(workflow)) {
        await this.executeWorkflow(workflow);
      }
    }
  }

  private async shouldExecuteWorkflow(workflow: NonNullable<Dashboard['automationWorkflows']>[0]): Promise<boolean> {
    // Check trigger conditions
    switch (workflow.trigger.type) {
      case 'schedule':
        return this.checkScheduleTrigger(workflow.trigger.configuration);
      case 'data_change':
        return this.checkDataChangeTrigger(workflow.trigger.configuration);
      case 'threshold':
        return this.checkThresholdTrigger(workflow.trigger.configuration);
      case 'event':
        return this.checkEventTrigger(workflow.trigger.configuration);
      default:
        return false;
    }
  }

  private checkScheduleTrigger(config: Record<string, any>): boolean {
    // Simple schedule check - in real implementation would use cron expressions
    return Math.random() < 0.1; // 10% chance simulation
  }

  private checkDataChangeTrigger(config: Record<string, any>): boolean {
    // Check if relevant data has changed
    return this.lastUpdated ? (new Date().getTime() - this.lastUpdated.getTime()) < 60000 : false; // Within last minute
  }

  private checkThresholdTrigger(config: Record<string, any>): boolean {
    // Check if any metrics exceed thresholds
    return Math.random() < 0.05; // 5% chance simulation
  }

  private checkEventTrigger(config: Record<string, any>): boolean {
    // Check for specific events
    return Math.random() < 0.02; // 2% chance simulation
  }

  private async executeWorkflow(workflow: NonNullable<Dashboard['automationWorkflows']>[0]): Promise<void> {
    console.log(`Executing workflow: ${workflow.name}`);
    
    // Execute workflow actions
    for (const action of workflow.actions) {
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }
      
      await this.executeWorkflowAction(action);
    }

    // Update execution metrics
    workflow.lastExecuted = new Date();
    workflow.executionCount++;
    workflow.successRate = Math.min(100, workflow.successRate + 5); // Simulate improving success rate
  }

  private async executeWorkflowAction(action: NonNullable<Dashboard['automationWorkflows']>[0]['actions'][0]): Promise<void> {
    switch (action.type) {
      case 'update_widget':
        await this.updateWidget(action.parameters.widgetId, action.parameters.updates);
        break;
      case 'send_notification':
        this.sendNotification(action.parameters);
        break;
      case 'create_task':
        console.log('Creating task:', action.parameters);
        break;
      case 'update_collection':
        console.log('Updating collection:', action.parameters);
        break;
      case 'export_data':
        console.log('Exporting data:', action.parameters);
        break;
    }
  }

  private async updateWidget(widgetId: string, updates: Record<string, any>): Promise<void> {
    const widget = this.widgetDefinitions?.find(w => w.widgetId === widgetId);
    if (widget) {
      Object.assign(widget, updates);
    }
  }

  private sendNotification(parameters: Record<string, any>): void {
    console.log(`Sending notification: ${parameters.message} to ${parameters.recipients?.join(', ')}`);
  }

  private updateRealtimeSubscriptions(): void {
    if (!this.realtimeConfig?.enabled) return;

    // Update subscriptions based on current widgets
    const subscriptions: NonNullable<Dashboard['realtimeConfig']>['subscriptions'] = [];
    
    this.widgetDefinitions?.forEach(widget => {
      const archetype = widget.dataSource.archetype;
      const entityIds = widget.dataSource.entityIds || [];
      
      subscriptions.push({
        archetype,
        entityIds,
        events: ['created', 'updated', 'deleted'],
        widgetIds: [widget.widgetId]
      });
    });

    if (this.realtimeConfig) {
      this.realtimeConfig.subscriptions = subscriptions;
    }
  }

  private async analyzeCrossArchetypePatterns(): Promise<void> {
    if (!this.crossArchetypeInsights) {
      this.crossArchetypeInsights = {
        correlationAnalysis: [],
        trendAnalysis: [],
        impactAnalysis: [],
        anomalies: [],
        recommendations: []
      };
    }

    // Mock correlation analysis between different archetypes
    this.crossArchetypeInsights.correlationAnalysis = [
      {
        archetype1: 'project',
        archetype2: 'task',
        metric1: 'progress',
        metric2: 'completion_rate',
        correlation: 0.85,
        pValue: 0.001,
        significance: 'high',
        insights: ['Project progress strongly correlates with task completion rate']
      },
      {
        archetype1: 'activity',
        archetype2: 'discussion',
        metric1: 'deployment_frequency',
        metric2: 'discussion_activity',
        correlation: 0.62,
        pValue: 0.05,
        significance: 'medium',
        insights: ['More deployments lead to increased team discussions']
      }
    ];

    // Mock trend analysis
    this.crossArchetypeInsights.trendAnalysis = [
      {
        archetype: 'task',
        metric: 'completion_rate',
        trend: 'increasing',
        changeRate: 15.5,
        confidence: 87,
        predictions: [
          { period: 'next_week', value: 78.2, confidence: 85 },
          { period: 'next_month', value: 82.1, confidence: 72 }
        ]
      }
    ];
  }

  private async detectAnomalies(): Promise<void> {
    if (!this.crossArchetypeInsights) return;

    // Mock anomaly detection
    this.crossArchetypeInsights.anomalies = [
      {
        archetype: 'file',
        entityId: 'file-123',
        metric: 'download_count',
        expectedValue: 15,
        actualValue: 150,
        deviation: 900,
        severity: 'high',
        detectedAt: new Date(),
        resolved: false,
        possibleCauses: ['Viral content', 'Bot activity', 'Marketing campaign']
      }
    ];
  }

  private generateRecommendations(): string[] {
    const recommendations = super.generateRecommendations();

    // Add dashboard-specific recommendations
    const widgetCount = this.widgetDefinitions?.length || 0;
    if (widgetCount === 0) {
      recommendations.push('Add widgets to visualize your data');
    } else if (widgetCount > 20) {
      recommendations.push('Consider organizing widgets into multiple dashboards for better performance');
    }

    // Performance recommendations
    if (this.performanceMonitoring?.metrics.loadTime > 5000) {
      recommendations.push('Dashboard loading time is slow - consider enabling caching or reducing widget complexity');
    }

    // Real-time recommendations
    if (!this.realtimeConfig?.enabled && widgetCount > 0) {
      recommendations.push('Enable real-time updates for better user experience');
    }

    return recommendations;
  }

  private async updateAIInsights(): Promise<void> {
    if (!this.aiInsights) return;

    // Mock AI insights generation
    const newInsights = [
      {
        type: 'pattern' as const,
        title: 'Weekly Sprint Pattern Detected',
        description: 'Task completion follows a predictable weekly pattern with peaks on Wednesdays',
        confidence: 89,
        impact: 'medium' as const,
        actionable: true,
        suggestedActions: ['Optimize task assignment for mid-week completion', 'Plan critical tasks for Wednesday delivery'],
        relevantItems: ['task-widget-1', 'project-widget-2'],
        generatedAt: new Date()
      },
      {
        type: 'recommendation' as const,
        title: 'Cross-Team Collaboration Opportunity',
        description: 'Projects Alpha and Beta have similar challenges - consider shared resources',
        confidence: 76,
        impact: 'high' as const,
        actionable: true,
        suggestedActions: ['Create shared documentation', 'Schedule joint planning sessions'],
        relevantItems: ['project-alpha', 'project-beta'],
        generatedAt: new Date()
      }
    ];

    this.aiInsights.insights = [
      ...this.aiInsights.insights.slice(-8), // Keep last 8 insights
      ...newInsights
    ];

    this.aiInsights.lastAnalysis = new Date();
  }

  // Dashboard management methods
  addWidget(widget: NonNullable<Dashboard['widgetDefinitions']>[0]): void {
    if (!this.widgetDefinitions) {
      this.widgetDefinitions = [];
    }

    // Validate widget doesn't already exist
    const exists = this.widgetDefinitions.some(w => w.widgetId === widget.widgetId);
    if (exists) {
      throw new Error(`Widget ${widget.widgetId} already exists`);
    }

    this.widgetDefinitions.push(widget);
    this.itemCount++;
    this.lastUpdated = new Date();
  }

  removeWidget(widgetId: string): boolean {
    if (!this.widgetDefinitions) return false;

    const index = this.widgetDefinitions.findIndex(w => w.widgetId === widgetId);
    if (index === -1) return false;

    this.widgetDefinitions.splice(index, 1);
    this.itemCount--;
    this.lastUpdated = new Date();

    return true;
  }

  getWidget(widgetId: string): NonNullable<Dashboard['widgetDefinitions']>[0] | undefined {
    return this.widgetDefinitions?.find(w => w.widgetId === widgetId);
  }

  updateWidget(widgetId: string, updates: Partial<NonNullable<Dashboard['widgetDefinitions']>[0]>): boolean {
    const widget = this.getWidget(widgetId);
    if (!widget) return false;

    Object.assign(widget, updates);
    this.lastUpdated = new Date();
    return true;
  }

  cloneWidget(widgetId: string, newWidgetId: string): boolean {
    const widget = this.getWidget(widgetId);
    if (!widget) return false;

    const clonedWidget = {
      ...widget,
      widgetId: newWidgetId,
      title: `${widget.title} (Copy)`,
      position: {
        ...widget.position,
        x: widget.position.x + widget.position.width + 20
      }
    };

    this.addWidget(clonedWidget);
    return true;
  }

  // Dashboard personalization
  setUserPreferences(userId: string, preferences: NonNullable<Dashboard['userPersonalization']>[string]['preferences']): void {
    if (!this.userPersonalization) {
      this.userPersonalization = {};
    }

    if (!this.userPersonalization[userId]) {
      this.userPersonalization[userId] = {};
    }

    this.userPersonalization[userId].preferences = preferences;
  }

  getUserPreferences(userId: string): NonNullable<Dashboard['userPersonalization']>[string]['preferences'] | undefined {
    return this.userPersonalization?.[userId]?.preferences;
  }

  addUserBookmark(userId: string, bookmark: NonNullable<NonNullable<Dashboard['userPersonalization']>[string]['bookmarks']>[0]): void {
    if (!this.userPersonalization) {
      this.userPersonalization = {};
    }

    if (!this.userPersonalization[userId]) {
      this.userPersonalization[userId] = {};
    }

    if (!this.userPersonalization[userId].bookmarks) {
      this.userPersonalization[userId].bookmarks = [];
    }

    this.userPersonalization[userId].bookmarks!.push(bookmark);
  }

  // Alert management
  addAlert(alert: NonNullable<Dashboard['alertSystem']>['globalAlerts'][0]): void {
    if (!this.alertSystem) {
      this.alertSystem = {
        enabled: true,
        globalAlerts: [],
        alertHistory: []
      };
    }

    this.alertSystem.globalAlerts.push(alert);
  }

  removeAlert(alertId: string): boolean {
    if (!this.alertSystem) return false;

    const index = this.alertSystem.globalAlerts.findIndex(a => a.id === alertId);
    if (index === -1) return false;

    this.alertSystem.globalAlerts.splice(index, 1);
    return true;
  }

  triggerAlert(alertId: string, value: any): void {
    if (!this.alertSystem) return;

    const alert = this.alertSystem.globalAlerts.find(a => a.id === alertId);
    if (!alert || !alert.enabled) return;

    // Check throttling
    const recentTriggers = this.alertSystem.alertHistory.filter(h => 
      h.alertId === alertId &&
      h.triggeredAt > new Date(Date.now() - alert.notifications.throttling.interval * 60 * 1000)
    );

    if (alert.notifications.throttling.enabled && 
        recentTriggers.length >= alert.notifications.throttling.maxPerInterval) {
      return; // Throttled
    }

    // Record alert trigger
    this.alertSystem.alertHistory.push({
      alertId,
      triggeredAt: new Date(),
      value,
      recipients: alert.notifications.recipients,
      resolved: false
    });

    alert.lastTriggered = new Date();
    alert.triggerCount++;

    console.log(`Alert triggered: ${alert.name} with value ${value}`);
  }

  // Dashboard analytics
  getDashboardAnalytics(): {
    usage: {
      totalViews: number;
      uniqueUsers: number;
      avgSessionDuration: number;
      bounceRate: number;
    };
    widgets: {
      mostViewed: Array<{ widgetId: string; views: number }>;
      slowestLoading: Array<{ widgetId: string; avgLoadTime: number }>;
      mostErrors: Array<{ widgetId: string; errorCount: number }>;
    };
    crossArchetype: {
      coverage: Record<string, number>;
      integration: number; // How well integrated different archetypes are
      insights: number; // Number of generated insights
    };
    performance: {
      overallScore: number;
      loadTime: number;
      memoryUsage: number;
      recommendations: string[];
    };
  } {
    const perfMetrics = this.performanceMonitoring?.metrics || {
      loadTime: 0, renderTime: 0, dataFetchTime: 0, memoryUsage: 0, widgetPerformance: {}
    };

    return {
      usage: {
        totalViews: this.aggregationData?.performance.viewCount || 0,
        uniqueUsers: Math.floor((this.aggregationData?.performance.viewCount || 0) * 0.7), // Mock
        avgSessionDuration: 300, // Mock: 5 minutes
        bounceRate: 0.25 // Mock: 25%
      },
      widgets: {
        mostViewed: Object.entries(perfMetrics.widgetPerformance)
          .sort(([,a], [,b]) => (b.cacheHitRate || 0) - (a.cacheHitRate || 0))
          .slice(0, 5)
          .map(([id]) => ({ widgetId: id, views: Math.floor(Math.random() * 1000) })),
        slowestLoading: Object.entries(perfMetrics.widgetPerformance)
          .sort(([,a], [,b]) => (b.avgLoadTime || 0) - (a.avgLoadTime || 0))
          .slice(0, 5)
          .map(([id, perf]) => ({ widgetId: id, avgLoadTime: perf.avgLoadTime || 0 })),
        mostErrors: Object.entries(perfMetrics.widgetPerformance)
          .sort(([,a], [,b]) => (b.errorCount || 0) - (a.errorCount || 0))
          .slice(0, 5)
          .map(([id, perf]) => ({ widgetId: id, errorCount: perf.errorCount || 0 }))
      },
      crossArchetype: {
        coverage: this.crossArchetypeAnalysis?.archetypeDistribution || {},
        integration: this.crossArchetypeAnalysis?.relationshipMap.length || 0,
        insights: this.crossArchetypeInsights?.recommendations.length || 0
      },
      performance: {
        overallScore: this.calculateOverallPerformanceScore(),
        loadTime: perfMetrics.loadTime,
        memoryUsage: perfMetrics.memoryUsage,
        recommendations: this.generatePerformanceRecommendations()
      }
    };
  }

  private calculateOverallPerformanceScore(): number {
    let score = 100;
    
    const perfMetrics = this.performanceMonitoring?.metrics;
    if (perfMetrics) {
      if (perfMetrics.loadTime > 3000) score -= 20; // Slow loading
      if (perfMetrics.memoryUsage > 100 * 1024 * 1024) score -= 15; // High memory usage
      
      const avgErrors = Object.values(perfMetrics.widgetPerformance)
        .reduce((sum, perf) => sum + (perf.errorCount || 0), 0) / 
        Object.keys(perfMetrics.widgetPerformance).length;
      
      score -= avgErrors * 5; // Penalty for errors
    }

    return Math.max(0, Math.min(100, score));
  }

  private generatePerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const perfMetrics = this.performanceMonitoring?.metrics;
    
    if (!perfMetrics) return recommendations;

    if (perfMetrics.loadTime > 3000) {
      recommendations.push('Enable widget caching to improve load times');
    }

    if (Object.keys(perfMetrics.widgetPerformance).length > 15) {
      recommendations.push('Consider splitting dashboard into multiple focused views');
    }

    const errorCount = Object.values(perfMetrics.widgetPerformance)
      .reduce((sum, perf) => sum + (perf.errorCount || 0), 0);
    
    if (errorCount > 5) {
      recommendations.push('Review widget configurations to reduce errors');
    }

    return recommendations;
  }

  // Cross-archetype methods
  getArchetypeSummary(): Record<string, { count: number; health: number; activity: number }> {
    const summary: Record<string, { count: number; health: number; activity: number }> = {};
    
    if (!this.collectionItems) return summary;

    // Group items by archetype
    const archetypeGroups: Record<string, NonNullable<CollectionArchetype['collectionItems']>> = {};
    
    this.collectionItems.forEach(item => {
      const archetype = this.mapEntityToArchetype(item.entityType);
      if (!archetypeGroups[archetype]) {
        archetypeGroups[archetype] = [];
      }
      archetypeGroups[archetype].push(item);
    });

    // Calculate summary for each archetype
    Object.entries(archetypeGroups).forEach(([archetype, items]) => {
      summary[archetype] = {
        count: items.length,
        health: this.calculateArchetypeHealth(items),
        activity: this.calculateArchetypeActivity(items)
      };
    });

    return summary;
  }

  private calculateArchetypeHealth(items: NonNullable<CollectionArchetype['collectionItems']>): number {
    // Mock health calculation based on item status
    const activeItems = items.filter(item => item.status === 'active').length;
    return items.length > 0 ? (activeItems / items.length) * 100 : 0;
  }

  private calculateArchetypeActivity(items: NonNullable<CollectionArchetype['collectionItems']>): number {
    // Mock activity calculation based on recent additions
    const recentItems = items.filter(item => {
      const daysSinceAdded = (new Date().getTime() - item.addedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceAdded <= 7; // Added in last week
    }).length;
    
    return items.length > 0 ? (recentItems / items.length) * 100 : 0;
  }

  isExecutiveDashboard(): boolean {
    return this.dashboardType === 'executive';
  }

  isRealTimeEnabled(): boolean {
    return this.realtimeConfig?.enabled ?? false;
  }

  hasAlerts(): boolean {
    return this.alertSystem?.enabled && this.alertSystem.globalAlerts.length > 0;
  }

  getActiveAlerts(): NonNullable<Dashboard['alertSystem']>['globalAlerts'] {
    return this.alertSystem?.globalAlerts.filter(alert => alert.enabled) || [];
  }

  requiresAttention(): boolean {
    const health = this.getCollectionHealth();
    const performance = this.calculateOverallPerformanceScore();
    const hasUnresolvedAlerts = this.alertSystem?.alertHistory.some(h => !h.resolved) ?? false;

    return health.score < 70 || performance < 70 || hasUnresolvedAlerts;
  }
}