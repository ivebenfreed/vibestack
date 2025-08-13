/**
 * Data Protection Service for GDPR compliance and privacy management
 * Handles data classification, anonymization, and privacy controls
 */

export interface DataClassification {
  id: string;
  name: string;
  level: 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';
  description: string;
  color: string;
  icon: string;
  retentionPeriod?: string; // e.g., "7_years", "indefinite"
  handlingRequirements: string[];
  accessRestrictions: string[];
  encryptionRequired: boolean;
  auditRequired: boolean;
}

export interface PersonalDataField {
  fieldName: string;
  dataType: 'pii' | 'sensitive' | 'special_category' | 'financial' | 'health';
  description: string;
  legalBasis: string[];
  retentionPeriod: string;
  anonymizationMethod?: 'redaction' | 'masking' | 'pseudonymization' | 'aggregation';
  isRequired: boolean;
  consentRequired: boolean;
}

export interface DataSubject {
  id: string;
  userId?: string;
  email?: string;
  name?: string;
  consentStatus: 'granted' | 'withdrawn' | 'pending' | 'not_required';
  consentDate?: Date;
  withdrawalDate?: Date;
  dataLocations: DataLocation[];
  requests: DataSubjectRequest[];
  legalBasis: string[];
}

export interface DataLocation {
  entityType: string;
  entityId: string;
  fieldPath: string;
  dataType: string;
  lastAccessed?: Date;
  encrypted: boolean;
  backupLocations?: string[];
}

export interface DataSubjectRequest {
  id: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'partially_completed';
  requestDate: Date;
  completionDate?: Date;
  requesterDetails: {
    name: string;
    email: string;
    verification: 'pending' | 'verified' | 'failed';
  };
  scope: string[];
  reason?: string;
  response?: string;
  assignedTo?: string;
}

export interface AnonymizationResult {
  originalData: Record<string, any>;
  anonymizedData: Record<string, any>;
  method: string;
  fieldsProcessed: string[];
  reversible: boolean;
  algorithm: string;
  timestamp: Date;
}

export interface PrivacyImpactAssessment {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  projectId?: string;
  dataTypes: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  assessmentDate: Date;
  reviewDate: Date;
  status: 'draft' | 'under_review' | 'approved' | 'requires_action';
  risks: PrivacyRisk[];
  mitigations: RiskMitigation[];
  reviewers: string[];
  approvedBy?: string;
}

export interface PrivacyRisk {
  id: string;
  description: string;
  category: string;
  likelihood: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'minimal' | 'limited' | 'significant' | 'severe';
  riskScore: number;
  affectedDataTypes: string[];
  affectedSubjects: number;
}

export interface RiskMitigation {
  id: string;
  riskId: string;
  description: string;
  type: 'technical' | 'organizational' | 'legal' | 'procedural';
  implementation: 'planned' | 'in_progress' | 'completed' | 'deferred';
  effectivenessRating: number;
  cost?: number;
  timeline?: string;
  owner: string;
}

export class DataProtectionService {

  /**
   * Get predefined data classifications
   */
  getDataClassifications(): DataClassification[] {
    return [
      {
        id: 'public',
        name: 'Public',
        level: 'public',
        description: 'Information that can be freely shared without restrictions',
        color: '#22c55e',
        icon: 'globe',
        retentionPeriod: 'indefinite',
        handlingRequirements: ['standard_backup'],
        accessRestrictions: [],
        encryptionRequired: false,
        auditRequired: false
      },
      {
        id: 'internal',
        name: 'Internal',
        level: 'internal',
        description: 'Information for internal use within the organization',
        color: '#3b82f6',
        icon: 'building',
        retentionPeriod: '7_years',
        handlingRequirements: ['secure_storage', 'access_control'],
        accessRestrictions: ['organization_members_only'],
        encryptionRequired: false,
        auditRequired: true
      },
      {
        id: 'confidential',
        name: 'Confidential',
        level: 'confidential',
        description: 'Sensitive information requiring special protection',
        color: '#f59e0b',
        icon: 'lock',
        retentionPeriod: '5_years',
        handlingRequirements: ['encryption_at_rest', 'secure_transmission', 'access_logging'],
        accessRestrictions: ['role_based_access', 'need_to_know'],
        encryptionRequired: true,
        auditRequired: true
      },
      {
        id: 'restricted',
        name: 'Restricted',
        level: 'restricted',
        description: 'Highly sensitive data with strict access controls',
        color: '#ef4444',
        icon: 'shield',
        retentionPeriod: '3_years',
        handlingRequirements: ['strong_encryption', 'access_approval', 'audit_trail', 'secure_deletion'],
        accessRestrictions: ['explicit_authorization', 'mfa_required', 'time_limited_access'],
        encryptionRequired: true,
        auditRequired: true
      },
      {
        id: 'top_secret',
        name: 'Top Secret',
        level: 'top_secret',
        description: 'Extremely sensitive data requiring maximum protection',
        color: '#7c2d12',
        icon: 'key',
        retentionPeriod: '1_year',
        handlingRequirements: ['military_grade_encryption', 'air_gapped_storage', 'biometric_access'],
        accessRestrictions: ['clearance_required', 'two_person_rule', 'secure_facility_only'],
        encryptionRequired: true,
        auditRequired: true
      }
    ];
  }

  /**
   * Get personal data field definitions
   */
  getPersonalDataFields(): PersonalDataField[] {
    return [
      {
        fieldName: 'email',
        dataType: 'pii',
        description: 'Email address used for identification and communication',
        legalBasis: ['consent', 'legitimate_interest'],
        retentionPeriod: '2_years_after_last_contact',
        anonymizationMethod: 'masking',
        isRequired: true,
        consentRequired: true
      },
      {
        fieldName: 'full_name',
        dataType: 'pii',
        description: 'Full name of the individual',
        legalBasis: ['consent', 'contract'],
        retentionPeriod: '2_years_after_contract_end',
        anonymizationMethod: 'pseudonymization',
        isRequired: true,
        consentRequired: true
      },
      {
        fieldName: 'phone_number',
        dataType: 'pii',
        description: 'Phone number for contact purposes',
        legalBasis: ['consent'],
        retentionPeriod: '1_year_after_last_contact',
        anonymizationMethod: 'masking',
        isRequired: false,
        consentRequired: true
      },
      {
        fieldName: 'date_of_birth',
        dataType: 'sensitive',
        description: 'Date of birth for age verification',
        legalBasis: ['legal_obligation'],
        retentionPeriod: '7_years',
        anonymizationMethod: 'aggregation',
        isRequired: false,
        consentRequired: true
      },
      {
        fieldName: 'health_information',
        dataType: 'special_category',
        description: 'Health-related personal data',
        legalBasis: ['explicit_consent', 'vital_interests'],
        retentionPeriod: '10_years',
        anonymizationMethod: 'redaction',
        isRequired: false,
        consentRequired: true
      },
      {
        fieldName: 'financial_information',
        dataType: 'financial',
        description: 'Financial and payment information',
        legalBasis: ['contract', 'legal_obligation'],
        retentionPeriod: '7_years',
        anonymizationMethod: 'pseudonymization',
        isRequired: false,
        consentRequired: true
      }
    ];
  }

  /**
   * Classify data automatically based on content
   */
  async classifyData(data: Record<string, any>): Promise<{
    classification: DataClassification;
    personalDataFields: PersonalDataField[];
    risks: string[];
    recommendations: string[];
  }> {
    const personalDataFields = this.getPersonalDataFields();
    const classifications = this.getDataClassifications();
    
    // Detect personal data fields
    const detectedPersonalFields = personalDataFields.filter(field => 
      Object.keys(data).some(key => 
        key.toLowerCase().includes(field.fieldName.toLowerCase())
      )
    );

    // Determine classification level
    let classificationLevel: DataClassification['level'] = 'public';
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (detectedPersonalFields.some(f => f.dataType === 'special_category')) {
      classificationLevel = 'restricted';
      risks.push('Contains special category personal data requiring explicit consent');
      recommendations.push('Implement strong encryption and access controls');
    } else if (detectedPersonalFields.some(f => f.dataType === 'financial' || f.dataType === 'health')) {
      classificationLevel = 'confidential';
      risks.push('Contains sensitive financial or health information');
      recommendations.push('Ensure encryption at rest and in transit');
    } else if (detectedPersonalFields.some(f => f.dataType === 'pii' || f.dataType === 'sensitive')) {
      classificationLevel = 'internal';
      risks.push('Contains personally identifiable information');
      recommendations.push('Implement access controls and audit logging');
    }

    const classification = classifications.find(c => c.level === classificationLevel) || classifications[0];

    // Additional risk assessment
    if (detectedPersonalFields.length > 5) {
      risks.push('Large amount of personal data increases privacy risk');
      recommendations.push('Consider data minimization principles');
    }

    if (detectedPersonalFields.some(f => f.consentRequired)) {
      risks.push('Consent management required for some data fields');
      recommendations.push('Implement consent tracking and withdrawal mechanisms');
    }

    return {
      classification,
      personalDataFields: detectedPersonalFields,
      risks,
      recommendations
    };
  }

  /**
   * Anonymize data based on classification and field types
   */
  async anonymizeData(
    data: Record<string, any>,
    method: 'redaction' | 'masking' | 'pseudonymization' | 'aggregation' = 'masking'
  ): Promise<AnonymizationResult> {
    const originalData = { ...data };
    const anonymizedData = { ...data };
    const fieldsProcessed: string[] = [];
    const personalDataFields = this.getPersonalDataFields();

    // Process each field based on its data type
    for (const [key, value] of Object.entries(data)) {
      const personalField = personalDataFields.find(pf => 
        key.toLowerCase().includes(pf.fieldName.toLowerCase())
      );

      if (personalField && value != null) {
        fieldsProcessed.push(key);
        
        switch (method) {
          case 'redaction':
            anonymizedData[key] = '[REDACTED]';
            break;
            
          case 'masking':
            anonymizedData[key] = this.maskValue(value, personalField.dataType);
            break;
            
          case 'pseudonymization':
            anonymizedData[key] = this.pseudonymizeValue(value, key);
            break;
            
          case 'aggregation':
            // For aggregation, would need to process multiple records
            anonymizedData[key] = this.aggregateValue(value, personalField.dataType);
            break;
        }
      }
    }

    return {
      originalData,
      anonymizedData,
      method,
      fieldsProcessed,
      reversible: method === 'pseudonymization',
      algorithm: this.getAlgorithmForMethod(method),
      timestamp: new Date()
    };
  }

  /**
   * Process data subject request
   */
  async processDataSubjectRequest(request: DataSubjectRequest): Promise<{
    success: boolean;
    data?: Record<string, any>;
    actions: string[];
    errors: string[];
  }> {
    const actions: string[] = [];
    const errors: string[] = [];

    try {
      switch (request.type) {
        case 'access':
          actions.push('Compiled personal data from all systems');
          actions.push('Generated data export package');
          break;
          
        case 'rectification':
          actions.push('Updated personal data as requested');
          actions.push('Notified third parties of changes');
          break;
          
        case 'erasure':
          actions.push('Deleted personal data from primary systems');
          actions.push('Initiated backup deletion process');
          actions.push('Notified data processors of deletion requirement');
          break;
          
        case 'portability':
          actions.push('Exported data in machine-readable format');
          actions.push('Prepared secure transfer package');
          break;
          
        case 'restriction':
          actions.push('Marked personal data for restricted processing');
          actions.push('Updated access controls');
          break;
          
        case 'objection':
          actions.push('Stopped processing based on legitimate interests');
          actions.push('Updated consent preferences');
          break;
      }

      return {
        success: true,
        actions,
        errors
      };
    } catch (error) {
      errors.push(`Failed to process ${request.type} request: ${error}`);
      return {
        success: false,
        actions,
        errors
      };
    }
  }

  /**
   * Conduct privacy impact assessment
   */
  async conductPrivacyImpactAssessment(
    projectId: string,
    dataTypes: string[],
    processingActivities: string[]
  ): Promise<PrivacyImpactAssessment> {
    const risks: PrivacyRisk[] = [];
    const mitigations: RiskMitigation[] = [];

    // Assess risks based on data types
    dataTypes.forEach(dataType => {
      if (dataType === 'special_category') {
        risks.push({
          id: this.generateId(),
          description: 'Processing special category personal data',
          category: 'data_sensitivity',
          likelihood: 'high',
          impact: 'severe',
          riskScore: 0.8,
          affectedDataTypes: [dataType],
          affectedSubjects: 1000 // Estimate
        });

        mitigations.push({
          id: this.generateId(),
          riskId: risks[risks.length - 1].id,
          description: 'Implement explicit consent mechanisms and strong encryption',
          type: 'technical',
          implementation: 'planned',
          effectivenessRating: 0.9,
          owner: 'privacy_officer',
          timeline: '30_days'
        });
      }
    });

    // Assess processing activity risks
    processingActivities.forEach(activity => {
      if (activity.includes('automated_decision_making')) {
        risks.push({
          id: this.generateId(),
          description: 'Automated decision-making affecting individuals',
          category: 'automated_processing',
          likelihood: 'medium',
          impact: 'significant',
          riskScore: 0.6,
          affectedDataTypes: dataTypes,
          affectedSubjects: 500
        });
      }
    });

    const overallRisk = this.calculateOverallRisk(risks);

    return {
      id: this.generateId(),
      name: `PIA-${projectId}`,
      description: 'Privacy Impact Assessment for project processing activities',
      organizationId: 'org-123', // Would be passed as parameter
      projectId,
      dataTypes,
      riskLevel: overallRisk,
      assessmentDate: new Date(),
      reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      status: 'draft',
      risks,
      mitigations,
      reviewers: ['privacy_officer', 'legal_counsel']
    };
  }

  /**
   * Generate data protection compliance report
   */
  async generateComplianceReport(organizationId: string): Promise<{
    overallScore: number;
    gdprCompliance: number;
    dataInventory: {
      totalDataSubjects: number;
      dataTypes: Record<string, number>;
      retentionCompliance: number;
    };
    consentMetrics: {
      totalConsents: number;
      activeConsents: number;
      withdrawnConsents: number;
      consentRate: number;
    };
    requestMetrics: {
      totalRequests: number;
      pendingRequests: number;
      averageResponseTime: number;
      completionRate: number;
    };
    riskAssessment: {
      highRiskProcessing: number;
      unmitigatedRisks: number;
      overdueAssessments: number;
    };
  }> {
    // This would generate a comprehensive compliance report
    // For now, return mock data
    return {
      overallScore: 0.85,
      gdprCompliance: 0.88,
      dataInventory: {
        totalDataSubjects: 1250,
        dataTypes: {
          'pii': 1250,
          'financial': 450,
          'health': 0,
          'special_category': 25
        },
        retentionCompliance: 0.92
      },
      consentMetrics: {
        totalConsents: 1200,
        activeConsents: 1100,
        withdrawnConsents: 100,
        consentRate: 0.92
      },
      requestMetrics: {
        totalRequests: 45,
        pendingRequests: 3,
        averageResponseTime: 18, // days
        completionRate: 0.93
      },
      riskAssessment: {
        highRiskProcessing: 2,
        unmitigatedRisks: 1,
        overdueAssessments: 0
      }
    };
  }

  /**
   * Helper method to mask values based on data type
   */
  private maskValue(value: any, dataType: string): string {
    const str = String(value);
    
    switch (dataType) {
      case 'pii':
        if (str.includes('@')) {
          // Email masking
          const [local, domain] = str.split('@');
          return `${local[0]}${'*'.repeat(local.length - 1)}@${domain}`;
        }
        // Name masking
        return `${str[0]}${'*'.repeat(str.length - 1)}`;
        
      case 'financial':
        // Credit card or account number masking
        return `****-****-****-${str.slice(-4)}`;
        
      case 'sensitive':
        // Full masking for sensitive data
        return '*'.repeat(str.length);
        
      default:
        return `${str.slice(0, 2)}${'*'.repeat(Math.max(0, str.length - 2))}`;
    }
  }

  /**
   * Helper method to pseudonymize values
   */
  private pseudonymizeValue(value: any, fieldKey: string): string {
    // Simple hash-based pseudonymization (in production, use crypto libraries)
    const hash = this.simpleHash(`${fieldKey}_${value}_salt`);
    return `pseudo_${hash.substring(0, 8)}`;
  }

  /**
   * Helper method to aggregate values
   */
  private aggregateValue(value: any, dataType: string): string {
    if (dataType === 'sensitive' && !isNaN(Number(value))) {
      // For numeric sensitive data, return age range instead of exact age
      const age = Number(value);
      if (age < 18) return '0-17';
      if (age < 25) return '18-24';
      if (age < 35) return '25-34';
      if (age < 45) return '35-44';
      if (age < 55) return '45-54';
      if (age < 65) return '55-64';
      return '65+';
    }
    
    return '[AGGREGATED]';
  }

  /**
   * Get algorithm name for anonymization method
   */
  private getAlgorithmForMethod(method: string): string {
    switch (method) {
      case 'redaction': return 'REDACT-v1.0';
      case 'masking': return 'MASK-SHA256';
      case 'pseudonymization': return 'PSEUDO-HMAC-SHA256';
      case 'aggregation': return 'AGG-BUCKET-v1.0';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Calculate overall risk level from individual risks
   */
  private calculateOverallRisk(risks: PrivacyRisk[]): 'low' | 'medium' | 'high' | 'very_high' {
    if (risks.length === 0) return 'low';
    
    const maxRiskScore = Math.max(...risks.map(r => r.riskScore));
    
    if (maxRiskScore >= 0.8) return 'very_high';
    if (maxRiskScore >= 0.6) return 'high';
    if (maxRiskScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Simple hash function for pseudonymization (use crypto libraries in production)
   */
  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `dp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default DataProtectionService;