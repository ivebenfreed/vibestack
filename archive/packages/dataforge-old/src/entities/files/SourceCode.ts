import { Entity, Property } from '@mikro-orm/core';
import { FileArchetype } from '../archetypes/FileArchetype.js';

/**
 * Source code file with programming language features and code analysis
 * Extends FileArchetype with development-specific workflows
 */
@Entity({ tableName: 'source_code' })
export class SourceCode extends FileArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'programming_language' })
  programmingLanguage?: 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'csharp' | 'go' | 'rust' | 'php' | 'ruby' | 'swift' | 'kotlin' | 'scala' | 'other';

  @Property({ type: 'string', nullable: true, fieldName: 'code_type' })
  codeType?: 'source' | 'test' | 'config' | 'documentation' | 'build' | 'deployment' | 'migration';

  @Property({ type: 'string', nullable: true, fieldName: 'module_name' })
  moduleName?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'package_name' })
  packageName?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'class_name' })
  className?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'code_metrics' })
  codeMetrics?: {
    linesOfCode?: number;
    linesOfComments?: number;
    complexity?: number;
    maintainabilityIndex?: number;
    technicalDebt?: number; // minutes
    codeSmells?: number;
    duplicatedLines?: number;
    testCoverage?: number; // percentage
  };

  @Property({ type: 'json', nullable: true })
  dependencies?: Array<{
    name: string;
    version?: string;
    type: 'import' | 'require' | 'include' | 'reference';
    scope: 'internal' | 'external' | 'system';
    required: boolean;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'code_quality' })
  codeQuality?: {
    score?: number; // 0-100
    issues?: Array<{
      type: 'error' | 'warning' | 'info';
      severity: 'low' | 'medium' | 'high' | 'critical';
      rule: string;
      message: string;
      line?: number;
      column?: number;
      suggestion?: string;
    }>;
    lastAnalyzed?: Date;
    analyzer?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'test_info' })
  testInfo?: {
    hasTests: boolean;
    testFiles?: string[];
    testCoverage?: number;
    testCount?: number;
    passingTests?: number;
    failingTests?: number;
    lastTestRun?: Date;
  };

  @Property({ type: 'json', nullable: true })
  documentation?: {
    hasDocumentation: boolean;
    docFormat?: 'jsdoc' | 'pydoc' | 'javadoc' | 'rustdoc' | 'godoc' | 'other';
    apiDocumentation?: string;
    readme?: string;
    examples?: string[];
    completeness?: number; // percentage
  };

  @Property({ type: 'json', nullable: true, fieldName: 'build_info' })
  buildInfo?: {
    buildable: boolean;
    buildTool?: string;
    buildConfig?: string;
    outputFiles?: string[];
    lastBuild?: Date;
    buildStatus?: 'success' | 'failed' | 'pending';
    buildErrors?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'security_scan' })
  securityScan?: {
    scanned: boolean;
    scannedAt?: Date;
    vulnerabilities?: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      type: string;
      description: string;
      line?: number;
      cwe?: string; // Common Weakness Enumeration
      recommendation?: string;
    }>;
    securityScore?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'git_info' })
  gitInfo?: {
    repository?: string;
    branch?: string;
    commit?: string;
    author?: string;
    lastCommit?: Date;
    commitMessage?: string;
    changedLines?: number;
    additions?: number;
    deletions?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'code_reviews' })
  codeReviews?: Array<{
    reviewId: string;
    reviewer: string;
    status: 'pending' | 'approved' | 'changes_requested' | 'rejected';
    comments?: Array<{
      line: number;
      comment: string;
      type: 'suggestion' | 'issue' | 'compliment';
    }>;
    reviewedAt?: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'performance_metrics' })
  performanceMetrics?: {
    executionTime?: number; // milliseconds
    memoryUsage?: number; // bytes
    cpuUsage?: number; // percentage
    benchmarks?: Array<{
      name: string;
      value: number;
      unit: string;
      timestamp: Date;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'refactoring_suggestions' })
  refactoringSuggestions?: Array<{
    type: 'extract_method' | 'rename' | 'move_class' | 'inline' | 'extract_constant';
    description: string;
    startLine: number;
    endLine: number;
    priority: 'low' | 'medium' | 'high';
    estimatedEffort: string;
  }>;

  // Implementation of abstract methods
  getFileType(): string {
    return 'source_code';
  }

  async validateFileRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Source code specific validation
    if (!this.programmingLanguage) {
      return false; // Programming language is required
    }

    if (!this.extension || !this.isValidExtensionForLanguage()) {
      return false; // Extension must match programming language
    }

    // Code quality validation
    if (this.codeQuality?.score && this.codeQuality.score < 0) {
      return false; // Quality score cannot be negative
    }

    return true;
  }

  async processFile(): Promise<void> {
    // Extract file information from filename and extension
    this.extractFileInfo();
    
    // Update code metrics if available
    await this.analyzeCodeMetrics();
    
    // Update processing status
    this.startProcessing();
    
    try {
      // Analyze dependencies
      await this.analyzeDependencies();
      
      // Run code quality analysis
      await this.analyzeCodeQuality();
      
      // Check for security vulnerabilities
      await this.scanForSecurityIssues();
      
      this.completeProcessing({
        analyzed: true,
        language: this.programmingLanguage,
        metrics: this.codeMetrics
      });
    } catch (error) {
      this.failProcessing([error instanceof Error ? error.message : 'Unknown error']);
    }
  }

  async generateThumbnail(): Promise<string | null> {
    // For source code, generate a syntax-highlighted preview
    if (!this.url) return null;
    
    // This would typically integrate with a code highlighting service
    // For now, return a placeholder URL
    return `/api/code-preview/${this.id}?lang=${this.programmingLanguage}`;
  }

  // Source code specific business logic
  private extractFileInfo(): void {
    if (!this.filename) return;

    // Extract extension
    const lastDot = this.filename.lastIndexOf('.');
    if (lastDot > 0) {
      this.extension = this.filename.substring(lastDot);
    }

    // Infer programming language from extension if not set
    if (!this.programmingLanguage) {
      this.programmingLanguage = this.inferLanguageFromExtension();
    }

    // Extract module/class names from filename
    const baseName = this.filename.substring(0, lastDot > 0 ? lastDot : this.filename.length);
    
    // For class-based languages, filename often matches class name
    if (['java', 'csharp', 'kotlin', 'swift'].includes(this.programmingLanguage || '')) {
      this.className = this.toPascalCase(baseName);
    }
    
    // Module name is typically the filename
    this.moduleName = baseName;
  }

  private inferLanguageFromExtension(): typeof SourceCode.prototype.programmingLanguage {
    const extensionMap: Record<string, typeof SourceCode.prototype.programmingLanguage> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.pyw': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'cpp',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala'
    };

    return extensionMap[this.extension || ''] || 'other';
  }

  private isValidExtensionForLanguage(): boolean {
    const validExtensions: Record<string, string[]> = {
      javascript: ['.js', '.jsx', '.mjs'],
      typescript: ['.ts', '.tsx'],
      python: ['.py', '.pyw'],
      java: ['.java'],
      cpp: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'],
      csharp: ['.cs'],
      go: ['.go'],
      rust: ['.rs'],
      php: ['.php'],
      ruby: ['.rb'],
      swift: ['.swift'],
      kotlin: ['.kt'],
      scala: ['.scala']
    };

    const expected = validExtensions[this.programmingLanguage || ''] || [];
    return expected.includes(this.extension || '');
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|_)([a-z])/g, (_, char) => char.toUpperCase());
  }

  private async analyzeCodeMetrics(): Promise<void> {
    // This would typically integrate with code analysis tools
    // For now, simulate basic metrics
    if (!this.size) return;

    const estimatedLines = Math.floor(this.size / 50); // Rough estimate
    
    this.codeMetrics = {
      linesOfCode: estimatedLines,
      linesOfComments: Math.floor(estimatedLines * 0.2),
      complexity: Math.floor(Math.random() * 10) + 1,
      maintainabilityIndex: Math.floor(Math.random() * 40) + 60,
      technicalDebt: Math.floor(Math.random() * 60),
      codeSmells: Math.floor(Math.random() * 5),
      duplicatedLines: Math.floor(Math.random() * 20)
    };
  }

  private async analyzeDependencies(): Promise<void> {
    // This would parse the file content to extract dependencies
    // For now, simulate dependencies based on language
    const commonDependencies: Record<string, Array<{ name: string; type: any; scope: any; required: boolean }>> = {
      javascript: [
        { name: 'lodash', type: 'import', scope: 'external', required: false },
        { name: 'react', type: 'import', scope: 'external', required: true }
      ],
      typescript: [
        { name: '@types/node', type: 'import', scope: 'external', required: true },
        { name: 'typescript', type: 'import', scope: 'external', required: true }
      ],
      python: [
        { name: 'requests', type: 'import', scope: 'external', required: false },
        { name: 'json', type: 'import', scope: 'system', required: true }
      ]
    };

    this.dependencies = commonDependencies[this.programmingLanguage || ''] || [];
  }

  private async analyzeCodeQuality(): Promise<void> {
    // This would integrate with code quality tools like ESLint, Pylint, etc.
    const issues = [];
    const randomIssueCount = Math.floor(Math.random() * 5);
    
    for (let i = 0; i < randomIssueCount; i++) {
      issues.push({
        type: 'warning' as const,
        severity: 'medium' as const,
        rule: 'code-style',
        message: 'Consider using const instead of let',
        line: Math.floor(Math.random() * 100) + 1,
        column: Math.floor(Math.random() * 80) + 1,
        suggestion: 'Replace let with const'
      });
    }

    this.codeQuality = {
      score: Math.max(0, 100 - (issues.length * 10)),
      issues,
      lastAnalyzed: new Date(),
      analyzer: `${this.programmingLanguage}-analyzer`
    };
  }

  private async scanForSecurityIssues(): Promise<void> {
    // This would integrate with security scanning tools
    const vulnerabilities = [];
    
    // Simulate finding security issues occasionally
    if (Math.random() < 0.3) {
      vulnerabilities.push({
        severity: 'medium' as const,
        type: 'Input Validation',
        description: 'Potential SQL injection vulnerability',
        line: Math.floor(Math.random() * 100) + 1,
        cwe: 'CWE-89',
        recommendation: 'Use parameterized queries'
      });
    }

    this.securityScan = {
      scanned: true,
      scannedAt: new Date(),
      vulnerabilities,
      securityScore: vulnerabilities.length === 0 ? 100 : Math.max(0, 100 - (vulnerabilities.length * 30))
    };
  }

  // Code analysis methods
  getComplexityRating(): 'low' | 'medium' | 'high' | 'very_high' {
    const complexity = this.codeMetrics?.complexity || 0;
    if (complexity <= 3) return 'low';
    if (complexity <= 6) return 'medium';
    if (complexity <= 10) return 'high';
    return 'very_high';
  }

  getMaintainabilityRating(): 'poor' | 'fair' | 'good' | 'excellent' {
    const index = this.codeMetrics?.maintainabilityIndex || 0;
    if (index < 50) return 'poor';
    if (index < 70) return 'fair';
    if (index < 85) return 'good';
    return 'excellent';
  }

  hasSecurityIssues(): boolean {
    return (this.securityScan?.vulnerabilities?.length || 0) > 0;
  }

  getCriticalSecurityIssues(): NonNullable<NonNullable<SourceCode['securityScan']>['vulnerabilities']> {
    return this.securityScan?.vulnerabilities?.filter(v => v.severity === 'critical') || [];
  }

  needsReview(): boolean {
    // Code needs review if:
    // - High complexity
    // - Low maintainability
    // - Security issues
    // - No recent reviews
    
    const highComplexity = this.getComplexityRating() === 'very_high';
    const lowMaintainability = this.getMaintainabilityRating() === 'poor';
    const hasSecurityIssues = this.hasSecurityIssues();
    
    const recentReview = this.codeReviews?.some(review => {
      const reviewDate = review.reviewedAt;
      if (!reviewDate) return false;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return reviewDate > thirtyDaysAgo;
    });

    return highComplexity || lowMaintainability || hasSecurityIssues || !recentReview;
  }

  addCodeReview(reviewId: string, reviewer: string): void {
    if (!this.codeReviews) {
      this.codeReviews = [];
    }

    this.codeReviews.push({
      reviewId,
      reviewer,
      status: 'pending',
      comments: []
    });
  }

  updateReviewStatus(reviewId: string, status: NonNullable<SourceCode['codeReviews']>[0]['status'], comments?: NonNullable<SourceCode['codeReviews']>[0]['comments']): void {
    const review = this.codeReviews?.find(r => r.reviewId === reviewId);
    if (review) {
      review.status = status;
      review.reviewedAt = new Date();
      if (comments) {
        review.comments = comments;
      }
    }
  }

  getCodeHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Code quality (40%)
    factors.quality = this.codeQuality?.score || 50;
    if (factors.quality < 70) {
      issues.push('Code quality needs improvement');
    }

    // Security (30%)
    factors.security = this.securityScan?.securityScore || 50;
    if (factors.security < 80) {
      issues.push('Security vulnerabilities detected');
    }

    // Maintainability (20%)
    const maintainability = this.codeMetrics?.maintainabilityIndex || 50;
    factors.maintainability = maintainability;
    if (maintainability < 60) {
      issues.push('Code maintainability is low');
    }

    // Test coverage (10%)
    factors.testCoverage = this.testInfo?.testCoverage || 0;
    if (factors.testCoverage < 80) {
      issues.push('Insufficient test coverage');
    }

    const totalScore = 
      factors.quality * 0.4 + 
      factors.security * 0.3 + 
      factors.maintainability * 0.2 + 
      factors.testCoverage * 0.1;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  getTechnicalDebtMinutes(): number {
    return this.codeMetrics?.technicalDebt || 0;
  }

  getRefactoringPriority(): 'low' | 'medium' | 'high' | 'critical' {
    const health = this.getCodeHealth();
    const complexity = this.getComplexityRating();
    const maintainability = this.getMaintainabilityRating();

    if (health.score < 40 || complexity === 'very_high' || maintainability === 'poor') {
      return 'critical';
    }
    if (health.score < 60 || complexity === 'high' || maintainability === 'fair') {
      return 'high';
    }
    if (health.score < 80 || complexity === 'medium') {
      return 'medium';
    }
    return 'low';
  }
}