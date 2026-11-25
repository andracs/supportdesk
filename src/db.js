import mongoose from 'mongoose';

// ---------- Statusflow: open -> in_progress -> closed ----------
export const ALLOWED_TRANSITIONS = {
  open: ['in_progress'],
  in_progress: ['closed'],
  closed: [], // en afsluttet sag er endelig
};

export function isValidTransition(fromStatus, toStatus) {
  return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

const STATUS_OPTIONS = ['open', 'in_progress', 'closed'];

export const isStatus = (value) => STATUS_OPTIONS.includes(value);

// ---------- db-forbindelse ----------
export async function connectDb(uri) {
  const mongodbUri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/supportdesk';
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongodbUri);
  console.log(`MongoDB forbundet: ${mongoose.connection.host}`);
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/**
 * Memoizeret initialisering: forbinder databasen ved første API-kald
 * og fylder demo-data i en tom database (mindst tre sager, jvf. krav 1).
 *
 * Uden MONGO_URI startes en MongoDB i hukommelsen (mongodb-memory-server)
 * – praktisk til test, demo og udvikling. I drift sættes MONGO_URI til
 * en rigtig MongoDB, og så bruges den.
 */
let initPromise = null;

export function ensureConnected() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let uri = process.env.MONGO_URI;
    if (!uri) {
      const { seedIfEmpty } = await import('./seed.js');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      uri = process.env.MONGO_URI = mongod.getUri('supportdesk');
      console.log(`(Ingen MONGO_URI – bruger MongoDB i hukommelsen: ${uri})`);
      await connectDb(uri);
      await seedIfEmpty();
      return;
    }
    await connectDb(uri);
    const { seedIfEmpty } = await import('./seed.js');
    await seedIfEmpty();
  })();

  return initPromise;
}
