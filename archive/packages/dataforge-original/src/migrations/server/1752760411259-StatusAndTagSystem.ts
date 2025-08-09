import { MigrationInterface, QueryRunner } from "typeorm";

export class StatusAndTagSystem1752760411259 implements MigrationInterface {
    name = 'StatusAndTagSystem1752760411259'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sync_metadata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "client_id" text NOT NULL, "current_lsn" text NOT NULL DEFAULT '0/0', "sync_state" text NOT NULL DEFAULT 'disconnected', "last_sync_time" TIMESTAMP WITH TIME ZONE, "pending_changes_count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_fbdfc072a3e60cc5086d9d84b05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "jwks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publicKey" text NOT NULL, "privateKey" text NOT NULL, CONSTRAINT "PK_147086b49bf8366682d1a7ca7c1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "status_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status_set_id" uuid NOT NULL, "name" character varying(50) NOT NULL, "label" character varying(100) NOT NULL, "color" character varying(7) NOT NULL, "icon" character varying(50), "variant" character varying(20), "sort_order" integer NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "is_final" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "allowed_transitions" uuid array, "auto_transition_days" integer, "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_b0ace56b8b4d1c193813bb9f308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "status_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "entityType" character varying(50) NOT NULL, "description" text, "isSystem" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "default_color" character varying(7), "display_order" integer NOT NULL DEFAULT '0', "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_f41ed2fcb721a04481e85515d7f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tag_set_id" uuid NOT NULL, "name" character varying(50) NOT NULL, "slug" character varying(50) NOT NULL, "color" character varying(7) NOT NULL, "icon" character varying(50), "variant" character varying(20) NOT NULL DEFAULT 'solid', "sort_order" integer NOT NULL DEFAULT '0', "parent_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "usage_count" integer NOT NULL DEFAULT '0', "last_used_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_b3aa10c29ea4e61a830362bd25a" UNIQUE ("slug"), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tag_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "description" text, "category" character varying(50), "is_system" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "default_color" character varying(7) NOT NULL DEFAULT '#94a3b8', "display_order" integer NOT NULL DEFAULT '0', "is_exclusive" boolean NOT NULL DEFAULT false, "max_tags" integer, "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_ae758f64e111877a639b5a4dad2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."client_migration_status_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'rolled_back')`);
        await queryRunner.query(`CREATE TABLE "client_migration_status" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "migration_name" text NOT NULL, "schema_version" text NOT NULL, "status" "public"."client_migration_status_status_enum" NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "attempts" integer NOT NULL DEFAULT '0', "timestamp" bigint NOT NULL, CONSTRAINT "PK_c36ad25534183aea155df9ca89d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f6a012ebab7ea3ff10fa8f3c58" ON "client_migration_status" ("schema_version") `);
        await queryRunner.query(`CREATE TABLE "project_status_sets" ("project_id" uuid NOT NULL, "status_set_id" uuid NOT NULL, CONSTRAINT "PK_df26f812b71c869d8a39cc39980" PRIMARY KEY ("project_id", "status_set_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f3ca6851fd53ff904e9ce21468" ON "project_status_sets" ("project_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_968a062c0e1a4d13e351c522ba" ON "project_status_sets" ("status_set_id") `);
        await queryRunner.query(`CREATE TABLE "project_tag_sets" ("project_id" uuid NOT NULL, "tag_set_id" uuid NOT NULL, CONSTRAINT "PK_e63ae6baa6ca7e4acee6f88a26f" PRIMARY KEY ("project_id", "tag_set_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cb354bb259bbd85f63d7e120eb" ON "project_tag_sets" ("project_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c558e4e6f9e753f369582865c4" ON "project_tag_sets" ("tag_set_id") `);
        await queryRunner.query(`CREATE TABLE "task_tags" ("task_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_a7354e3c3f630636f6e4a29694a" PRIMARY KEY ("task_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_70515bc464901781ac60b82a1e" ON "task_tags" ("task_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f883135d033e1541f6a81972e7" ON "task_tags" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "client_migration" DROP COLUMN "dependencies"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "tags"`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_legacy_status_enum" AS ENUM('open', 'in_progress', 'completed')`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "legacy_status" "public"."tasks_legacy_status_enum" DEFAULT 'open'`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "status_id" uuid`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "legacy_tags" text array DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "status_definitions" ADD CONSTRAINT "FK_7bb8172ef1f90ff91d0c86d23ba" FOREIGN KEY ("status_set_id") REFERENCES "status_sets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_1b9d2591f78033221d6b7c726b6" FOREIGN KEY ("tag_set_id") REFERENCES "tag_sets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_bd19ddcde86ca1882599dbace11" FOREIGN KEY ("parent_id") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_e28288969fa7827bd12680cfe10" FOREIGN KEY ("status_id") REFERENCES "status_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_status_sets" ADD CONSTRAINT "FK_f3ca6851fd53ff904e9ce214681" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "project_status_sets" ADD CONSTRAINT "FK_968a062c0e1a4d13e351c522ba4" FOREIGN KEY ("status_set_id") REFERENCES "status_sets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_tag_sets" ADD CONSTRAINT "FK_cb354bb259bbd85f63d7e120eb8" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "project_tag_sets" ADD CONSTRAINT "FK_c558e4e6f9e753f369582865c4b" FOREIGN KEY ("tag_set_id") REFERENCES "tag_sets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_tags" ADD CONSTRAINT "FK_70515bc464901781ac60b82a1ea" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_tags" ADD CONSTRAINT "FK_f883135d033e1541f6a81972e7d" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_tags" DROP CONSTRAINT "FK_f883135d033e1541f6a81972e7d"`);
        await queryRunner.query(`ALTER TABLE "task_tags" DROP CONSTRAINT "FK_70515bc464901781ac60b82a1ea"`);
        await queryRunner.query(`ALTER TABLE "project_tag_sets" DROP CONSTRAINT "FK_c558e4e6f9e753f369582865c4b"`);
        await queryRunner.query(`ALTER TABLE "project_tag_sets" DROP CONSTRAINT "FK_cb354bb259bbd85f63d7e120eb8"`);
        await queryRunner.query(`ALTER TABLE "project_status_sets" DROP CONSTRAINT "FK_968a062c0e1a4d13e351c522ba4"`);
        await queryRunner.query(`ALTER TABLE "project_status_sets" DROP CONSTRAINT "FK_f3ca6851fd53ff904e9ce214681"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_e28288969fa7827bd12680cfe10"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_bd19ddcde86ca1882599dbace11"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_1b9d2591f78033221d6b7c726b6"`);
        await queryRunner.query(`ALTER TABLE "status_definitions" DROP CONSTRAINT "FK_7bb8172ef1f90ff91d0c86d23ba"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "legacy_tags"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "status_id"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "legacy_status"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_legacy_status_enum"`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "tags" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_status_enum" AS ENUM('open', 'in_progress', 'completed')`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'open'`);
        await queryRunner.query(`ALTER TABLE "client_migration" ADD "dependencies" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f883135d033e1541f6a81972e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70515bc464901781ac60b82a1e"`);
        await queryRunner.query(`DROP TABLE "task_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c558e4e6f9e753f369582865c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb354bb259bbd85f63d7e120eb"`);
        await queryRunner.query(`DROP TABLE "project_tag_sets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_968a062c0e1a4d13e351c522ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3ca6851fd53ff904e9ce21468"`);
        await queryRunner.query(`DROP TABLE "project_status_sets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6a012ebab7ea3ff10fa8f3c58"`);
        await queryRunner.query(`DROP TABLE "client_migration_status"`);
        await queryRunner.query(`DROP TYPE "public"."client_migration_status_status_enum"`);
        await queryRunner.query(`DROP TABLE "tag_sets"`);
        await queryRunner.query(`DROP TABLE "tags"`);
        await queryRunner.query(`DROP TABLE "status_sets"`);
        await queryRunner.query(`DROP TABLE "status_definitions"`);
        await queryRunner.query(`DROP TABLE "jwks"`);
        await queryRunner.query(`DROP TABLE "sync_metadata"`);
    }

}
