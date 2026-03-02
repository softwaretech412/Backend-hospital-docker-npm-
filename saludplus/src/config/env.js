/**
 * Environment configuration. Use .env file and never commit credentials.
 * Required: DATABASE_URL, MONGODB_URI, MONGODB_DB (or full MONGODB_URI with DB).
 */
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const mongoDb = process.env.MONGODB_DB || 'saludplus';
const csvPath = process.env.SIMULACRO_CSV_PATH || process.env.FILE_DATA_CSV || './data/simulation_saludplus_data.csv';
const dataDir = process.env.DATA_DIR || './data';
const port = parseInt(process.env.PORT || '3000', 10);

// Full MongoDB connection URL (with database name)
const databaseMongoUrl = mongoUri.includes('?') || mongoUri.endsWith('/')
  ? `${mongoUri.replace(/\/?$/, '')}/${mongoDb}`
  : `${mongoUri}/${mongoDb}`;

export const env = {
  databaseUrl,
  mongoUri,
  mongoDb,
  databaseMongoUrl,
  csvPath,
  dataDir,
  port,
};
