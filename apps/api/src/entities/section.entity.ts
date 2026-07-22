import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BriefEntity } from "./brief.entity";
import { StoryEntity } from "./story.entity";

@Entity("sections")
export class SectionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @ManyToOne(() => BriefEntity, (brief) => brief.sections, {
    onDelete: "CASCADE",
  })
  brief!: BriefEntity;

  /** Stable section key, e.g. "politics". */
  @Column({ type: "varchar" })
  sectionKey!: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", default: "" })
  script!: string;

  /** Display order within the brief. */
  @Column({ type: "int" })
  position!: number;

  @OneToMany(() => StoryEntity, (story) => story.section, {
    cascade: true,
    eager: true,
  })
  stories!: StoryEntity[];
}
