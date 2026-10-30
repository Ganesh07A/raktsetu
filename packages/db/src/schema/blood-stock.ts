import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodBanks } from './blood-banks';

export const bloodStock = pgTable(
  'blood_stock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id')
      .references(() => bloodBanks.id, { onDelete: 'cascade' })
      .notNull(),
    bloodGroup: text('blood_group', {
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    }).notNull(),
    componentType: text('component_type', {
      enum: ['whole_blood', 'prbc', 'ffp', 'platelets'],
    })
      .default('whole_blood')
      .notNull(),
    unitsAvailable: integer('units_available').default(0).notNull(),
    earliestExpiry: date('earliest_expiry'),
    lastUpdated: timestamp('last_updated', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('stock_bank_group_idx').on(
      table.bankId,
      table.bloodGroup,
      table.componentType
    ),
    index('stock_group_units_idx').on(table.bloodGroup, table.unitsAvailable),
  ]
);

export const bloodStockRelations = relations(bloodStock, ({ one }) => ({
  bank: one(bloodBanks, {
    fields: [bloodStock.bankId],
    references: [bloodBanks.id],
  }),
}));

export type BloodStockRow = typeof bloodStock.$inferSelect;
export type NewBloodStockRow = typeof bloodStock.$inferInsert;
