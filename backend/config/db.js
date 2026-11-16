import { MongoClient, GridFSBucket } from 'mongodb';
import {
  SEED_USERS,
  SEED_COMPANIES,
  SEED_JOBS,
  SEED_APPLICATIONS,
  SEED_ALERTS,
  SEED_REVIEWS,
  SEED_ARTICLES,
  SEED_FORUMS,
  SEED_MODERATION_LOGS
} from '../data/seedData.js';

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/portal_trabajo';
export const DB_NAME = process.env.MONGODB_DB || 'portal_trabajo';

let mongoClient = null;
let mongoDbInstance = null;
let isMongoConnected = false;
let lastConnectionError = null;

/**
 * Conexión exclusiva a la instancia real de MongoDB
 * No utiliza almacenamiento en memoria, archivos JSON ni emuladores.
 */
export async function connectDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });

    await mongoClient.connect();
    mongoDbInstance = mongoClient.db(DB_NAME);
    isMongoConnected = true;
    lastConnectionError = null;

    console.log(`[MONGODB] Conexión establecida con éxito a ${MONGODB_URI}`);
    console.log(`[MONGODB] Base de datos seleccionada: "${DB_NAME}"`);

    // Inicializar colecciones e índices si la base de datos está vacía
    await initializeDatabase(mongoDbInstance);

    return mongoDbInstance;
  } catch (err) {
    isMongoConnected = false;
    mongoDbInstance = null;
    lastConnectionError = err.message;
    console.error(`[MONGODB ERROR] No se pudo conectar a MongoDB en ${MONGODB_URI}: ${err.message}`);
    throw err;
  }
}

/**
 * Inicialización real de colecciones e índices en MongoDB
 */
async function initializeDatabase(db) {
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  // 1. Colección users
  if (!collectionNames.includes('users') || (await db.collection('users').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "users" con datos semilla...');
    await db.collection('users').insertMany(SEED_USERS);
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
  }

  // 2. Colección companies
  if (!collectionNames.includes('companies') || (await db.collection('companies').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "companies" con datos semilla...');
    await db.collection('companies').insertMany(SEED_COMPANIES);
    await db.collection('companies').createIndex({ name: 1 });
  }

  // 3. Colección jobs
  if (!collectionNames.includes('jobs') || (await db.collection('jobs').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "jobs" con datos semilla...');
    await db.collection('jobs').insertMany(SEED_JOBS);
    await db.collection('jobs').createIndex({ companyId: 1, status: 1 });
    await db.collection('jobs').createIndex({ modality: 1 });
    await db.collection('jobs').createIndex({ contractType: 1 });
  }

  // 4. Colección applications
  if (!collectionNames.includes('applications') || (await db.collection('applications').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "applications" con datos semilla...');
    await db.collection('applications').insertMany(SEED_APPLICATIONS);
    await db.collection('applications').createIndex({ jobId: 1, candidateId: 1 }, { unique: true });
    await db.collection('applications').createIndex({ candidateId: 1 });
    await db.collection('applications').createIndex({ companyId: 1 });
  }

  // 5. Colección alerts
  if (!collectionNames.includes('alerts') || (await db.collection('alerts').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "alerts" con datos semilla...');
    await db.collection('alerts').insertMany(SEED_ALERTS);
    await db.collection('alerts').createIndex({ candidateId: 1 });
  }

  // 6. Colección reviews
  if (!collectionNames.includes('reviews') || (await db.collection('reviews').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "reviews" con datos semilla...');
    await db.collection('reviews').insertMany(SEED_REVIEWS);
    await db.collection('reviews').createIndex({ companyId: 1, candidateId: 1 }, { unique: true });
  }

  // 7. Colección articles
  if (!collectionNames.includes('articles') || (await db.collection('articles').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "articles" con datos semilla...');
    await db.collection('articles').insertMany(SEED_ARTICLES);
    await db.collection('articles').createIndex({ category: 1 });
  }

  // 8. Colección forums
  if (!collectionNames.includes('forums') || (await db.collection('forums').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "forums" con datos semilla...');
    await db.collection('forums').insertMany(SEED_FORUMS);
    await db.collection('forums').createIndex({ category: 1 });
  }

  // 9. Colección moderation_logs
  if (!collectionNames.includes('moderation_logs') || (await db.collection('moderation_logs').countDocuments()) === 0) {
    console.log('[MONGODB] Inicializando colección "moderation_logs" con datos semilla...');
    await db.collection('moderation_logs').insertMany(SEED_MODERATION_LOGS);
    await db.collection('moderation_logs').createIndex({ date: -1 });
  }

  console.log('[MONGODB] Base de datos "portal_trabajo" verificada y lista.');
}

/**
 * Retorna la colección real de MongoDB.
 * Lanza un error explícito si MongoDB no está conectado.
 */
export function getCollection(collectionName) {
  if (!isMongoConnected || !mongoDbInstance) {
    throw new Error(`[ERROR DE BASE DE DATOS] No hay conexión activa con MongoDB en ${MONGODB_URI}. Asegúrese de que el servicio mongod esté iniciado en 127.0.0.1:27017.`);
  }
  return mongoDbInstance.collection(collectionName);
}

export function getDb() {
  if (!isMongoConnected || !mongoDbInstance) {
    throw new Error(`[ERROR DE BASE DE DATOS] No hay conexión activa con MongoDB en ${MONGODB_URI}. Asegúrese de que el servicio mongod esté iniciado en 127.0.0.1:27017.`);
  }
  return mongoDbInstance;
}

export function getGridFSBucket(bucketName = 'uploads') {
  const db = getDb();
  return new GridFSBucket(db, { bucketName });
}

export function isConnectedToMongo() {
  return isMongoConnected;
}

export function getMongoStatus() {
  return {
    isMongoConnected,
    mongoUri: MONGODB_URI,
    databaseName: DB_NAME,
    driver: 'official-mongodb-v7',
    error: lastConnectionError,
    storageMode: 'mongodb_persistencia_real'
  };
}

export async function closeDB() {
  if (mongoClient) {
    await mongoClient.close();
    isMongoConnected = false;
    mongoDbInstance = null;
  }
}
