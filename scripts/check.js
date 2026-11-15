const { Client } = require('pg');

const password = process.env.DB_PASSWORD || process.env.PGPASSWORD;
if (!password) {
  throw new Error('Define DB_PASSWORD o PGPASSWORD en las variables de entorno.');
}

const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'demo1',
  password,
  port: Number(process.env.DB_PORT || 5432),
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'DOCENTE'");
  console.log(`Active teachers: ${res.rows[0].count}`);
  await client.end();
}

run().catch(console.error);
