import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import type {
  AudioMarker,
  SectionFailure,
  SourceFailure,
} from "@naija-brief/shared";
import { SectionEntity } from "./section.entity";

@Entity("briefs")
export class BriefEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** YYYY-MM-DD in Africa/Lagos. One brief per day. */
  @Index({ unique: true })
  @Column({ type: "varchar", length: 10 })
  date!: string;

  @Column({ type: "varchar" })
  dateLabel!: string;

  @Column({ type: "timestamptz" })
  generatedAt!: Date;

  @Column({ type: "text", default: "" })
  intro!: string;

  @Column({ type: "text", default: "" })
  outro!: string;

  @Column({ type: "int", nullable: true })
  audioDurationSec!: number | null;

  @Column({ type: "jsonb", nullable: true })
  audioMarkers!: AudioMarker[] | null;

  @Column({ type: "varchar", nullable: true })
  audioMime!: string | null;

  // The rendered WAV. Never selected implicitly — it can be several MB — so a
  // plain findBrief() stays cheap; the audio endpoint loads it explicitly.
  @Column({ type: "bytea", nullable: true, select: false })
  audioData!: Buffer | null;

  @Column({ type: "text", nullable: true })
  audioError!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  sourcesFailed!: SourceFailure[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  sectionsFailed!: SectionFailure[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @OneToMany(() => SectionEntity, (section) => section.brief, {
    cascade: true,
    eager: true,
  })
  sections!: SectionEntity[];
}
