import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { donorNotifications } from './donor-notifications';

export const bloodRequests = pgTable(
  'blood_requests',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    requesterId: text('requester_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    bloodGroupNeeded: text('blood_group_needed', {
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    }).notNull(),
    componentType: text('component_type', {
      enum: ['whole_blood', 'prbc', 'ffp', 'platelets'],
    })
      .default('whole_blood')
      .notNull(),
    unitsNeeded: integer('units_needed').default(1).notNull(),
    patientName: text('patient_name').notNull(),
    patientAge: integer('patient_age'),
    emergencyType: text('emergency_type', {
      enum: [
        'surgery',
        'accident',
        'thalassemia',
        'delivery',
        'dengue',
        'other',
      ],
    }),
    hospitalName: text('hospital_name').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    state: text('state'),
    district: text('district'),
    searchRadiusKm: integer('search_radius_km').default(10).notNull(),
    status: text('status', {
      enum: [
        'searching',
        'bank_found',
        'donors_notified',
        'fulfilled',
        'expired',
        'cancelled',
      ],
    })
      .notNull()
      .default('searching'),
    fulfillmentSource: text('fulfillment_source', {
      enum: ['blood_bank', 'donor'],
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('requests_status_group_idx').on(
      table.status,
      table.bloodGroupNeeded
    ),
    index('requests_location_idx').on(table.latitude, table.longitude),
    index('requests_requester_idx').on(table.requesterId),
  ]
);

export const bloodRequestsRelations = relations(
  bloodRequests,
  ({ one, many }) => ({
    requester: one(users, {
      fields: [bloodRequests.requesterId],
      references: [users.id],
    }),
    notifications: many(donorNotifications),
  })
);

export type BloodRequestRow = typeof bloodRequests.$inferSelect;
export type NewBloodRequestRow = typeof bloodRequests.$inferInsert;
