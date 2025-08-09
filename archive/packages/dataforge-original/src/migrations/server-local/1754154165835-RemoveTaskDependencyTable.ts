import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveTaskDependencyTable1754154165835 implements MigrationInterface {
    name = 'RemoveTaskDependencyTable1754154165835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the old task_dependencies table
        await queryRunner.query(`DROP TABLE IF EXISTS "task_dependencies"`);
        
        // Drop the old enum type if it exists
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."task_dependencies_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate the old enum type
        await queryRunner.query(`CREATE TYPE "public"."task_dependencies_type_enum" AS ENUM('blocks', 'depends-on', 'related-to')`);
        
        // Recreate the old task_dependencies junction table
        await queryRunner.query(`CREATE TABLE "task_dependencies" ("dependentTaskId" uuid NOT NULL, "dependencyTaskId" uuid NOT NULL, "type" "public"."task_dependencies_type_enum" NOT NULL DEFAULT 'depends-on', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_task_dependencies" PRIMARY KEY ("dependentTaskId", "dependencyTaskId"))`);
        
        // Recreate indexes
        await queryRunner.query(`CREATE INDEX "IDX_task_dependencies_dependentTaskId" ON "task_dependencies" ("dependentTaskId")`);
        await queryRunner.query(`CREATE INDEX "IDX_task_dependencies_dependencyTaskId" ON "task_dependencies" ("dependencyTaskId")`);
        
        // Recreate foreign keys
        await queryRunner.query(`ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_dependentTaskId" FOREIGN KEY ("dependentTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_dependencyTaskId" FOREIGN KEY ("dependencyTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}