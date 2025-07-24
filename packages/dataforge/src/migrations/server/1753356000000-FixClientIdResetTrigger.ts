import { MigrationInterface, QueryRunner } from "typeorm";
import { SERVER_DOMAIN_TABLES } from "../../generated/server-entities.js";

/**
 * Migration to fix the client_id reset trigger.
 * 
 * The trigger should only set client_id to NULL when the incoming update
 * explicitly contains NULL for client_id. The previous implementation was
 * incorrectly resetting client_id when it hadn't changed, breaking anti-echo.
 * 
 * Since PostgreSQL already handles NULL values correctly in updates,
 * we're removing this trigger as it's not needed.
 */
export class FixClientIdResetTrigger1753356000000 implements MigrationInterface {
    name = 'FixClientIdResetTrigger1753356000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the problematic trigger from all domain tables
        for (const table of SERVER_DOMAIN_TABLES) {
            await queryRunner.query(`
                DROP TRIGGER IF EXISTS reset_client_id_trigger ON ${table};
            `);
            
            console.log(`Dropped reset_client_id_trigger from table ${table}`);
        }

        // Drop the trigger function as it's no longer needed
        await queryRunner.query(`
            DROP FUNCTION IF EXISTS reset_client_id() CASCADE;
        `);
        
        console.log('Dropped reset_client_id function - PostgreSQL handles NULL updates natively');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate the original trigger function (for rollback purposes)
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION reset_client_id()
            RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE' AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN
                    NEW.client_id = NULL;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Recreate triggers on all domain tables
        for (const table of SERVER_DOMAIN_TABLES) {
            await queryRunner.query(`
                CREATE TRIGGER reset_client_id_trigger
                BEFORE UPDATE ON ${table}
                FOR EACH ROW
                EXECUTE FUNCTION reset_client_id();
            `);
            
            console.log(`Recreated reset_client_id_trigger on table ${table}`);
        }
    }
}