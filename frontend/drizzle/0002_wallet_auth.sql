CREATE TABLE `wallet_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`browser_hash` text NOT NULL,
	`address` text NOT NULL,
	`origin` text NOT NULL,
	`message` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wallet_challenges_expiry` ON `wallet_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `wallet_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`address` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wallet_sessions_expiry` ON `wallet_sessions` (`expires_at`);