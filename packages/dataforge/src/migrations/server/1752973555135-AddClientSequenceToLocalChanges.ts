import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClientSequenceToLocalChanges1752973555135 implements MigrationInterface {
    name = 'AddClientSequenceToLocalChanges1752973555135'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "local_changes" ADD "clientSequence" text`);
        await queryRunner.query(`CREATE INDEX "IDX_e9a1987ae0b1a690d834926fe8" ON "local_changes" ("processed_sync") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e9a1987ae0b1a690d834926fe8"`);
        await queryRunner.query(`ALTER TABLE "local_changes" DROP COLUMN "clientSequence"`);
    }

}
