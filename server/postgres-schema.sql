CREATE TABLE "challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"message" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"used" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet" text NOT NULL,
	"target" text NOT NULL,
	"method" text NOT NULL,
	"title" text NOT NULL,
	"record_id" text DEFAULT '' NOT NULL,
	"args_json" text NOT NULL,
	"value_wei" text NOT NULL,
	"operation_key" text NOT NULL,
	"status" text NOT NULL,
	"tx_hash" text,
	"error" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_intents_user_created" ON "intents" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_intents_user_hash" ON "intents" ("user_id","tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_intents_active_operation" ON "intents" ("user_id","operation_key") WHERE status IN ('reserved','submitted','review');--> statement-breakpoint
CREATE TABLE "members" (
	"record_id" text NOT NULL,
	"wallet" text NOT NULL,
	"role" text NOT NULL,
	"json" text DEFAULT '{}' NOT NULL,
	PRIMARY KEY("record_id", "wallet")
);
--> statement-breakpoint
CREATE INDEX "idx_members_wallet" ON "members" ("wallet");--> statement-breakpoint
CREATE TABLE "observations" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"at" bigint NOT NULL,
	"status" text NOT NULL,
	"json" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_observations_record_at" ON "observations" ("record_id","at");--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"json" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "read_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"json" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"json" text NOT NULL,
	"detail_json" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"hidden" bigint DEFAULT 0 NOT NULL,
	"moderation_reason" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_records_status_created" ON "records" ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_records_created" ON "records" ("created_at");--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"record_id" text DEFAULT '' NOT NULL,
	"tx_hash" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_support_user_created" ON "support" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_status_created" ON "support" ("status","created_at");--> statement-breakpoint
CREATE TABLE "system_state" (
	"key" text PRIMARY KEY NOT NULL,
	"json" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"hash" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"target" text NOT NULL,
	"method" text NOT NULL,
	"record_id" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"execution" text NOT NULL,
	"value_wei" text NOT NULL,
	"payout_state" text DEFAULT 'none' NOT NULL,
	"payout_json" text DEFAULT '{}' NOT NULL,
	"result_json" text DEFAULT '{}' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"error" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_transactions_wallet_created" ON "transactions" ("wallet","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_record_created" ON "transactions" ("record_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_payout_updated" ON "transactions" ("payout_state","updated_at");
--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS args_json text DEFAULT '[]' NOT NULL;
