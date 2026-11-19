import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { donorProfiles } from './donor-profiles';
import { bloodRequests } from './blood-requests';

/**
 * Links a donor's profile with their Telegram chat identity
 */
export const donorTelegramSubscriptions = pgTable(
  'donor_telegram_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    donorId: text('donor_id')
      .references(() => donorProfiles.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    telegramChatId: text('telegram_chat_id').notNull().unique(),
    telegramUserId: text('telegram_user_id'),
    telegramUsername: text('telegram_username'),
    alertsEnabled: boolean('alerts_enabled').default(true).notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('donor_tg_chat_id_idx').on(table.telegramChatId),
    index('donor_tg_donor_id_idx').on(table.donorId),
  ]
);

/**
 * Ephemeral, single-use linking tokens for deep linking: https://t.me/Bot?start=<raw_token>
 * Security: We only store SHA-256 token_hash in the database, never the plaintext token.
 */
export const telegramLinkTokens = pgTable(
  'telegram_link_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    donorId: text('donor_id')
      .references(() => donorProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tg_link_tokens_donor_idx').on(table.donorId),
    index('tg_link_tokens_expires_idx').on(table.expiresAt),
  ]
);

/**
 * Tracks Telegram request notifications and maps compact callback IDs (<=64 bytes)
 * Status includes 'sending' and 'unknown' to handle delivery ambiguity safely without duplicate alerts.
 */
export const telegramNotifications = pgTable(
  'telegram_notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .references(() => bloodRequests.id, { onDelete: 'cascade' })
      .notNull(),
    donorId: text('donor_id')
      .references(() => donorProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    telegramMessageId: integer('telegram_message_id'),
    callbackId: text('callback_id').notNull().unique(),
    status: text('status', {
      enum: ['pending', 'sending', 'sent', 'unknown', 'delivered', 'failed', 'accepted', 'declined', 'cancelled'],
    })
      .default('pending')
      .notNull(),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tg_notif_req_donor_idx').on(table.requestId, table.donorId),
    index('tg_notif_callback_idx').on(table.callbackId),
    index('tg_notif_chat_msg_idx').on(table.telegramChatId, table.telegramMessageId),
  ]
);

export const donorTelegramSubscriptionsRelations = relations(
  donorTelegramSubscriptions,
  ({ one }) => ({
    donor: one(donorProfiles, {
      fields: [donorTelegramSubscriptions.donorId],
      references: [donorProfiles.id],
    }),
  })
);

export type DonorTelegramSubscriptionRow = typeof donorTelegramSubscriptions.$inferSelect;
export type NewDonorTelegramSubscriptionRow = typeof donorTelegramSubscriptions.$inferInsert;
export type TelegramLinkTokenRow = typeof telegramLinkTokens.$inferSelect;
export type TelegramNotificationRow = typeof telegramNotifications.$inferSelect;
