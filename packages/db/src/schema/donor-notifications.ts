import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodRequests } from './blood-requests';
import { donorProfiles } from './donor-profiles';

export const donorNotifications = pgTable(
  'donor_notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .references(() => bloodRequests.id, { onDelete: 'cascade' })
      .notNull(),
    donorId: text('donor_id')
      .references(() => donorProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    pushMessageId: text('push_message_id'),
    status: text('status', {
      enum: [
        'pending',
        'processing',
        'sent',
        'delivered',
        'read',
        'accepted',
        'declined',
        'expired',
        'failed',
        'exhausted',
        'cancelled',
      ],
    })
      .notNull()
      .default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    responseNote: text('response_note'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }).defaultNow(),
    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    leaseToken: text('lease_token'),
    errorDetails: text('error_details'),
  },
  (table) => [
    index('notifications_request_status_idx').on(
      table.requestId,
      table.status
    ),
    index('notifications_donor_idx').on(table.donorId),
    index('notifications_push_id_idx').on(table.pushMessageId),
    index('notifications_outbox_queue_idx').on(table.status, table.nextRetryAt),
    index('notifications_lease_token_idx').on(table.leaseToken),
  ]
);

export const donorNotificationsRelations = relations(
  donorNotifications,
  ({ one }) => ({
    request: one(bloodRequests, {
      fields: [donorNotifications.requestId],
      references: [bloodRequests.id],
    }),
    donor: one(donorProfiles, {
      fields: [donorNotifications.donorId],
      references: [donorProfiles.id],
    }),
  })
);

export type DonorNotificationRow = typeof donorNotifications.$inferSelect;
export type NewDonorNotificationRow = typeof donorNotifications.$inferInsert;
