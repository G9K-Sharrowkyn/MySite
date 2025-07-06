const fs = require('fs');
const path = require('path');

// Function to generate SVG placeholder images
const generatePlaceholderImage = (width = 150, height = 150, backgroundColor = '#666', textColor = '#fff', text = 'User') => {
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${backgroundColor}"/><text x="${width/2}" y="${height/2 + 5}" font-family="Arial" font-size="${Math.min(width, height) * 0.1}" fill="${textColor}" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

// Function to replace via.placeholder.com URLs with local alternatives
const replacePlaceholderUrl = (url) => {
  if (!url || !url.includes('via.placeholder.com')) {
    return url;
  }
  
  // Extract dimensions and text from via.placeholder.com URL
  const match = url.match(/(\d+)x?(\d+)?.*text=([^&]*)/);
  if (match) {
    const width = parseInt(match[1]);
    const height = parseInt(match[2]) || width;
    const text = decodeURIComponent(match[3]).replace(/\+/g, ' ');
    
    // Extract color if present
    const colorMatch = url.match(/\/(\w{6})\/(\w{6})/);
    const backgroundColor = colorMatch ? `#${colorMatch[1]}` : '#666';
    const textColor = colorMatch ? `#${colorMatch[2]}` : '#fff';
    
    return generatePlaceholderImage(width, height, backgroundColor, textColor, text);
  }
  
  // Fallback for unmatched URLs
  return generatePlaceholderImage(150, 150, '#666', '#fff', 'Image');
};

// Read the database file
const dbPath = path.join(__dirname, '..', 'db.json');
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('Fixing placeholder images in database...');

// Fix user profile pictures
dbData.users.forEach(user => {
  if (user.profile && user.profile.avatar) {
    const oldUrl = user.profile.avatar;
    user.profile.avatar = replacePlaceholderUrl(oldUrl);
    if (oldUrl !== user.profile.avatar) {
      console.log(`Updated user ${user.username} avatar`);
    }
  }
  if (user.profile && user.profile.profilePicture) {
    const oldUrl = user.profile.profilePicture;
    user.profile.profilePicture = replacePlaceholderUrl(oldUrl);
    if (oldUrl !== user.profile.profilePicture) {
      console.log(`Updated user ${user.username} profilePicture`);
    }
  }
  if (user.profilePicture) {
    const oldUrl = user.profilePicture;
    user.profilePicture = replacePlaceholderUrl(oldUrl);
    if (oldUrl !== user.profilePicture) {
      console.log(`Updated user ${user.username} main profilePicture`);
    }
  }
});

// Fix character images
dbData.characters.forEach(character => {
  if (character.image) {
    const oldUrl = character.image;
    character.image = replacePlaceholderUrl(oldUrl);
    if (oldUrl !== character.image) {
      console.log(`Updated character ${character.name} image`);
    }
  }
});

// Write the updated database back
fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
console.log('Database updated successfully!');
console.log('All via.placeholder.com URLs have been replaced with local SVG alternatives.');