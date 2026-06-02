-- CreateTable
CREATE TABLE "admins" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_bank_accounts" (
    "id" BIGSERIAL NOT NULL,
    "member_id" BIGINT NOT NULL,
    "bank_last5" VARCHAR(5) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "amount" INTEGER NOT NULL,
    "fortune_incense_deduct_qty" INTEGER NOT NULL DEFAULT 0,
    "jade_incense_deduct_qty" INTEGER NOT NULL DEFAULT 0,
    "gold_ingot_incense_deduct_qty" INTEGER NOT NULL DEFAULT 0,
    "cycle_count" INTEGER NOT NULL DEFAULT 1,
    "session_count" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_incense_stocks" (
    "id" BIGSERIAL NOT NULL,
    "member_id" BIGINT NOT NULL,
    "fortune_incense_qty" INTEGER NOT NULL DEFAULT 0,
    "jade_incense_qty" INTEGER NOT NULL DEFAULT 0,
    "gold_ingot_incense_qty" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_incense_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incense_stock_logs" (
    "id" BIGSERIAL NOT NULL,
    "member_id" BIGINT NOT NULL,
    "registration_id" BIGINT,
    "change_type" VARCHAR(24) NOT NULL,
    "fortune_incense_delta" INTEGER NOT NULL DEFAULT 0,
    "jade_incense_delta" INTEGER NOT NULL DEFAULT 0,
    "gold_ingot_incense_delta" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incense_stock_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remittance_records" (
    "id" BIGSERIAL NOT NULL,
    "remittance_last5" VARCHAR(5) NOT NULL,
    "matched_member_id" BIGINT,
    "remittance_date" DATE NOT NULL,
    "participation_date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "match_status" VARCHAR(32) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remittance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" BIGSERIAL NOT NULL,
    "member_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "participation_date" DATE NOT NULL,
    "payment_method" VARCHAR(32) NOT NULL,
    "expected_amount" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'registered',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_payments" (
    "id" BIGSERIAL NOT NULL,
    "registration_id" BIGINT NOT NULL,
    "remittance_record_id" BIGINT NOT NULL,
    "applied_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "members_name_idx" ON "members"("name");

-- CreateIndex
CREATE INDEX "member_bank_accounts_member_id_idx" ON "member_bank_accounts"("member_id");

-- CreateIndex
CREATE INDEX "member_bank_accounts_bank_last5_idx" ON "member_bank_accounts"("bank_last5");

-- CreateIndex
CREATE INDEX "plans_is_active_idx" ON "plans"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "member_incense_stocks_member_id_key" ON "member_incense_stocks"("member_id");

-- CreateIndex
CREATE INDEX "incense_stock_logs_member_id_idx" ON "incense_stock_logs"("member_id");

-- CreateIndex
CREATE INDEX "incense_stock_logs_registration_id_idx" ON "incense_stock_logs"("registration_id");

-- CreateIndex
CREATE INDEX "remittance_records_remittance_last5_idx" ON "remittance_records"("remittance_last5");

-- CreateIndex
CREATE INDEX "remittance_records_matched_member_id_idx" ON "remittance_records"("matched_member_id");

-- CreateIndex
CREATE INDEX "remittance_records_participation_date_idx" ON "remittance_records"("participation_date");

-- CreateIndex
CREATE INDEX "registrations_member_id_idx" ON "registrations"("member_id");

-- CreateIndex
CREATE INDEX "registrations_plan_id_idx" ON "registrations"("plan_id");

-- CreateIndex
CREATE INDEX "registrations_participation_date_idx" ON "registrations"("participation_date");

-- CreateIndex
CREATE INDEX "registration_payments_registration_id_idx" ON "registration_payments"("registration_id");

-- CreateIndex
CREATE INDEX "registration_payments_remittance_record_id_idx" ON "registration_payments"("remittance_record_id");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_bank_accounts" ADD CONSTRAINT "member_bank_accounts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_incense_stocks" ADD CONSTRAINT "member_incense_stocks_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incense_stock_logs" ADD CONSTRAINT "incense_stock_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incense_stock_logs" ADD CONSTRAINT "incense_stock_logs_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remittance_records" ADD CONSTRAINT "remittance_records_matched_member_id_fkey" FOREIGN KEY ("matched_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_payments" ADD CONSTRAINT "registration_payments_remittance_record_id_fkey" FOREIGN KEY ("remittance_record_id") REFERENCES "remittance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
