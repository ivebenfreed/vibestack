import { Entity, Property } from '@mikro-orm/core';
import { DocumentArchetype } from '../archetypes/DocumentArchetype.js';

/**
 * User manual documentation with structured content and user guidance
 * Extends DocumentArchetype with manual-specific workflows
 */
@Entity({ tableName: 'user_manual' })
export class UserManual extends DocumentArchetype {
  @Property({ nullable: true, fieldName: 'manual_type' })
  manualType?: 'software' | 'hardware' | 'process' | 'policy' | 'training' | 'api' | 'installation' | 'troubleshooting';

  @Property({ nullable: true, fieldName: 'target_audience' })
  targetAudience?: 'end_user' | 'administrator' | 'developer' | 'support' | 'manager' | 'general';

  @Property({ nullable: true, fieldName: 'product_version' })
  productVersion?: string;

  @Property({ nullable: true, fieldName: 'difficulty_level' })
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';

  @Property({ type: 'json', nullable: true })
  sections?: Array<{
    id: string;
    title: string;
    order: number;
    content: string;
    type: 'overview' | 'procedure' | 'reference' | 'troubleshooting' | 'faq' | 'examples';
    prerequisites?: string[];
    estimatedTime?: number; // minutes
    difficulty?: 'easy' | 'medium' | 'hard';
  }>;

  @Property({ type: 'json', nullable: true })
  procedures?: Array<{
    id: string;
    title: string;
    description: string;
    steps: Array<{
      stepNumber: number;
      instruction: string;
      expectedResult?: string;
      screenshots?: string[];
      tips?: string[];
      warnings?: string[];
    }>;
    prerequisites?: string[];
    tools?: string[];
    estimatedTime?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  }>;

  @Property({ type: 'json', nullable: true })
  troubleshooting?: Array<{
    problem: string;
    symptoms: string[];
    causes?: string[];
    solution: string;
    steps?: string[];
    prevention?: string;
    relatedIssues?: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }>;

  @Property({ type: 'json', nullable: true })
  faq?: Array<{
    question: string;
    answer: string;
    category?: string;
    keywords?: string[];
    relatedTopics?: string[];
  }>;

  @Property({ type: 'json', nullable: true })
  glossary?: Array<{
    term: string;
    definition: string;
    category?: string;
    synonyms?: string[];
    relatedTerms?: string[];
  }>;

  @Property({ type: 'json', nullable: true })
  references?: Array<{
    title: string;
    type: 'internal' | 'external' | 'api' | 'document';
    url?: string;
    description?: string;
    relevance?: 'high' | 'medium' | 'low';
  }>;

  @Property({ type: 'json', nullable: true })
  examples?: Array<{
    title: string;
    description: string;
    code?: string;
    language?: string;
    input?: string;
    output?: string;
    explanation?: string;
    difficulty?: 'basic' | 'intermediate' | 'advanced';
  }>;

  @Property({ type: 'json', nullable: true })
  screenshots?: Array<{
    id: string;
    title: string;
    url: string;
    description?: string;
    sectionId?: string;
    procedureId?: string;
    annotations?: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      type: 'highlight' | 'arrow' | 'text' | 'circle';
    }>;
  }>;

  @Property({ type: 'json', nullable: true })
  prerequisites?: Array<{
    type: 'knowledge' | 'software' | 'hardware' | 'access' | 'skill';
    item: string;
    description?: string;
    required: boolean;
    alternatives?: string[];
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'version_changes' })
  versionChanges?: Array<{
    version: string;
    date: Date;
    type: 'major' | 'minor' | 'patch' | 'hotfix';
    changes: string[];
    impactedSections?: string[];
    backwardCompatible?: boolean;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'user_feedback' })
  userFeedback?: Array<{
    userId: string;
    sectionId?: string;
    rating: number; // 1-5
    comment?: string;
    helpful: boolean;
    suggestions?: string[];
    submittedAt: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'usage_analytics' })
  usageAnalytics?: {
    totalViews?: number;
    uniqueUsers?: number;
    avgTimeOnPage?: number;
    mostViewedSections?: Array<{
      sectionId: string;
      views: number;
    }>;
    searchQueries?: Array<{
      query: string;
      count: number;
      found: boolean;
    }>;
    lastUpdated?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'localization' })
  localization?: {
    primaryLanguage: string;
    availableLanguages?: string[];
    translationStatus?: Record<string, 'complete' | 'in_progress' | 'needs_update'>;
    culturalNotes?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'accessibility_features' })
  accessibilityFeatures?: {
    altTextProvided: boolean;
    keyboardNavigation: boolean;
    screenReaderFriendly: boolean;
    colorBlindFriendly: boolean;
    fontSize?: 'small' | 'medium' | 'large';
    highContrast?: boolean;
  };

  // Implementation of abstract methods
  getDocumentType(): string {
    return 'user_manual';
  }

  async validateDocumentRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // User manual validation
    if (!this.manualType) {
      return false; // Manual type is required
    }

    if (!this.targetAudience) {
      return false; // Target audience is required
    }

    // Must have sections or procedures
    if ((!this.sections || this.sections.length === 0) && 
        (!this.procedures || this.procedures.length === 0)) {
      return false;
    }

    // Validate section order is sequential
    if (this.sections) {
      const orders = this.sections.map(s => s.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          return false; // Section orders must be sequential starting from 1
        }
      }
    }

    // Validate procedure steps are sequential
    if (this.procedures) {
      for (const procedure of this.procedures) {
        const stepNumbers = procedure.steps.map(s => s.stepNumber).sort((a, b) => a - b);
        for (let i = 0; i < stepNumbers.length; i++) {
          if (stepNumbers[i] !== i + 1) {
            return false; // Step numbers must be sequential
          }
        }
      }
    }

    return true;
  }

  async generatePreview(): Promise<string> {
    const preview: string[] = [];

    preview.push(`USER MANUAL: ${this.title}`);
    preview.push(`Type: ${this.manualType || 'General'}`);
    preview.push(`Audience: ${this.targetAudience || 'General'}`);
    if (this.productVersion) {
      preview.push(`Version: ${this.productVersion}`);
    }
    preview.push('');

    // Table of contents
    if (this.sections && this.sections.length > 0) {
      preview.push('TABLE OF CONTENTS:');
      this.sections
        .sort((a, b) => a.order - b.order)
        .forEach(section => {
          preview.push(`${section.order}. ${section.title}`);
        });
      preview.push('');
    }

    // Quick overview
    if (this.content) {
      preview.push('OVERVIEW:');
      preview.push(this.content.substring(0, 300) + '...');
      preview.push('');
    }

    // Key procedures
    if (this.procedures && this.procedures.length > 0) {
      preview.push('KEY PROCEDURES:');
      this.procedures.slice(0, 3).forEach(proc => {
        preview.push(`- ${proc.title}: ${proc.description}`);
      });
    }

    return preview.join('\n');
  }

  async processContentForExport(format: string): Promise<string> {
    const content: string[] = [];

    // Header
    content.push(`# ${this.title}`);
    content.push(`**Type:** ${this.manualType || 'General'}`);
    content.push(`**Target Audience:** ${this.targetAudience || 'General'}`);
    if (this.productVersion) {
      content.push(`**Version:** ${this.productVersion}`);
    }
    if (this.difficultyLevel) {
      content.push(`**Difficulty:** ${this.difficultyLevel}`);
    }
    content.push('');

    // Table of Contents
    if (this.sections && this.sections.length > 0) {
      content.push('## Table of Contents');
      this.sections
        .sort((a, b) => a.order - b.order)
        .forEach(section => {
          content.push(`${section.order}. [${section.title}](#${section.id})`);
        });
      content.push('');
    }

    // Prerequisites
    if (this.prerequisites && this.prerequisites.length > 0) {
      content.push('## Prerequisites');
      this.prerequisites.forEach(prereq => {
        const required = prereq.required ? '**Required**' : '*Optional*';
        content.push(`- ${required} ${prereq.item}: ${prereq.description || ''}`);
      });
      content.push('');
    }

    // Overview
    if (this.content) {
      content.push('## Overview');
      content.push(this.content);
      content.push('');
    }

    // Sections
    if (this.sections && this.sections.length > 0) {
      this.sections
        .sort((a, b) => a.order - b.order)
        .forEach(section => {
          content.push(`## ${section.title} {#${section.id}}`);
          content.push(section.content);
          if (section.estimatedTime) {
            content.push(`*Estimated time: ${section.estimatedTime} minutes*`);
          }
          content.push('');
        });
    }

    // Procedures
    if (this.procedures && this.procedures.length > 0) {
      content.push('## Procedures');
      this.procedures.forEach(procedure => {
        content.push(`### ${procedure.title}`);
        content.push(procedure.description);
        
        if (procedure.prerequisites) {
          content.push('**Prerequisites:**');
          procedure.prerequisites.forEach(prereq => {
            content.push(`- ${prereq}`);
          });
        }
        
        content.push('**Steps:**');
        procedure.steps.forEach(step => {
          content.push(`${step.stepNumber}. ${step.instruction}`);
          if (step.expectedResult) {
            content.push(`   *Expected result: ${step.expectedResult}*`);
          }
          if (step.tips && step.tips.length > 0) {
            content.push(`   💡 **Tips:** ${step.tips.join(', ')}`);
          }
          if (step.warnings && step.warnings.length > 0) {
            content.push(`   ⚠️ **Warning:** ${step.warnings.join(', ')}`);
          }
        });
        content.push('');
      });
    }

    // Troubleshooting
    if (this.troubleshooting && this.troubleshooting.length > 0) {
      content.push('## Troubleshooting');
      this.troubleshooting.forEach(issue => {
        content.push(`### ${issue.problem}`);
        if (issue.symptoms.length > 0) {
          content.push('**Symptoms:**');
          issue.symptoms.forEach(symptom => content.push(`- ${symptom}`));
        }
        content.push(`**Solution:** ${issue.solution}`);
        if (issue.steps) {
          content.push('**Steps:**');
          issue.steps.forEach((step, index) => {
            content.push(`${index + 1}. ${step}`);
          });
        }
        if (issue.prevention) {
          content.push(`**Prevention:** ${issue.prevention}`);
        }
        content.push('');
      });
    }

    // FAQ
    if (this.faq && this.faq.length > 0) {
      content.push('## Frequently Asked Questions');
      this.faq.forEach((faqItem, index) => {
        content.push(`### ${index + 1}. ${faqItem.question}`);
        content.push(faqItem.answer);
        content.push('');
      });
    }

    // Glossary
    if (this.glossary && this.glossary.length > 0) {
      content.push('## Glossary');
      this.glossary
        .sort((a, b) => a.term.localeCompare(b.term))
        .forEach(term => {
          content.push(`**${term.term}:** ${term.definition}`);
        });
      content.push('');
    }

    // References
    if (this.references && this.references.length > 0) {
      content.push('## References');
      this.references.forEach(ref => {
        if (ref.url) {
          content.push(`- [${ref.title}](${ref.url}) - ${ref.description || ''}`);
        } else {
          content.push(`- ${ref.title} - ${ref.description || ''}`);
        }
      });
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
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/^(\d+)\. (.+)$/gm, '<ol><li>$2</li></ol>')
          .replace(/\n/g, '<br>');
      case 'json':
        return JSON.stringify({
          title: this.title,
          type: this.manualType,
          audience: this.targetAudience,
          version: this.productVersion,
          content: fullContent,
          sections: this.sections,
          procedures: this.procedures,
          troubleshooting: this.troubleshooting,
          faq: this.faq
        }, null, 2);
      default:
        return fullContent;
    }
  }

  // User manual business logic
  addSection(title: string, content: string, type: NonNullable<UserManual['sections']>[0]['type']): string {
    if (!this.sections) {
      this.sections = [];
    }

    const sectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const order = this.sections.length + 1;

    this.sections.push({
      id: sectionId,
      title,
      order,
      content,
      type
    });

    return sectionId;
  }

  addProcedure(title: string, description: string, steps: NonNullable<UserManual['procedures']>[0]['steps']): string {
    if (!this.procedures) {
      this.procedures = [];
    }

    const procedureId = `procedure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.procedures.push({
      id: procedureId,
      title,
      description,
      steps
    });

    return procedureId;
  }

  addTroubleshootingIssue(problem: string, symptoms: string[], solution: string, steps?: string[]): void {
    if (!this.troubleshooting) {
      this.troubleshooting = [];
    }

    this.troubleshooting.push({
      problem,
      symptoms,
      solution,
      steps
    });
  }

  addFAQ(question: string, answer: string, category?: string): void {
    if (!this.faq) {
      this.faq = [];
    }

    this.faq.push({
      question,
      answer,
      category
    });
  }

  addGlossaryTerm(term: string, definition: string, category?: string): void {
    if (!this.glossary) {
      this.glossary = [];
    }

    // Check if term already exists
    const existingIndex = this.glossary.findIndex(g => g.term.toLowerCase() === term.toLowerCase());
    if (existingIndex >= 0) {
      this.glossary[existingIndex] = { term, definition, category };
    } else {
      this.glossary.push({ term, definition, category });
    }
  }

  addUserFeedback(userId: string, rating: number, helpful: boolean, comment?: string, sectionId?: string): void {
    if (!this.userFeedback) {
      this.userFeedback = [];
    }

    this.userFeedback.push({
      userId,
      sectionId,
      rating,
      comment,
      helpful,
      submittedAt: new Date()
    });
  }

  reorderSections(newOrder: string[]): void {
    if (!this.sections) return;

    newOrder.forEach((sectionId, index) => {
      const section = this.sections?.find(s => s.id === sectionId);
      if (section) {
        section.order = index + 1;
      }
    });
  }

  getAverageRating(): number {
    if (!this.userFeedback || this.userFeedback.length === 0) return 0;
    
    const totalRating = this.userFeedback.reduce((sum, feedback) => sum + feedback.rating, 0);
    return totalRating / this.userFeedback.length;
  }

  getHelpfulnessRatio(): number {
    if (!this.userFeedback || this.userFeedback.length === 0) return 0;
    
    const helpfulCount = this.userFeedback.filter(f => f.helpful).length;
    return helpfulCount / this.userFeedback.length;
  }

  getMostViewedSections(): NonNullable<NonNullable<UserManual['usageAnalytics']>['mostViewedSections']> {
    return this.usageAnalytics?.mostViewedSections || [];
  }

  searchContent(query: string): Array<{ type: 'section' | 'procedure' | 'faq' | 'troubleshooting'; id: string; title: string; relevance: number }> {
    const results: Array<{ type: 'section' | 'procedure' | 'faq' | 'troubleshooting'; id: string; title: string; relevance: number }> = [];
    const searchTerm = query.toLowerCase();

    // Search sections
    this.sections?.forEach(section => {
      const titleMatch = section.title.toLowerCase().includes(searchTerm);
      const contentMatch = section.content.toLowerCase().includes(searchTerm);
      
      if (titleMatch || contentMatch) {
        const relevance = titleMatch ? 1.0 : 0.5;
        results.push({ type: 'section', id: section.id, title: section.title, relevance });
      }
    });

    // Search procedures
    this.procedures?.forEach(procedure => {
      const titleMatch = procedure.title.toLowerCase().includes(searchTerm);
      const descMatch = procedure.description.toLowerCase().includes(searchTerm);
      const stepsMatch = procedure.steps.some(step => step.instruction.toLowerCase().includes(searchTerm));
      
      if (titleMatch || descMatch || stepsMatch) {
        const relevance = titleMatch ? 1.0 : (descMatch ? 0.7 : 0.5);
        results.push({ type: 'procedure', id: procedure.id, title: procedure.title, relevance });
      }
    });

    // Search FAQ
    this.faq?.forEach((faqItem, index) => {
      const questionMatch = faqItem.question.toLowerCase().includes(searchTerm);
      const answerMatch = faqItem.answer.toLowerCase().includes(searchTerm);
      
      if (questionMatch || answerMatch) {
        const relevance = questionMatch ? 1.0 : 0.6;
        results.push({ type: 'faq', id: index.toString(), title: faqItem.question, relevance });
      }
    });

    // Search troubleshooting
    this.troubleshooting?.forEach((issue, index) => {
      const problemMatch = issue.problem.toLowerCase().includes(searchTerm);
      const solutionMatch = issue.solution.toLowerCase().includes(searchTerm);
      const symptomsMatch = issue.symptoms.some(symptom => symptom.toLowerCase().includes(searchTerm));
      
      if (problemMatch || solutionMatch || symptomsMatch) {
        const relevance = problemMatch ? 1.0 : (solutionMatch ? 0.8 : 0.6);
        results.push({ type: 'troubleshooting', id: index.toString(), title: issue.problem, relevance });
      }
    });

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  getManualHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Content completeness (40%)
    factors.completeness = this.calculateContentCompleteness();
    if (factors.completeness < 70) {
      issues.push('Manual lacks essential content sections');
    }

    // User satisfaction (35%)
    factors.userSatisfaction = this.calculateUserSatisfaction();
    if (factors.userSatisfaction < 60) {
      issues.push('User feedback indicates satisfaction issues');
    }

    // Maintenance quality (25%)
    factors.maintenance = this.calculateMaintenanceQuality();
    if (factors.maintenance < 50) {
      issues.push('Manual needs updating or maintenance');
    }

    const totalScore = 
      factors.completeness * 0.4 + 
      factors.userSatisfaction * 0.35 + 
      factors.maintenance * 0.25;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateContentCompleteness(): number {
    let score = 0;

    // Core content sections
    if (this.sections && this.sections.length > 0) score += 30;
    if (this.procedures && this.procedures.length > 0) score += 25;
    if (this.troubleshooting && this.troubleshooting.length > 0) score += 15;
    if (this.faq && this.faq.length > 0) score += 10;
    
    // Supporting content
    if (this.glossary && this.glossary.length > 0) score += 5;
    if (this.prerequisites && this.prerequisites.length > 0) score += 5;
    if (this.examples && this.examples.length > 0) score += 5;
    if (this.references && this.references.length > 0) score += 5;

    return Math.min(100, score);
  }

  private calculateUserSatisfaction(): number {
    if (!this.userFeedback || this.userFeedback.length === 0) return 50;

    const avgRating = this.getAverageRating();
    const helpfulnessRatio = this.getHelpfulnessRatio();
    
    // Convert 1-5 rating to 0-100 scale
    const ratingScore = ((avgRating - 1) / 4) * 100;
    const helpfulnessScore = helpfulnessRatio * 100;
    
    return (ratingScore + helpfulnessScore) / 2;
  }

  private calculateMaintenanceQuality(): number {
    let score = 70; // Base score

    // Version tracking
    if (this.productVersion) score += 10;
    if (this.versionChanges && this.versionChanges.length > 0) score += 10;

    // Accessibility
    if (this.accessibilityFeatures?.altTextProvided) score += 5;
    if (this.accessibilityFeatures?.screenReaderFriendly) score += 5;

    // Analytics and feedback integration
    if (this.usageAnalytics) score += 5;
    if (this.userFeedback && this.userFeedback.length > 0) score += 5;

    // Content freshness (age penalty)
    const ageInDays = (new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) score -= 20;
    else if (ageInDays > 180) score -= 10;

    return Math.max(0, Math.min(100, score));
  }
}