require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Character = require('../src/models/characterModel');

const seedCharacters = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const characters = JSON.parse(fs.readFileSync(path.join(__dirname, 'characters.json'), 'utf-8'));
    for (const char of characters) {
      await Character.updateOne({ name: char.name }, char, { upsert: true });
    }
    console.log(`Seeded ${characters.length} characters`);
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedCharacters();