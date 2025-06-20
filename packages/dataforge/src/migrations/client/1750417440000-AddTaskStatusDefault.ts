import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskStatusDefault1750417440000 implements MigrationInterface {
    name = 'AddTaskStatusDefault1750417440000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'open'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT`);
    }

} 