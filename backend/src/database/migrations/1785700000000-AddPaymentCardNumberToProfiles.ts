import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddPaymentCardNumberToProfiles1785700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "payment_card_number" character varying(19)`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "chk_profile_payment_card_number" CHECK ("payment_card_number" ~ '^[0-9]{12,19}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP CONSTRAINT "chk_profile_payment_card_number"`,
    );
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "payment_card_number"`);
  }
}
