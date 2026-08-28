import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const intents = sqliteTable(
  "intents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    wallet: text("wallet").notNull(),
    target: text("target").notNull(),
    method: text("method").notNull(),
    title: text("title").notNull(),
    recordId: text("record_id").notNull().default(""),
    argsJson: text("args_json").notNull(),
    valueWei: text("value_wei").notNull(),
    operationKey: text("operation_key").notNull(),
    status: text("status").notNull(),
    hash: text("tx_hash"),
    error: text("error").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_intents_user_created").on(t.userId, t.createdAt),
    uniqueIndex("idx_intents_user_hash").on(t.userId, t.hash),
    uniqueIndex("idx_intents_active_operation")
      .on(t.userId, t.operationKey)
      .where(sql.raw("status IN ('reserved','submitted','review')")),
  ],
);
export const transactions = sqliteTable(
  "transactions",
  {
    hash: text("hash").primaryKey(),
    wallet: text("wallet").notNull(),
    target: text("target").notNull(),
    method: text("method").notNull(),
    argsJson: text("args_json").notNull().default("[]"),
    recordId: text("record_id").notNull().default(""),
    status: text("status").notNull(),
    execution: text("execution").notNull(),
    valueWei: text("value_wei").notNull(),
    payoutState: text("payout_state").notNull().default("none"),
    payoutJson: text("payout_json").notNull().default("{}"),
    resultJson: text("result_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    error: text("error").notNull().default(""),
  },
  (t) => [
    index("idx_transactions_wallet_created").on(t.wallet, t.createdAt),
    index("idx_transactions_record_created").on(t.recordId, t.createdAt),
    index("idx_transactions_payout_updated").on(t.payoutState, t.updatedAt),
  ],
);
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    json: text("json").notNull(),
    detailJson: text("detail_json"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    hidden: integer("hidden").notNull().default(0),
    moderationReason: text("moderation_reason").notNull().default(""),
  },
  (t) => [
    index("idx_records_status_created").on(t.status, t.createdAt),
    index("idx_records_created").on(t.createdAt),
  ],
);
export const members = sqliteTable(
  "members",
  {
    recordId: text("record_id").notNull(),
    wallet: text("wallet").notNull(),
    role: text("role").notNull(),
    json: text("json").notNull().default("{}"),
  },
  (t) => [
    primaryKey({ columns: [t.recordId, t.wallet] }),
    index("idx_members_wallet").on(t.wallet),
  ],
);
export const observations = sqliteTable(
  "observations",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    at: integer("at").notNull(),
    status: text("status").notNull(),
    json: text("json").notNull(),
  },
  (t) => [index("idx_observations_record_at").on(t.recordId, t.at)],
);
export const preferences = sqliteTable("preferences", {
  userId: text("user_id").primaryKey(),
  json: text("json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const support = sqliteTable(
  "support",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    category: text("category").notNull(),
    recordId: text("record_id").notNull().default(""),
    hash: text("tx_hash").notNull().default(""),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    response: text("response").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_support_user_created").on(t.userId, t.createdAt),
    index("idx_support_status_created").on(t.status, t.createdAt),
  ],
);
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  address: text("address").notNull(),
  message: text("message").notNull(),
  expiresAt: integer("expires_at").notNull(),
  used: integer("used").notNull().default(0),
});
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  address: text("address").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const readCache = sqliteTable("read_cache", {
  key: text("key").primaryKey(),
  json: text("json").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const systemState = sqliteTable("system_state", {
  key: text("key").primaryKey(),
  json: text("json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const rateBuckets = sqliteTable("rate_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
