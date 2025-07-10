require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Division = require('../src/models/divisionModel');

const divisions = [
  {
    name: 'Metahuman',
    description: 'Enhanced humans with special abilities',
    roster: []
  },
  {
    name: 'Cosmic',
    description: 'Beings with cosmic-level powers',
    roster: []
  },
  {
    name: 'Street Level',
    description: 'Ground-level heroes and vigilantes',
    roster: []
  },
  {
    name: 'Magic',
    description: 'Masters of mystical arts',
    roster: []
  }
];

const seedDivisions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    for (const division of divisions) {
      await Division.updateOne(
        { name: division.name }, 
        division, 
        { upsert: true }
      );
    }
    
    console.log(`Seeded ${divisions.length} divisions`);
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedDivisions();