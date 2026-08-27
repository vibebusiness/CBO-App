import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 8_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

pool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error', event: 'database_pool_error', message: error.message }));
});

export async function databaseIsReady() {
  await pool.query('SELECT 1');
}
