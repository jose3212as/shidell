const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'demo1',
  password: 'Joseelmer31',
  port: 5432,
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'DOCENTE'");
  console.log(`Active teachers: ${res.rows[0].count}`);
  await client.end();
}

run().catch(console.error);
