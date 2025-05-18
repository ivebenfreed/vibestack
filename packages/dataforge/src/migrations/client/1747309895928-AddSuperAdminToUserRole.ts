import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuperAdminToUserRole1747309895928 implements MigrationInterface {
    name = 'AddSuperAdminToUserRole1747309895928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // The UserRole enum ('users_role_enum') should already exist from a previous migration.
        // We only need to add the new 'super_admin' value.
        // Using IF NOT EXISTS for the value is good practice, though not all Postgres versions support it for ADD VALUE.
        // PGlite is based on modern Postgres, so it should be fine.
        // If not, a simple ADD VALUE 'super_admin' would also work if we're sure it's not there.
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'super_admin'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Removing an enum value is complex in PostgreSQL.
        // It typically requires ensuring no data uses the value, then recreating the type 
        // without the value, and updating any dependent columns or constraints.
        // For this migration's down method, we will log the complexity.
        // A full revert would involve:
        // 1. UPDATE users SET role = 'admin' WHERE role = 'super_admin'; (or handle data as appropriate)
        // 2. Recreate the enum without 'super_admin':
        //    DROP TYPE "public"."users_role_enum";
        //    CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'member', 'viewer');
        // 3. Potentially update table column defaults if they referenced the old type.
        console.warn("Down migration for 'AddSuperAdminToUserRole1747309895928':");
        console.warn("Reverting the addition of 'super_admin' to 'users_role_enum' requires manual data migration");
        console.warn("and potentially recreating the enum type and updating dependent columns.");
        console.warn("This down migration will not automatically perform these complex steps.");
        // As a minimal (but potentially data-inconsistent if 'super_admin' is in use) down step,
        // one might try to recreate the type without 'super_admin'.
        // await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
        // await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'member', 'viewer')`);
    }

}
