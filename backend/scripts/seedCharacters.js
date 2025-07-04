const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const fs = require('fs');

const dbFile = path.join(__dirname, '../db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function seed() {
  await db.read();
  db.data = db.data || { characters: [] };
  const seedPath = path.join(__dirname, 'characters.json');
  const characters = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  characters.forEach(char => {
    if (!db.data.characters.some(c => c.id === char.id)) {
      db.data.characters.push(char);
    }
  });

  await db.write();
  console.log(`Seeded ${characters.length} characters`);
}

seed();

