import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClientSequenceToLocalChanges1752973579431 implements MigrationInterface {
    name = 'AddClientSequenceToLocalChanges1752973579431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" ADD "clientSequence" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" DROP COLUMN "clientSequence"`);
    }

}
