import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateTelegramImport1781308800000 implements MigrationInterface {
  name = 'CreateTelegramImport1781308800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "telegram_links" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "telegram_user_id" bigint NOT NULL,
      "telegram_username" character varying,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_telegram_links" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_telegram_links_user" UNIQUE ("user_id"),
      CONSTRAINT "UQ_telegram_links_tg_user" UNIQUE ("telegram_user_id"))`);
    await queryRunner.query(`ALTER TABLE "telegram_links" ADD CONSTRAINT "FK_telegram_links_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);

    await queryRunner.query(`CREATE TABLE "telegram_link_tokens" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "token" character varying NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "used_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_telegram_link_tokens" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_telegram_link_tokens_token" UNIQUE ("token"))`);
    await queryRunner.query(`ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "FK_telegram_link_tokens_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);

    await queryRunner.query(`CREATE TABLE "imported_transactions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "raw_text" text NOT NULL,
      "type" character varying NOT NULL,
      "amount" numeric(18,2),
      "currency" character varying NOT NULL DEFAULT 'UZS',
      "merchant" character varying,
      "card_mask" character varying,
      "occurred_at" TIMESTAMP WITH TIME ZONE,
      "balance_after" numeric(18,2),
      "dedup_hash" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'pending',
      "transaction_id" uuid,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_imported_transactions" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "imported_transactions" ADD CONSTRAINT "FK_imported_transactions_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_imported_transactions_user_dedup"
      ON "imported_transactions" ("user_id", "dedup_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_imported_transactions_user_status"
      ON "imported_transactions" ("user_id", "status")`);

    await queryRunner.query(`CREATE TABLE "card_account_mappings" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "card_mask" character varying NOT NULL,
      "account_id" uuid NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_card_account_mappings" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "card_account_mappings" ADD CONSTRAINT "FK_card_account_mappings_profiles"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "card_account_mappings" ADD CONSTRAINT "FK_card_account_mappings_accounts"
      FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_account_mappings_user_card"
      ON "card_account_mappings" ("user_id", "card_mask")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "card_account_mappings"`);
    await queryRunner.query(`DROP TABLE "imported_transactions"`);
    await queryRunner.query(`DROP TABLE "telegram_link_tokens"`);
    await queryRunner.query(`DROP TABLE "telegram_links"`);
  }
}
