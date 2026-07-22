import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { JobKind, JobRecordStatus } from "@naija-brief/shared";

// A durable record of one unit of background work. The pipeline is split so the
// expensive-to-lose audio step can be retried on its own: a "generate" job
// fetches + summarizes + saves the text brief, then enqueues a "tts" job that
// synthesizes audio and attaches it — so a voice failure never re-pays for the
// LLM work.
@Entity("generation_jobs")
// The claim query filters on status and the backoff not-before time.
@Index(["status", "nextRunAt"])
// At most one *active* (queued or running) job per (kind, date). This is what
// stops the daily cron from double-enqueuing and blocks duplicate work — the DB
// enforces single-flight even across a restart racing the cron.
@Index("uq_active_generation_job", ["kind", "date"], {
  unique: true,
  where: "status IN ('queued', 'running')",
})
export class GenerationJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  kind!: JobKind;

  @Column({ type: "varchar", default: "queued" })
  status!: JobRecordStatus;

  /** The brief date this job targets (YYYY-MM-DD, Africa/Lagos). */
  @Column({ type: "varchar", length: 10 })
  date!: string;

  /** Latest progress line, surfaced through GET /status. */
  @Column({ type: "text", default: "" })
  step!: string;

  @Column({ type: "text", nullable: true })
  error!: string | null;

  /** Incremented each time the job is claimed; bounds the retry loop. */
  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "int", default: 3 })
  maxAttempts!: number;

  /** Backoff "not before": a retried job stays queued until this passes. */
  @Column({ type: "timestamptz", nullable: true })
  nextRunAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  finishedAt!: Date | null;
}
