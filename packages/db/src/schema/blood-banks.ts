import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodStock } from './blood-stock';

export const bloodBanks = pgTable(
  'blood_banks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    licenseNumber: text('license_number'),
    state: text('state').notNull(),
    district: text('district').notNull(),
    city: text('city'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    source: text('source', {
      enum: ['eraktkosh', 'manual', 'partner'],
    })
      .default('manual')
      .notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    lastStockUpdate: timestamp('last_stock_update', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('blood_banks_state_district_idx').on(table.state, table.district),
    index('blood_banks_location_idx').on(table.latitude, table.longitude),
    index('blood_banks_source_idx').on(table.source),
  ]
);

export const bloodBanksRelations = relations(bloodBanks, ({ many }) => ({
  stock: many(bloodStock),
}));

export type BloodBankRow = typeof bloodBanks.$inferSelect;
export type NewBloodBankRow = typeof bloodBanks.$inferInsert;
