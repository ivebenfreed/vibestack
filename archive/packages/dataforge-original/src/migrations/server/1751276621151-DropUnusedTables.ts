import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUnusedTables1751276621151 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop unused tables
        await queryRunner.query(`DROP TABLE IF EXISTS "client_migration_status" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "jwks" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sync_metadata" CASCADE`);
        
        // Drop unused enums
        await queryRunner.query(`DROP TYPE IF EXISTS "client_migration_migration_type_enum" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "client_migration_state_enum" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "client_migration_status_status_enum" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: This down migration is intentionally minimal as these were unused entities
        // If you need to restore them, refer to the original entity definitions
        console.log('Dropping unused tables - no rollback implemented as these were unused entities');
    }

}
