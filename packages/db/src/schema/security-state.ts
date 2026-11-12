import { pgTable, text, timestamp, integer, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    requesterId: text('requester_id'),
    operation: text('operation').notNull(),
    responsePayload: jsonb('response_payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ]
);

export const otpSessions = pgTable(
  'otp_sessions',
  {
    phone: text('phone').notNull(),
    purpose: text('purpose').notNull(),
    hashedOtp: text('hashed_otp').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.phone, table.purpose] }),
    index('otp_sessions_expires_at_idx').on(table.expiresAt),
  ]
);

export const consumedTicketNonces = pgTable(
  'consumed_ticket_nonces',
  {
    nonce: text('nonce').primaryKey(),
    phone: text('phone').notNull(),
    purpose: text('purpose').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('consumed_ticket_nonces_phone_idx').on(table.phone),
    index('consumed_ticket_nonces_expires_at_idx').on(table.expiresAt),
  ]
);

export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    key: text('key').primaryKey(),
    points: integer('points').default(1).notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('rate_limit_counters_reset_at_idx').on(table.resetAt),
  ]
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKeyRow = typeof idempotencyKeys.$inferInsert;
export type OtpSessionRow = typeof otpSessions.$inferSelect;
export type NewOtpSessionRow = typeof otpSessions.$inferInsert;
export type ConsumedTicketNonceRow = typeof consumedTicketNonces.$inferSelect;
export type NewConsumedTicketNonceRow = typeof consumedTicketNonces.$inferInsert;
export type RateLimitCounterRow = typeof rateLimitCounters.$inferSelect;
export type NewRateLimitCounterRow = typeof rateLimitCounters.$inferInsert;
