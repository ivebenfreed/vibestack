import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStartDateAndCheckConstraintToTask1747840899106 implements MigrationInterface {
    name = 'AddStartDateAndCheckConstraintToTask1747840899106'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "start_date" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "chk_task_start_date_before_due_date" CHECK (("start_date" IS NULL OR "due_date" IS NULL) OR ("start_date" < "due_date"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "chk_task_start_date_before_due_date"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "start_date"`);
    }

}
