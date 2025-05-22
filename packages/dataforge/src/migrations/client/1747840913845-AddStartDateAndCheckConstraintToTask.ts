import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStartDateAndCheckConstraintToTask1747840913845 implements MigrationInterface {
    name = 'AddStartDateAndCheckConstraintToTask1747840913845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "start_date" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "start_date"`);
    }

}
