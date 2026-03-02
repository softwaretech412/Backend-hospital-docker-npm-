import 'dotenv/config';
import { createTables } from './config/postgres.js';
import { connectMongo } from './config/mongodb.js';
import app, { env } from './app.js';

async function startServer() {
  try {
    console.log('Connecting to PostgreSQL...');
    await createTables();
    console.log('PostgreSQL ready.');

    console.log('Connecting to MongoDB...');
    await connectMongo();
    console.log('MongoDB ready.');

    const port = env.port;
    app.listen(port, () => {
      console.log('-----------------------------------------');
      console.log(`SaludPlus API listening on http://localhost:${port}`);
      console.log('Run migration: POST /api/simulacro/migrate');
      console.log('-----------------------------------------');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
