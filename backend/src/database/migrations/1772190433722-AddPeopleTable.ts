import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddPeopleTable1772190433722 implements MigrationInterface {
  name = 'AddPeopleTable1772190433722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "people" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "color" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aa866e71353ee94c6cc51059c5b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_people_user_id" ON "people" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_people_user_id"`);
    await queryRunner.query(`DROP TABLE "people"`);
  }
}
