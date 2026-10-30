import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodRequests } from './blood-requests';
import { donorProfiles } from './donor-profiles';

export const donorNotifications = pgTable(
  'donor_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .references(() => bloodRequests.id, { onDelete: 'cascade' })
      .notNull(),
    donorId: uuid('donor_id')
      .references(() => donorProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    whatsappMessageId: text('whatsapp_message_id'),
    status: text('status', {
      enum: [
        'pending',
        'sent',
        'delivered',
        'read',
        'accepted',
        'declined',
        'expired',
        'failed',
      ],
    })
      .notNull()
      .default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    responseNote: text('response_note'),
  },
  (table) => [
    index('notifications_request_status_idx').on(
      table.requestId,
      table.status
    ),
    index('notifications_donor_idx').on(table.donorId),
    index('notifications_whatsapp_id_idx').on(table.whatsappMessageId),
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
