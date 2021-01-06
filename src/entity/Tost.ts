import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn } from "typeorm";

@Entity()
export class Tost {
  @PrimaryColumn({ unique: true })
  id: string;

  @Column()
  title: string;

  @Column()
  date: string;

  @Column("boolean", { default: false })
  imgDownloaded: boolean;
}
