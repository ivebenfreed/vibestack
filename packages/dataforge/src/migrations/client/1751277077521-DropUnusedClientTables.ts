import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUnusedClientTables1751277077521 implements MigrationInterface {
    name = 'DropUnusedClientTables1751277077521';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop unused tables that were created in earlier migrations but are no longer needed
        await queryRunner.query(`DROP TABLE IF EXISTS "client_migration_status" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sync_metadata" CASCADE`);
        
        // Drop unused enum types
        await queryRunner.query(`DROP TYPE IF EXISTS "client_migration_status_status_enum" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: This down migration is intentionally minimal as these were unused entities
        // If you need to restore them, refer to the original entity definitions in git history
        console.log('Dropping unused client tables - no rollback implemented as these were unused entities');
    }

}
