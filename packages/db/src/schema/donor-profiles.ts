import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  date,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { donorNotifications } from './donor-notifications';

export const donorProfiles = pgTable(
  'donor_profiles',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    bloodGroup: text('blood_group', {
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    state: text('state').notNull(),
    district: text('district').notNull(),
    city: text('city'),
    dateOfBirth: date('date_of_birth'),
    gender: text('gender', { enum: ['male', 'female', 'other'] }),
    weightKg: doublePrecision('weight_kg'),
    lastDonationDate: date('last_donation_date'),
    isAvailable: boolean('is_available').default(true).notNull(),
    searchRadiusKm: integer('search_radius_km').default(10).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('donor_blood_available_idx').on(
      table.bloodGroup,
      table.isAvailable
    ),
    index('donor_location_idx').on(table.latitude, table.longitude),
    index('donor_state_district_idx').on(table.state, table.district),
  ]
);

export const donorProfilesRelations = relations(donorProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [donorProfiles.userId],
    references: [users.id],
  }),
  notifications: many(donorNotifications),
}));

export type DonorProfileRow = typeof donorProfiles.$inferSelect;
export type NewDonorProfileRow = typeof donorProfiles.$inferInsert;
