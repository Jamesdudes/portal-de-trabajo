/**
 * Script de inicialización para MongoDB
 * Ejecutar con: mongosh "mongodb://localhost:27017/portal_trabajo" database/mongodb-init.js
 * 
 * Proyecto: Portal de Trabajo UNICAES - PWA
 * Cátedra: Ingeniería en Desarrollo de Software (FIA - UNICAES)
 */

const db = db.getSiblingDB('portal_trabajo');

print('>>> Inicializando base de datos portal_trabajo en MongoDB...');

// 1. Colección: users
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ status: 1 });

// 2. Colección: companies
db.createCollection('companies');
db.companies.createIndex({ name: 1 });
db.companies.createIndex({ verified: 1 });

// 3. Colección: jobs
db.createCollection('jobs');
db.jobs.createIndex({ title: 'text', description: 'text', sector: 'text' });
db.jobs.createIndex({ companyId: 1, status: 1 });
db.jobs.createIndex({ modality: 1 });
db.jobs.createIndex({ contractType: 1 });
db.jobs.createIndex({ publishedAt: -1 });

// 4. Colección: applications
db.createCollection('applications');
db.applications.createIndex({ jobId: 1, candidateId: 1 }, { unique: true });
db.applications.createIndex({ candidateId: 1 });
db.applications.createIndex({ companyId: 1 });
db.applications.createIndex({ status: 1 });

// 5. Colección: alerts
db.createCollection('alerts');
db.alerts.createIndex({ candidateId: 1 });
db.alerts.createIndex({ active: 1 });

// 6. Colección: reviews
db.createCollection('reviews');
db.reviews.createIndex({ companyId: 1, candidateId: 1 }, { unique: true });
db.reviews.createIndex({ status: 1 });

// 7. Colección: articles
db.createCollection('articles');
db.articles.createIndex({ category: 1 });

// 8. Colección: forums
db.createCollection('forums');
db.forums.createIndex({ category: 1 });
db.forums.createIndex({ createdAt: -1 });

// 9. Colección: moderation_logs
db.createCollection('moderation_logs');
db.moderation_logs.createIndex({ date: -1 });
db.moderation_logs.createIndex({ category: 1 });

print('>>> Colecciones e índices configurados exitosamente en MongoDB.');
