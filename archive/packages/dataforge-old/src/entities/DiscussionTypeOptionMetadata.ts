import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class DiscussionTypeOptionMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'boolean', default: true, fieldName: 'is_threadable' })
  isThreadable!: boolean; // Whether this type supports threaded replies

  @Property({ type: 'boolean', default: false, fieldName: 'is_resolvable' })
  isResolvable!: boolean; // Whether discussions of this type can be marked as resolved

  @Property({ type: 'boolean', default: true, fieldName: 'allows_rich_content' })
  allowsRichContent!: boolean; // Supports markdown, images, etc.

  @Property({ type: 'boolean', default: true, fieldName: 'requires_parent_entity' })
  requiresParentEntity!: boolean; // Must be attached to another entity

  @Property({ type: 'boolean', default: true, fieldName: 'allows_mentions' })
  allowsMentions!: boolean; // Supports @user mentions

  @Property({ type: 'boolean', default: false, fieldName: 'is_private' })
  isPrivate!: boolean; // Private messages vs public comments

  @Property({ type: 'boolean', default: false, fieldName: 'requires_moderation' })
  requiresModeration!: boolean; // Needs approval before being visible

  @Property({ type: 'array', nullable: true, fieldName: 'allowed_attachments' })
  allowedAttachments?: string[]; // Allowed file types for attachments

  @Property({ type: 'int', nullable: true, fieldName: 'max_thread_depth' })
  maxThreadDepth?: number; // Maximum nesting level for replies

  @Property({ type: 'json', nullable: true, fieldName: 'notification_rules' })
  notificationRules?: any; // Who gets notified for this discussion type
}