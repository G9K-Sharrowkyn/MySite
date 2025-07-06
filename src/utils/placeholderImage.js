// Utility function to generate SVG placeholder images
export const generatePlaceholderImage = (width = 150, height = 150, backgroundColor = '#666', textColor = '#fff', text = 'User') => {
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
      <text x="${width/2}" y="${height/2 + 5}" font-family="Arial" font-size="${Math.min(width, height) * 0.1}" fill="${textColor}" text-anchor="middle">${text}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Predefined placeholder images
export const placeholderImages = {
  user: generatePlaceholderImage(150, 150, '#666', '#fff', 'User'),
  userSmall: generatePlaceholderImage(40, 40, '#666', '#fff', 'User'),
  moderator: generatePlaceholderImage(150, 150, '#333', '#fff', 'Mod'),
  character: generatePlaceholderImage(150, 200, '#444', '#fff', 'Char'),
};

// Function to replace via.placeholder.com URLs with local alternatives
export const replacePlaceholderUrl = (url) => {
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
  return placeholderImages.user;
};