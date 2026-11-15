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
  console.log('Connected.');
  
  // See columns in usuarios
  const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='usuarios'");
  console.log('Columns in usuarios:', colRes.rows.map(r => r.column_name).join(', '));
  
  // Truncate
  await client.query("TRUNCATE TABLE usuarios CASCADE");
  console.log('Table usuarios truncated.');
  
  await client.end();
}
run().catch(console.error);
