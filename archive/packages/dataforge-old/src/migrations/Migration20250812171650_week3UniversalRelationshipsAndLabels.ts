import { Migration } from '@mikro-orm/migrations';

export class Migration20250812171650_week3UniversalRelationshipsAndLabels extends Migration {

  override async up(): Promise<void> {
    // Create EntityRelationship table for universal polymorphic relationships
    this.addSql(`
      CREATE TABLE entity_relationship (
        id uuid PRIMARY KEY DEFAULT generate_uuidv7(),
        client_id uuid NULL,
        container_type varchar(255) NOT NULL,
        container_id uuid NOT NULL,
        archetype varchar(255) NOT NULL,
        source_archetype varchar(255) NOT NULL,
        source_id uuid NOT NULL,
        target_archetype varchar(255) NOT NULL,
        target_id uuid NOT NULL,
        relationship_type varchar(255) NOT NULL,
        metadata jsonb NULL,
        sort_order int4 NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        is_bidirectional boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by_id uuid NULL,
        CONSTRAINT entity_relationship_unique_relationship UNIQUE (source_archetype, source_id, target_archetype, target_id, relationship_type)
      );
    `);

    // Create indexes for EntityRelationship
    this.addSql(`
      CREATE INDEX entity_relationship_source_idx ON entity_relationship (source_archetype, source_id);
      CREATE INDEX entity_relationship_target_idx ON entity_relationship (target_archetype, target_id);
      CREATE INDEX entity_relationship_type_idx ON entity_relationship (relationship_type);
      CREATE INDEX entity_relationship_container_idx ON entity_relationship (container_type, container_id);
    `);

    // Create Label table for universal tagging system
    this.addSql(`
      CREATE TABLE label (
        id uuid PRIMARY KEY DEFAULT generate_uuidv7(),
        client_id uuid NULL,
        container_type varchar(255) NOT NULL,
        container_id uuid NOT NULL,
        archetype varchar(255) NOT NULL,
        name varchar(255) NOT NULL,
        description text NULL,
        color varchar(7) NOT NULL DEFAULT '#94a3b8',
        icon varchar(255) NULL,
        category varchar(255) NULL,
        is_active boolean NOT NULL DEFAULT true,
        is_system boolean NOT NULL DEFAULT false,
        usage_count int4 NOT NULL DEFAULT 0,
        last_used_at timestamptz NULL,
        parent_id uuid NULL REFERENCES label(id) ON DELETE SET NULL,
        created_by_user_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by_id uuid NULL,
        CONSTRAINT label_unique_name UNIQUE (name)
      );
    `);

    // Create indexes for Label
    this.addSql(`
      CREATE INDEX label_category_idx ON label (category);
      CREATE INDEX label_is_active_idx ON label (is_active);
      CREATE INDEX label_container_idx ON label (container_type, container_id);
    `);

    // Create EntityLabel table for polymorphic label applications
    this.addSql(`
      CREATE TABLE entity_label (
        id uuid PRIMARY KEY DEFAULT generate_uuidv7(),
        client_id uuid NULL,
        container_type varchar(255) NOT NULL,
        container_id uuid NOT NULL,
        archetype varchar(255) NOT NULL,
        entity_archetype varchar(255) NOT NULL,
        entity_id uuid NOT NULL,
        label_id uuid NOT NULL REFERENCES label(id) ON DELETE CASCADE,
        sort_order int4 NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NULL,
        applied_by_user_id uuid NULL,
        applied_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by_id uuid NULL,
        CONSTRAINT entity_label_unique_entity_label UNIQUE (entity_archetype, entity_id, label_id)
      );
    `);

    // Create indexes for EntityLabel
    this.addSql(`
      CREATE INDEX entity_label_entity_idx ON entity_label (entity_archetype, entity_id);
      CREATE INDEX entity_label_label_idx ON entity_label (label_id);
      CREATE INDEX entity_label_container_idx ON entity_label (container_type, container_id);
    `);

    // Note: User foreign key constraints will be added after Better Auth UUID conversion migration
  }

  override async down(): Promise<void> {
    // Drop tables in reverse order (respecting foreign key constraints)
    this.addSql(`DROP TABLE IF EXISTS entity_label CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS label CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS entity_relationship CASCADE;`);
  }

}
