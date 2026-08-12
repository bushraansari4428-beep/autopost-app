const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  const users = await client.query('SELECT id, email, role, "expiresAt" FROM "User"');
  console.log('Users:');
  console.table(users.rows);
  
  const pages = await client.query('SELECT id, name, "userId" FROM "FacebookPage"');
  console.log('Pages:');
  console.table(pages.rows);
  
  const sources = await client.query('SELECT id, name, "userId" FROM "Source"');
  console.log('Sources:');
  console.table(sources.rows);
  
  const mappings = await client.query('SELECT id, "sourceId", "facebookPageId" FROM "Mapping"');
  console.log('Mappings:');
  console.table(mappings.rows);
  
  await client.end();
}

main().catch(console.error);
