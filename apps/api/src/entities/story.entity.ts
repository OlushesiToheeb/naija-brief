import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SectionEntity } from "./section.entity";

@Entity("stories")
export class StoryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @ManyToOne(() => SectionEntity, (section) => section.stories, {
    onDelete: "CASCADE",
  })
  section!: SectionEntity;

  /** Stable per-brief story key, e.g. "politics-1" — used by the chat endpoint. */
  @Column({ type: "varchar" })
  storyKey!: string;

  @Column({ type: "text" })
  headline!: string;

  @Column({ type: "text", default: "" })
  summary!: string;

  @Column({ type: "varchar" })
  source!: string;

  @Column({ type: "text", default: "" })
  link!: string;

  @Column({ type: "timestamptz", nullable: true })
  publishedAt!: Date | null;

  /** Full article text used to ground the drill-down chat. */
  @Column({ type: "text", default: "" })
  content!: string;

  @Column({ type: "int" })
  position!: number;
}
