import { db } from './index';
import {
  users,
  donorProfiles,
  bloodBanks,
  bloodStock,
} from './schema/index';
import {
  SEED_USERS,
  SEED_DONORS,
  SEED_BLOOD_BANKS,
} from './seed-data';

export async function seedDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('[@repo/db] DATABASE_URL not set; skipping live Postgres seeding.');
    return { seeded: false, reason: 'NO_DATABASE_URL' };
  }

  console.log('[@repo/db] Seeding database with realistic Indian healthcare data...');

  try {
    // 1. Seed users
    for (const u of SEED_USERS) {
      await db
        .insert(users)
        .values({
          id: u.id,
          phone: u.phone,
          name: u.name,
          email: u.email,
          role: u.role,
          preferredLanguage: u.preferredLanguage,
        })
        .onConflictDoNothing();
    }

    // 2. Seed donor profiles
    for (const d of SEED_DONORS) {
      await db
        .insert(donorProfiles)
        .values({
          // Keep deterministic IDs so seeded records retain stable references.
          id: d.id,
          userId: d.userId,
          bloodGroup: d.bloodGroup,
          latitude: d.latitude,
          longitude: d.longitude,
          state: d.state,
          district: d.district,
          city: d.city,
          dateOfBirth: d.dateOfBirth,
          gender: d.gender,
          weightKg: d.weightKg,
          lastDonationDate: d.lastDonationDate,
          isAvailable: d.isAvailable,
          searchRadiusKm: d.searchRadiusKm,
        })
        .onConflictDoNothing();
    }

    // 3. Seed blood banks and their stock
    for (const b of SEED_BLOOD_BANKS) {
      await db
        .insert(bloodBanks)
        .values({
          id: b.id,
          name: b.name,
          licenseNumber: b.licenseNumber,
          state: b.state,
          district: b.district,
          city: b.city,
          address: b.address,
          phone: b.phone,
          email: b.email,
          latitude: b.latitude,
          longitude: b.longitude,
          source: b.source,
          isVerified: b.isVerified,
          lastStockUpdate: new Date(b.lastStockUpdate),
        })
        .onConflictDoNothing();

      for (const s of b.stock) {
        await db
          .insert(bloodStock)
          .values({
            bankId: b.id,
            bloodGroup: s.bloodGroup,
            componentType: s.componentType,
            unitsAvailable: s.unitsAvailable,
            lastUpdated: new Date(b.lastStockUpdate),
          })
          .onConflictDoNothing();
      }
    }

    console.log('[@repo/db] Database seed completed successfully.');
    return {
      seeded: true,
      usersCount: SEED_USERS.length,
      donorsCount: SEED_DONORS.length,
      banksCount: SEED_BLOOD_BANKS.length,
    };
  } catch (err) {
    console.error('[@repo/db] Error seeding database:', err);
    throw err;
  }
}

// Allow direct CLI execution: bun run src/seed.ts
if (import.meta.main) {
  seedDatabase()
    .then((res) => {
      console.log('Seed result:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
