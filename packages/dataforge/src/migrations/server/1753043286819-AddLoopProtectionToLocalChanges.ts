import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoopProtectionToLocalChanges1753043286819 implements MigrationInterface {
    name = 'AddLoopProtectionToLocalChanges1753043286819'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" ADD "send_attempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "local_changes" ADD "last_send_attempt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "local_changes" ADD "last_error" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" DROP COLUMN "last_error"`);
        await queryRunner.query(`ALTER TABLE "local_changes" DROP COLUMN "last_send_attempt"`);
        await queryRunner.query(`ALTER TABLE "local_changes" DROP COLUMN "send_attempts"`);
    }

}
