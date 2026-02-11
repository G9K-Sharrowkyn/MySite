const POWERS_CATALOG = {
  type: 'powers',
  label: 'Powers',
  options: [
    { id: 'force-push', name: 'Force Push', category: 'Offensive', cost: 1, users: 'Universal', description: 'Kinetic push that interrupts attacks.' },
    { id: 'force-jump', name: 'Force Jump', category: 'Utility', cost: 1, users: 'Jedi, Sith', description: 'Greatly improves jump height and range.' },
    { id: 'force-speed', name: 'Force Speed', category: 'Utility', cost: 1, users: 'Universal', description: 'Boosts reflexes and movement speed.' },
    { id: 'force-sense', name: 'Force Sense', category: 'Utility', cost: 1, users: 'Universal', description: 'Detects life and environmental changes.' },
    { id: 'telekinesis', name: 'Telekinesis', category: 'Offensive', cost: 1, users: 'Universal', description: 'Manipulate light objects at range.' },
    { id: 'tapas', name: 'Tapas', category: 'Defensive', cost: 1, users: 'Jedi', description: 'Thermal control in harsh cold.' },
    { id: 'breath-control', name: 'Breath Control', category: 'Defensive', cost: 1, users: 'Qui-Gon Jinn', description: 'Resist low oxygen and air toxins.' },
    { id: 'force-empathy', name: 'Force Empathy', category: 'Utility', cost: 1, users: 'Jedi', description: 'Sense emotions in nearby beings.' },
    { id: 'mind-trick-l1', name: 'Mind Trick (L1)', category: 'Utility', cost: 1, users: 'Obi-Wan Kenobi', description: 'Basic suggestion on weak minds.' },

    { id: 'force-heal', name: 'Force Heal', category: 'Defensive', cost: 2, users: 'Jedi', description: 'Heal wounds and restore stamina.' },
    { id: 'force-aura', name: 'Force Aura', category: 'Defensive', cost: 2, users: 'Jedi', description: 'Temporary defense and resilience buff.' },
    { id: 'affect-mind', name: 'Affect Mind', category: 'Utility', cost: 2, users: 'Universal', description: 'Advanced perception manipulation.' },
    { id: 'force-shock', name: 'Force Shock', category: 'Offensive', cost: 2, users: 'Sith', description: 'Basic electric blast on one target.' },
    { id: 'force-slow', name: 'Force Slow', category: 'Offensive', cost: 2, users: 'Sith', description: 'Slows biological functions.' },
    { id: 'force-body', name: 'Force Body', category: 'Utility', cost: 2, users: 'Universal', description: 'Trade health for Force reserves.' },
    { id: 'animal-bond', name: 'Animal Bond', category: 'Utility', cost: 2, users: 'Darth Bane, Solo', description: 'Telepathic bond/control over beasts.' },
    { id: 'force-valor', name: 'Force Valor', category: 'Utility', cost: 2, users: 'Bastila Shan', description: 'Group-wide combat enhancement.' },
    { id: 'force-deflection', name: 'Force Deflection', category: 'Defensive', cost: 2, users: 'Yoda', description: 'Deflect blaster fire with hands.' },

    { id: 'force-lightning', name: 'Force Lightning', category: 'Offensive', cost: 3, users: 'Sith', description: 'High-voltage sustained lightning.' },
    { id: 'electric-judgment', name: 'Electric Judgment', category: 'Offensive', cost: 3, users: 'Plo Koon, Luke', description: 'Paralyzing non-lethal lightning.' },
    { id: 'force-whirlwind', name: 'Force Whirlwind', category: 'Offensive', cost: 3, users: 'Universal', description: 'Trap targets in a vortex field.' },
    { id: 'force-stasis', name: 'Force Stasis', category: 'Offensive', cost: 3, users: 'Jedi', description: 'Temporarily freeze a target.' },
    { id: 'energy-resistance', name: 'Energy Resistance', category: 'Defensive', cost: 3, users: 'Jedi', description: 'Reduce energy, fire, cold and sonic damage.' },
    { id: 'combustion', name: 'Combustion', category: 'Offensive', cost: 3, users: 'Jedi', description: 'Ignite objects by focused will.' },
    { id: 'malacia', name: 'Malacia', category: 'Offensive', cost: 3, users: 'Jedi', description: 'Severe vertigo and nausea effect.' },
    { id: 'stun-droid-adv', name: 'Stun Droid (Adv)', category: 'Utility', cost: 3, users: 'Jedi', description: 'Disable droids in an area.' },
    { id: 'ionize', name: 'Ionize', category: 'Offensive', cost: 3, users: 'Jedi', description: 'Strong EMP-style electronics disruption.' },

    { id: 'force-wave', name: 'Force Wave', category: 'Offensive', cost: 4, users: 'Universal', description: 'Explosive radial shockwave.' },
    { id: 'insanity', name: 'Insanity', category: 'Offensive', cost: 4, users: 'Sith', description: 'Mass fear and madness effect.' },
    { id: 'chain-lightning', name: 'Chain Lightning', category: 'Offensive', cost: 4, users: 'Sith', description: 'Lightning jumps between targets.' },
    { id: 'force-protection', name: 'Force Protection', category: 'Defensive', cost: 4, users: 'Jedi', description: 'Short immunity window vs physical/energy.' },
    { id: 'force-meld', name: 'Force Meld', category: 'Utility', cost: 4, users: 'Luke Skywalker', description: 'Mind synchronization for teamwork.' },
    { id: 'sever-force', name: 'Sever Force', category: 'Offensive', cost: 4, users: 'Nomi Sunrider', description: 'Cut target from the Force.' },
    { id: 'memory-walk', name: 'Memory Walk', category: 'Offensive', cost: 4, users: 'Sith', description: 'Force traumatic reliving of memories.' },
    { id: 'drain-knowledge', name: 'Drain Knowledge', category: 'Utility', cost: 4, users: 'Sith', description: 'Extract information violently.' },
    { id: 'force-destruction', name: 'Force Destruction', category: 'Offensive', cost: 4, users: 'Galen Marek', description: 'Concentrated hatred detonation.' },

    { id: 'death-field', name: 'Death Field', category: 'Offensive', cost: 5, users: 'Darth Nihilus', description: 'Area life drain that heals caster.' },
    { id: 'battle-meditation', name: 'Battle Meditation', category: 'Utility', cost: 5, users: 'Bastila Shan', description: 'Mass tactical/morale manipulation.' },
    { id: 'force-crush', name: 'Force Crush', category: 'Offensive', cost: 5, users: 'Darth Vader', description: 'Telekinetic body crushing.' },
    { id: 'shatterpoint', name: 'Shatterpoint', category: 'Utility', cost: 5, users: 'Mace Windu', description: 'See weak points in matter and fate.' },
    { id: 'force-breach', name: 'Force Breach', category: 'Utility', cost: 5, users: 'Jedi Consular', description: 'Break enemy Force barriers quickly.' },
    { id: 'sith-alchemy', name: 'Sith Alchemy', category: 'Utility', cost: 5, users: 'Exar Kun', description: 'Mutate matter and living beings.' },
    { id: 'force-light', name: 'Force Light', category: 'Offensive', cost: 5, users: 'Nomi Sunrider', description: 'Purging beam vs dark side.' },
    { id: 'deadly-sight', name: 'Deadly Sight', category: 'Offensive', cost: 5, users: 'Sariss', description: 'Burn opponents with dark gaze.' },
    { id: 'mechu-deru', name: 'Mechu-deru', category: 'Utility', cost: 5, users: 'Sith', description: 'Intuitive machine control.' },

    { id: 'thought-bomb', name: 'Thought Bomb', category: 'Offensive', cost: 6, users: 'Lord Kaan', description: 'Destroy Force-sensitive souls in area.' },
    { id: 'darkshear', name: 'Darkshear', category: 'Offensive', cost: 6, users: 'Sorcerers of Rhand', description: 'Aging spear effect.' },
    { id: 'force-phantom', name: 'Force Phantom', category: 'Utility', cost: 6, users: 'Lumiya', description: 'Material combat projections.' },
    { id: 'force-storm-combat', name: 'Force Storm (Combat)', category: 'Offensive', cost: 6, users: 'Emperor', description: 'Devastating combat storm.' },
    { id: 'essence-transfer', name: 'Essence Transfer', category: 'Utility', cost: 6, users: 'Darth Bane', description: 'Transfer spirit to body/object.' },
    { id: 'memory-wipe', name: 'Memory Wipe', category: 'Utility', cost: 6, users: 'Revan', description: 'Total identity memory erasure.' },
    { id: 'life-web', name: 'Life Web', category: 'Utility', cost: 6, users: 'Jedi', description: 'Sense life bonds across sectors.' },

    { id: 'force-storm-wormhole', name: 'Force Storm (Wormhole)', category: 'Offensive', cost: 7, users: 'Palpatine', description: 'Space-time rift capable of fleet destruction.' },
    { id: 'midichlorian-manipulation', name: 'Midi-chlorian Manipulation', category: 'Utility', cost: 7, users: 'Darth Plagueis', description: 'Create life and delay death.' },
    { id: 'flow-walking', name: 'Flow-walking', category: 'Utility', cost: 7, users: 'Jacen Solo', description: 'Perceive/project through time.' },
    { id: 'force-black-hole', name: 'Force Black Hole', category: 'Offensive', cost: 7, users: 'Luke Skywalker', description: 'Extreme gravity compression.' },
    { id: 'celestial-touch', name: 'Celestial Touch', category: 'Defensive', cost: 7, users: 'The Father (Mortis)', description: 'Catch lightsaber blades bare-handed.' },
    { id: 'supernova-trigger', name: 'Supernova Trigger', category: 'Offensive', cost: 7, users: 'Naga Sadow', description: 'Trigger stellar explosion.' },
    { id: 'total-concealment', name: 'Total Concealment', category: 'Utility', cost: 7, users: 'Palpatine', description: 'Absolute concealment in the Force.' }
  ]
};

const WEAPONS_CATALOG = {
  type: 'weapons',
  label: 'Weapons & Combat Traits',
  options: [
    { id: 'form-shii-cho', name: 'Form I: Shii-Cho', category: 'Lightsaber Form', cost: 1, description: 'Basic anti-group fundamentals.' },
    { id: 'form-makashi', name: 'Form II: Makashi', category: 'Lightsaber Form', cost: 2, description: 'Elegant dueling precision.' },
    { id: 'form-soresu', name: 'Form III: Soresu', category: 'Lightsaber Form', cost: 3, description: 'Maximum defense and blaster control.' },
    { id: 'form-ataru', name: 'Form IV: Ataru', category: 'Lightsaber Form', cost: 4, description: 'Acrobatic offense empowered by Force jumps.' },
    { id: 'form-shien-djem-so', name: 'Form V: Shien / Djem So', category: 'Lightsaber Form', cost: 5, description: 'Powerful counterattacks and shot returns.' },
    { id: 'form-niman', name: 'Form VI: Niman', category: 'Lightsaber Form', cost: 6, description: 'Balanced style combining forms and Force usage.' },
    { id: 'form-juyo-vaapad', name: 'Form VII: Juyo / Vaapad', category: 'Lightsaber Form', cost: 7, description: 'Most dangerous and unpredictable style.' },

    { id: 'weapon-simple', name: 'Simple Weapon', category: 'Weapon Type', cost: 1, description: 'Knives, staves, gaderffii. Cheap and common.' },
    { id: 'weapon-vibro', name: 'Vibroweapon', category: 'Weapon Type', cost: 2, description: 'Ultrasonic edge for heavy cuts.' },
    { id: 'weapon-lightsaber', name: 'Standard Lightsaber', category: 'Weapon Type', cost: 3, description: 'Classic plasma blade.' },
    { id: 'weapon-saber-variant', name: 'Saber Variant', category: 'Weapon Type', cost: 4, description: 'Double-bladed / shoto / JarKai setups.' },
    { id: 'weapon-exotic', name: 'Exotic Weapon', category: 'Weapon Type', cost: 5, description: 'Whips/lances that bypass typical blocks.' },
    { id: 'weapon-amphistaff', name: 'Biotech Weapon', category: 'Weapon Type', cost: 6, description: 'Yuuzhan Vong living weapon tech.' },
    { id: 'weapon-artifact', name: 'Alchemy / Artifact Weapon', category: 'Weapon Type', cost: 7, description: 'Sith sword, Darksaber, dark artifacts.' },

    { id: 'armor-plastoid', name: 'Plastoid Armor', category: 'Armor', cost: 1, description: 'Basic fragment protection.' },
    { id: 'armor-armorweave', name: 'Armorweave Robes', category: 'Armor', cost: 2, description: 'Energy-dispersing light cloth.' },
    { id: 'armor-composite', name: 'Composite Armor', category: 'Armor', cost: 3, description: 'Solid physical protection with assists.' },
    { id: 'armor-cortosis', name: 'Cortosis Weave', category: 'Armor', cost: 4, description: 'Can short enemy lightsaber on contact.' },
    { id: 'armor-phrik', name: 'Phrik Alloy Armor', category: 'Armor', cost: 5, description: 'Highly saber-resistant lightweight armor.' },
    { id: 'armor-vonduun', name: 'Vonduun Crab Armor', category: 'Armor', cost: 6, description: 'Regenerating bio-armor.' },
    { id: 'armor-beskar', name: 'Pure Beskar Armor', category: 'Armor', cost: 7, description: 'Legendary Mandalorian near-indestructible iron.' },

    { id: 'race-human', name: 'Human', category: 'Species', cost: 1, description: 'Versatile training profile.' },
    { id: 'race-bothan-duros', name: 'Bothan / Duros', category: 'Species', cost: 2, description: 'High agility and survival instincts.' },
    { id: 'race-wookiee-trandoshan', name: 'Wookiee / Trandoshan', category: 'Species', cost: 3, description: 'High strength and strong recovery.' },
    { id: 'race-echani-thyrsian', name: 'Echani / Thyrsian', category: 'Species', cost: 4, description: 'Duel precognition and muscle reading.' },
    { id: 'race-taung', name: 'Taung', category: 'Species', cost: 5, description: 'Extreme pain tolerance.' },
    { id: 'race-dashade', name: 'Dashade', category: 'Species', cost: 6, description: 'Natural partial Force resistance.' },
    { id: 'race-gendai', name: "Gen'Dai", category: 'Species', cost: 7, description: 'No vital organs and near-instant regeneration.' },

    { id: 'mod-grip-talon', name: 'Grip Talon', category: 'Modifier', cost: 1, description: 'Glove hooks make disarm attempts harder.' },
    { id: 'mod-dual-phase-crystal', name: 'Dual-Phase Crystal', category: 'Modifier', cost: 2, description: 'Change blade length instantly.' },
    { id: 'mod-sith-alchemy-l1', name: 'Sith Alchemy (L1)', category: 'Modifier', cost: 3, description: 'Dark-side reinforcement of materials.' },
    { id: 'mod-shatterpoint-sense', name: 'Shatterpoint Sense', category: 'Modifier', cost: 4, description: 'See armor breakpoints.' },
    { id: 'mod-solari-crystal', name: 'Solari Crystal', category: 'Modifier', cost: 5, description: 'High power crystal requiring light-side purity.' },
    { id: 'mod-mechu-deru-interface', name: 'Mechu-deru Interface', category: 'Modifier', cost: 6, description: 'Direct brain link to armor/weapon systems.' },
    { id: 'mod-aing-tii-flow-walking', name: 'Aing-Tii Flow-walking', category: 'Modifier', cost: 7, description: 'Predictive combat from temporal perception.' }
  ]
};

export const CHOOSE_YOUR_WEAPON_CATALOGS = Object.freeze({
  powers: Object.freeze(POWERS_CATALOG),
  weapons: Object.freeze(WEAPONS_CATALOG)
});

const normalizeCatalogType = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'weapon' || raw === 'weapons') return 'weapons';
  return 'powers';
};

export const getChooseYourWeaponCatalog = (type) =>
  CHOOSE_YOUR_WEAPON_CATALOGS[normalizeCatalogType(type)];

export const listChooseYourWeaponCatalogTypes = () =>
  Object.keys(CHOOSE_YOUR_WEAPON_CATALOGS);

export const getCatalogOptionMap = (type) => {
  const catalog = getChooseYourWeaponCatalog(type);
  const map = new Map();
  for (const option of catalog.options) {
    map.set(option.id, option);
  }
  return map;
};

export const groupCatalogOptionsByCategory = (options = []) =>
  options.reduce((acc, option) => {
    const key = option.category || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(option);
    return acc;
  }, {});
