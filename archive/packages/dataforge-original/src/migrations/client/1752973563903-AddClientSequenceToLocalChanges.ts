import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClientSequenceToLocalChanges1752973563903 implements MigrationInterface {
    name = 'AddClientSequenceToLocalChanges1752973563903'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" ADD "clientSequence" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" DROP COLUMN "clientSequence"`);
    }

}
