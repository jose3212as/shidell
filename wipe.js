const { Client } = require('pg');
const client = new Client({ user:'postgres', host:'localhost', database:'demo1', password:'Joseelmer31', port:5432 });

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
