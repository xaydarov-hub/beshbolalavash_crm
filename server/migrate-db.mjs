import { migrateDatabase } from './storage.js';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node server/migrate-db.mjs <verified-backup.json> <persistent-db.json>');
const result = await migrateDatabase(source, destination);
console.log(JSON.stringify({ migrated: true, ...result }));
