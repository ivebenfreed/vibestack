import { Migration } from '@mikro-orm/migrations';

export class Migration20250812164548 extends Migration {

  override async up(): Promise<void> {
    // Create UUIDv7 function for timestamp-ordered UUIDs (simplified implementation)
    this.addSql(`
      CREATE OR REPLACE FUNCTION generate_uuidv7()
      RETURNS uuid
      AS $$
      DECLARE
        unix_ts_ms BIGINT;
        uuid_hex TEXT;
      BEGIN
        unix_ts_ms := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000);
        
        -- Format: 48-bit timestamp + version 7 + random bits
        uuid_hex := 
          lpad(to_hex(unix_ts_ms), 12, '0') ||
          '7' || 
          lpad(to_hex((random() * 4095)::int), 3, '0') ||
          '8' ||
          lpad(to_hex((random() * 4611686018427387903::bigint)::bigint), 15, '0');
          
        -- Insert dashes to make it a proper UUID format
        RETURN (
          substr(uuid_hex, 1, 8) || '-' ||
          substr(uuid_hex, 9, 4) || '-' ||
          substr(uuid_hex, 13, 4) || '-' ||
          substr(uuid_hex, 17, 4) || '-' ||
          substr(uuid_hex, 21, 12)
        )::uuid;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create indexes for better performance (without CONCURRENTLY in migration)
    this.addSql('CREATE INDEX IF NOT EXISTS idx_created_at ON "user" ("createdAt");');
  }

  override async down(): Promise<void> {
    this.addSql('DROP FUNCTION IF EXISTS generate_uuidv7();');
    this.addSql('DROP INDEX IF EXISTS idx_created_at;');
  }

}
