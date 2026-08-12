const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  const lowercaseEmail = 'noorali8657@gmail.com';
  const uppercaseEmail = 'Noorali8657@gmail.com';

  const lowerUserRes = await client.query('SELECT id FROM "User" WHERE email = $1', [lowercaseEmail]);
  const upperUserRes = await client.query('SELECT id FROM "User" WHERE email = $1', [uppercaseEmail]);

  if (lowerUserRes.rows.length > 0 && upperUserRes.rows.length > 0) {
    const lowerId = lowerUserRes.rows[0].id;
    const upperId = upperUserRes.rows[0].id;
    console.log(`Merging ${upperId} into ${lowerId}...`);

    const updatePages = await client.query('UPDATE "FacebookPage" SET "userId" = $1 WHERE "userId" = $2 OR "userId" IS NULL', [lowerId, upperId]);
    console.log(`Updated ${updatePages.rowCount} Facebook Pages.`);

    const updateSources = await client.query('UPDATE "Source" SET "userId" = $1 WHERE "userId" = $2 OR "userId" IS NULL', [lowerId, upperId]);
    console.log(`Updated ${updateSources.rowCount} Sources.`);

    await client.query('DELETE FROM "User" WHERE id = $1', [upperId]);
    console.log(`Deleted duplicate user ${uppercaseEmail}.`);

  } else {
    console.log('One or both users not found, maybe already merged.');
  }

  await client.end();
}

main().catch(console.error);
