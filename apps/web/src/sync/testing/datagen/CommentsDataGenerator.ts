import { BaseDataGenerator, type DomainEntityType, type EntitySchema } from './BaseDataGenerator';

/**
 * Data generator for Comments entity
 */
export class CommentsDataGenerator extends BaseDataGenerator {
  protected entityType: DomainEntityType = 'comments';
  
  protected schema: EntitySchema = {
    requiredFields: {
      content: 'string'
    },
    optionalFields: {
      authorId: 'uuid',
      parentId: 'uuid',
      taskId: 'uuid',
      projectId: 'uuid'
    },
    relationships: {
      belongsTo: [
        { field: 'author', entity: 'users', required: false },
        { field: 'task', entity: 'tasks', required: false },
        { field: 'project', entity: 'projects', required: false },
        { field: 'parent', entity: 'comments', required: false }
      ]
    },
    enums: {},
    constraints: {
      maxLength: { content: 5000 }
    }
  };

  protected getStringTemplates(field: string): string[] {
    const templates: Record<string, string[]> = {
      content: [
        'Comment {{index}}',
        'Note {{index}}',
        'Feedback {{index}}',
        'This looks good to me! Comment {{index}}',
        'I have some concerns about this approach. Comment {{index}}',
        'Great work on this feature! Comment {{index}}',
        'Could we consider an alternative solution? Comment {{index}}',
        'This needs some additional testing. Comment {{index}}',
        'Documentation should be updated for this change. Comment {{index}}',
        'Performance looks good after this optimization. Comment {{index}}',
        'I found a potential issue here. Comment {{index}}',
        'This resolves the bug we discussed. Comment {{index}}',
        'Nice implementation! Very clean code. Comment {{index}}',
        'We should add error handling for edge cases. Comment {{index}}',
        'This feature request makes sense. Comment {{index}}',
        'The user interface is intuitive and user-friendly. Comment {{index}}',
        'Database schema changes look correct. Comment {{index}}',
        'API endpoints are well-designed and RESTful. Comment {{index}}',
        'Security considerations have been addressed. Comment {{index}}',
        'This will improve the overall user experience. Comment {{index}}'
      ]
    };
    
    return templates[field] || [`Comment {{index}}`];
  }

  // Override string generation for content to make it more realistic
  protected generateStringValue(field: string, index: number): string {
    if (field === 'content') {
      const templates = this.getStringTemplates(field);
      const template = templates[index % templates.length];
      
      // For comments, sometimes add additional context
      const baseContent = template.replace('{{index}}', String(index + 1));
      
      // 30% chance to add additional context
      if (Math.random() < 0.3) {
        const additionalContext = [
          'Let me know if you need any clarification.',
          'I can help with the implementation if needed.',
          'This should be ready for review.',
          'Please test this thoroughly before deployment.',
          'Consider the impact on existing users.',
          'This aligns with our project goals.',
          'We should discuss this in the next meeting.',
          'Good catch! Thanks for pointing this out.'
        ];
        
        const randomContext = additionalContext[Math.floor(Math.random() * additionalContext.length)];
        return `${baseContent} ${randomContext}`;
      }
      
      return baseContent;
    }
    
    return super.generateStringValue(field, index);
  }

  // Override UUID reference generation to handle comment-specific relationships
  protected generateUuidReference(field: string, relationships: Record<string, any[]>): string | undefined {
    // For comments, we want to ensure they're attached to either a task or project
    if (field === 'taskId' && relationships.tasks && relationships.tasks.length > 0) {
      return this.getRandomItem(relationships.tasks).id;
    }
    
    if (field === 'projectId' && relationships.projects && relationships.projects.length > 0) {
      // Only set projectId if no taskId is set (comments can be on tasks OR projects)
      return this.getRandomItem(relationships.projects).id;
    }
    
    if (field === 'authorId' && relationships.users && relationships.users.length > 0) {
      return this.getRandomItem(relationships.users).id;
    }
    
    if (field === 'parentId' && relationships.comments && relationships.comments.length > 0) {
      // 20% chance to be a reply to another comment
      if (Math.random() < 0.2) {
        return this.getRandomItem(relationships.comments).id;
      }
    }
    
    return super.generateUuidReference(field, relationships);
  }
} 