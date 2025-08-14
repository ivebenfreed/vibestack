import { Migration } from '@mikro-orm/migrations';

export class Migration20250812172634_convertToSnakeCaseAndUuid extends Migration {

  override async up(): Promise<void> {
    // Step 1: Convert Better Auth tables to snake_case and UUID
    
    // Add new UUID columns
    this.addSql(`
      ALTER TABLE "user" ADD COLUMN id_new uuid DEFAULT generate_uuidv7();
      ALTER TABLE session ADD COLUMN id_new uuid DEFAULT generate_uuidv7();
      ALTER TABLE session ADD COLUMN user_id_new uuid;
      ALTER TABLE account ADD COLUMN id_new uuid DEFAULT generate_uuidv7();
      ALTER TABLE account ADD COLUMN user_id_new uuid;
      ALTER TABLE verification ADD COLUMN id_new uuid DEFAULT generate_uuidv7();
    `);

    // Update foreign key relationships
    this.addSql(`
      UPDATE session SET user_id_new = u.id_new 
      FROM "user" u WHERE session."userId" = u.id;
      
      UPDATE account SET user_id_new = u.id_new 
      FROM "user" u WHERE account."userId" = u.id;
    `);

    // Drop foreign key constraints
    this.addSql(`
      ALTER TABLE session DROP CONSTRAINT IF EXISTS "session_userId_fkey";
      ALTER TABLE account DROP CONSTRAINT IF EXISTS "account_userId_fkey";
    `);

    // Convert USER table: drop old id, rename new id, then rename other columns
    this.addSql(`ALTER TABLE "user" DROP COLUMN id;`);
    this.addSql(`ALTER TABLE "user" RENAME COLUMN id_new TO id;`);
    this.addSql(`ALTER TABLE "user" RENAME COLUMN "emailVerified" TO email_verified;`);
    this.addSql(`ALTER TABLE "user" RENAME COLUMN "createdAt" TO created_at;`);
    this.addSql(`ALTER TABLE "user" RENAME COLUMN "updatedAt" TO updated_at;`);

    // Convert SESSION table: drop old columns, rename new ones
    this.addSql(`ALTER TABLE session DROP COLUMN id;`);
    this.addSql(`ALTER TABLE session DROP COLUMN "userId";`);
    this.addSql(`ALTER TABLE session RENAME COLUMN id_new TO id;`);
    this.addSql(`ALTER TABLE session RENAME COLUMN user_id_new TO user_id;`);
    this.addSql(`ALTER TABLE session RENAME COLUMN "expiresAt" TO expires_at;`);
    this.addSql(`ALTER TABLE session RENAME COLUMN "ipAddress" TO ip_address;`);
    this.addSql(`ALTER TABLE session RENAME COLUMN "userAgent" TO user_agent;`);
    this.addSql(`ALTER TABLE session RENAME COLUMN "createdAt" TO created_at;`);
    this.addSql(`ALTER TABLE session RENAME COLUMN "updatedAt" TO updated_at;`);

    // Convert ACCOUNT table: drop old columns, rename new ones
    this.addSql(`ALTER TABLE account DROP COLUMN id;`);
    this.addSql(`ALTER TABLE account DROP COLUMN "userId";`);
    this.addSql(`ALTER TABLE account RENAME COLUMN id_new TO id;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN user_id_new TO user_id;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "accountId" TO account_id;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "providerId" TO provider_id;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "accessToken" TO access_token;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "refreshToken" TO refresh_token;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "accessTokenExpiresAt" TO access_token_expires_at;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "refreshTokenExpiresAt" TO refresh_token_expires_at;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "idToken" TO id_token;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "createdAt" TO created_at;`);
    this.addSql(`ALTER TABLE account RENAME COLUMN "updatedAt" TO updated_at;`);

    // Convert VERIFICATION table: drop old id, rename new id and other columns
    this.addSql(`ALTER TABLE verification DROP COLUMN id;`);
    this.addSql(`ALTER TABLE verification RENAME COLUMN id_new TO id;`);
    this.addSql(`ALTER TABLE verification RENAME COLUMN "expiresAt" TO expires_at;`);
    this.addSql(`ALTER TABLE verification RENAME COLUMN "createdAt" TO created_at;`);
    this.addSql(`ALTER TABLE verification RENAME COLUMN "updatedAt" TO updated_at;`);

    // Add back primary key constraints
    this.addSql(`
      ALTER TABLE "user" ADD PRIMARY KEY (id);
      ALTER TABLE session ADD PRIMARY KEY (id);
      ALTER TABLE account ADD PRIMARY KEY (id);
      ALTER TABLE verification ADD PRIMARY KEY (id);
    `);

    // Add back foreign key constraints
    this.addSql(`
      ALTER TABLE session ADD CONSTRAINT session_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
      
      ALTER TABLE account ADD CONSTRAINT account_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);

    // Step 2: Add foreign key constraints for Week 3 entities (now that user.id is UUID)
    this.addSql(`
      ALTER TABLE entity_relationship ADD CONSTRAINT entity_relationship_created_by_fk 
      FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;
      
      ALTER TABLE label ADD CONSTRAINT label_created_by_fk 
      FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;
      
      ALTER TABLE label ADD CONSTRAINT label_created_by_user_fk 
      FOREIGN KEY (created_by_user_id) REFERENCES "user"(id) ON DELETE SET NULL;
      
      ALTER TABLE entity_label ADD CONSTRAINT entity_label_created_by_fk 
      FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;
      
      ALTER TABLE entity_label ADD CONSTRAINT entity_label_applied_by_user_fk 
      FOREIGN KEY (applied_by_user_id) REFERENCES "user"(id) ON DELETE SET NULL;
    `);
  }

  override async down(): Promise<void> {
    // This migration is complex to reverse due to UUID->text conversion
    // In production, implement proper rollback with data preservation
    this.addSql(`
      SELECT 'This migration cannot be easily reversed due to UUID->text conversion' as warning;
    `);
  }

}
