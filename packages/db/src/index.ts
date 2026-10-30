import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL;

let client: postgres.Sql;
let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (connectionString) {
  client = postgres(connectionString, { max: 10, idle_timeout: 20 });
  dbInstance = drizzle(client, { schema });
} else {
  // Graceful fallback for offline / build / CI environments without DATABASE_URL
  const offlineProxy = new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return (..._args: unknown[]) => {
        console.warn(
          `[@repo/db] Warning: DATABASE_URL is not configured. Invoked '${String(
            prop
          )}' on offline database client.`
        );
        return Promise.resolve([]);
      };
    },
  });

  client = offlineProxy as unknown as postgres.Sql;
  try {
    dbInstance = drizzle(client, { schema });
  } catch {
    dbInstance = offlineProxy as unknown as ReturnType<
      typeof drizzle<typeof schema>
    >;
  }
}

export const db = dbInstance;
export type Database = typeof db;
export * from './schema/index';
export * from './seed-data';
export { eq, and, or, desc, asc, sql } from 'drizzle-orm';
