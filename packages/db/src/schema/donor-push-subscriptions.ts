import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { donorProfiles } from './donor-profiles';

export const donorPushSubscriptions = pgTable(
  'donor_push_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    donorId: text('donor_id').references(() => donorProfiles.id, { onDelete: 'cascade' }).notNull(),
    fcmToken: text('fcm_token').notNull(),
    platform: text('platform').notNull().default('web'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('donor_push_subscriptions_donor_idx').on(table.donorId),
    uniqueIndex('donor_push_subscriptions_token_uidx').on(table.fcmToken),
  ]
);

export const donorPushSubscriptionsRelations = relations(donorPushSubscriptions, ({ one }) => ({
  donor: one(donorProfiles, {
    fields: [donorPushSubscriptions.donorId],
    references: [donorProfiles.id],
  }),
}));

export type DonorPushSubscriptionRow = typeof donorPushSubscriptions.$inferSelect;
export type NewDonorPushSubscriptionRow = typeof donorPushSubscriptions.$inferInsert;
