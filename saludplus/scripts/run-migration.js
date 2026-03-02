#!/usr/bin/env node
/**
 * CLI script to run the CSV migration.
 * Usage: node scripts/run-migration.js [--clear]
 * --clear: truncate tables and MongoDB before migrating (clearBefore: true)
 */
import 'dotenv/config';
import { createTables } from '../src/config/postgres.js';
import { connectMongo } from '../src/config/mongodb.js';
import { migrate } from '../src/services/migrationService.js';

const clearBefore = process.argv.includes('--clear');

async function main() {
  try {
    await createTables();
    await connectMongo();
    const result = await migrate(clearBefore);
    console.log('Migration completed:', result);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
