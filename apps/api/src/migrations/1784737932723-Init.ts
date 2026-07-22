import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1784737932723 implements MigrationInterface {
    name = 'Init1784737932723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // uuid PK defaults use uuid_generate_v4(); ensure the extension exists on
        // a fresh database (a no-op where it is already installed).
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "briefs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" character varying(10) NOT NULL, "dateLabel" character varying NOT NULL, "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "intro" text NOT NULL DEFAULT '', "outro" text NOT NULL DEFAULT '', "audioDurationSec" integer, "audioMarkers" jsonb, "audioMime" character varying, "audioData" bytea, "audioError" text, "sourcesFailed" jsonb NOT NULL DEFAULT '[]', "sectionsFailed" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1e3944bfaf5baf0f14b0bc892b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_55b76ede3aa0f258f2b406b13a" ON "briefs" ("date") `);
        await queryRunner.query(`CREATE TABLE "sections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sectionKey" character varying NOT NULL, "title" character varying NOT NULL, "script" text NOT NULL DEFAULT '', "position" integer NOT NULL, "briefId" uuid, CONSTRAINT "PK_f9749dd3bffd880a497d007e450" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_acc39d226cec514bcb017f4976" ON "sections" ("briefId") `);
        await queryRunner.query(`CREATE TABLE "stories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storyKey" character varying NOT NULL, "headline" text NOT NULL, "summary" text NOT NULL DEFAULT '', "source" character varying NOT NULL, "link" text NOT NULL DEFAULT '', "publishedAt" TIMESTAMP WITH TIME ZONE, "content" text NOT NULL DEFAULT '', "position" integer NOT NULL, "sectionId" uuid, CONSTRAINT "PK_bb6f880b260ed96c452b32a39f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_93e2f77c24893dd212a2f58ff5" ON "stories" ("sectionId") `);
        await queryRunner.query(`CREATE TABLE "generation_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'queued', "date" character varying(10) NOT NULL, "step" text NOT NULL DEFAULT '', "error" text, "attempts" integer NOT NULL DEFAULT '0', "maxAttempts" integer NOT NULL DEFAULT '3', "nextRunAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6b6b705e0fed45c8440c1d7d637" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_active_generation_job" ON "generation_jobs" ("kind", "date") WHERE status IN ('queued', 'running')`);
        await queryRunner.query(`CREATE INDEX "IDX_6ff510b49fe16fa476c0cd382b" ON "generation_jobs" ("status", "nextRunAt") `);
        await queryRunner.query(`ALTER TABLE "sections" ADD CONSTRAINT "FK_acc39d226cec514bcb017f49763" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stories" ADD CONSTRAINT "FK_93e2f77c24893dd212a2f58ff53" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stories" DROP CONSTRAINT "FK_93e2f77c24893dd212a2f58ff53"`);
        await queryRunner.query(`ALTER TABLE "sections" DROP CONSTRAINT "FK_acc39d226cec514bcb017f49763"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ff510b49fe16fa476c0cd382b"`);
        await queryRunner.query(`DROP INDEX "public"."uq_active_generation_job"`);
        await queryRunner.query(`DROP TABLE "generation_jobs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_93e2f77c24893dd212a2f58ff5"`);
        await queryRunner.query(`DROP TABLE "stories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_acc39d226cec514bcb017f4976"`);
        await queryRunner.query(`DROP TABLE "sections"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_55b76ede3aa0f258f2b406b13a"`);
        await queryRunner.query(`DROP TABLE "briefs"`);
    }

}
