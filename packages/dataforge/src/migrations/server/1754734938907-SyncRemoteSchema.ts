import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncRemoteSchema1754734938907 implements MigrationInterface {
    name = 'SyncRemoteSchema1754734938907'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."entity_dependencies_dependency_type_enum" AS ENUM('finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish')`);
        await queryRunner.query(`CREATE TABLE "entity_dependencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "entity_type" character varying(50) NOT NULL, "predecessor_id" uuid NOT NULL, "successor_id" uuid NOT NULL, "dependency_type" "public"."entity_dependencies_dependency_type_enum" NOT NULL DEFAULT 'finish-to-start', "lag_time" interval, "lag_days" integer, "metadata" jsonb, "description" text, CONSTRAINT "PK_cad8e5c0fb9ab6558cb1cb6d297" PRIMARY KEY ("id")); COMMENT ON COLUMN "entity_dependencies"."lag_time" IS 'Positive values delay successor, negative values allow overlap'; COMMENT ON COLUMN "entity_dependencies"."lag_days" IS 'Lag time in days. Positive = delay, negative = lead time'; COMMENT ON COLUMN "entity_dependencies"."metadata" IS 'Optional entity-specific metadata'`);
        await queryRunner.query(`CREATE INDEX "IDX_f328a9c04d343d5563a027baa7" ON "entity_dependencies" ("entity_type", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_4545dc469cfe7fc0b5b555b627" ON "entity_dependencies" ("entity_type", "successor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c500dfb1720eda633a90f45b60" ON "entity_dependencies" ("entity_type", "predecessor_id") `);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "isArchived"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "isArchived" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c500dfb1720eda633a90f45b60"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4545dc469cfe7fc0b5b555b627"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f328a9c04d343d5563a027baa7"`);
        await queryRunner.query(`DROP TABLE "entity_dependencies"`);
        await queryRunner.query(`DROP TYPE "public"."entity_dependencies_dependency_type_enum"`);
    }

}
