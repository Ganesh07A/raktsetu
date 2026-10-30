import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { donorProfiles } from './donor-profiles';
import { bloodRequests } from './blood-requests';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    phone: text('phone').notNull().unique(), // +91XXXXXXXXXX format
    name: text('name'),
    email: text('email'),
    role: text('role', { enum: ['seeker', 'donor', 'admin'] })
      .notNull()
      .default('seeker'),
    preferredLanguage: text('preferred_language', { enum: ['en', 'hi'] })
      .notNull()
      .default('en'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('users_phone_idx').on(table.phone),
    index('users_role_idx').on(table.role),
  ]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  donorProfile: one(donorProfiles, {
    fields: [users.id],
    references: [donorProfiles.userId],
  }),
  bloodRequests: many(bloodRequests),
}));

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
