import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskStatusDefault1750417322238 implements MigrationInterface {
    name = 'AddTaskStatusDefault1750417322238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'open'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT`);
    }

}
