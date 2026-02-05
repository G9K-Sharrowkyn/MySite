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
  user: '/logo192.png',
  userSmall: '/logo192.png',
  moderator: generatePlaceholderImage(150, 150, '#333', '#fff', 'Mod'),
  character: generatePlaceholderImage(150, 200, '#444', '#fff', 'Char'),
};

const isExternalUrl = (url) => /^https?:\/\//i.test(url);
const isCharacterAsset = (url) => typeof url === 'string' && url.startsWith('/characters/');
const isBackendUploadAsset = (url) =>
  typeof url === 'string' && url.startsWith('/uploads/');

const getApiOrigin = () => {
  const apiUrl = process.env.REACT_APP_API_URL;
  if (typeof apiUrl !== 'string' || !/^https?:\/\//i.test(apiUrl)) {
    return null;
  }
  try {
    return new URL(apiUrl).origin;
  } catch (_error) {
    return null;
  }
};

const guessApiOriginFromWindow = () => {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }
  const { protocol, hostname, origin } = window.location;
  if (!hostname) return null;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return origin;
  }
  if (hostname.startsWith('api.')) {
    return origin;
  }
  return `${protocol}//api.${hostname}`;
};

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const fullyDecode = (value) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const decoded = safeDecode(current);
    if (decoded === current) {
      break;
    }
    current = decoded;
  }
  return current;
};

export const normalizeAssetUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return url;
  }
  if (url.startsWith('data:') || url.startsWith('blob:') || isExternalUrl(url)) {
    return url;
  }

  // Normalize known character asset naming variants so legacy data keeps working.
  // We currently store many SW characters on disk as "(Star Wars)" even if older
  // DB entries reference "(SW)".
  let normalizedInput = fullyDecode(url);
  if (isCharacterAsset(normalizedInput) && normalizedInput.includes('(SW)')) {
    normalizedInput = normalizedInput.replace(/\(SW\)/g, '(Star Wars)');
  }

  const parts = normalizedInput.split('/');
  const normalizedPath = parts
    .map((part, index) => (index === 0 ? part : encodeURIComponent(fullyDecode(part))))
    .join('/');

  // User-uploaded media lives on the API host in production.
  if (isBackendUploadAsset(normalizedPath)) {
    const apiOrigin = getApiOrigin() || guessApiOriginFromWindow();
    if (apiOrigin) {
      return `${apiOrigin}${normalizedPath}`;
    }
  }

  return normalizedPath;
};

const buildCharacterThumbUrl = (url) => {
  if (!isCharacterAsset(url)) return null;
  const filename = fullyDecode(url.split('/').pop() || '');
  if (!filename) return null;
  const base = filename.replace(/\.[^.]+$/, '');
  if (!base) return null;
  return normalizeAssetUrl(`/characters/thumbs/${base}.webp`);
};

export const getCharacterImageSources = (url) => {
  const src = normalizeAssetUrl(url);
  const thumb = buildCharacterThumbUrl(src);
  if (!thumb || !src) {
    return { src, thumb: null, srcSet: null };
  }
  return {
    src,
    thumb,
    srcSet: `${thumb} 320w, ${src} 1024w`
  };
};

export const getOptimizedImageProps = (
  url,
  { size = 200, preferFull = false, lazy = true, fetchPriority, decoding = 'async' } = {}
) => {
  const { src, thumb, srcSet } = getCharacterImageSources(url);
  const primarySrc = preferFull || !thumb ? src : thumb;
  const props = {
    src: primarySrc,
    decoding
  };
  props.loading = lazy ? 'lazy' : 'eager';
  if (fetchPriority) {
    props.fetchPriority = fetchPriority;
  }
  if (srcSet && size) {
    props.srcSet = srcSet;
    props.sizes = `${size}px`;
  }
  return props;
};

const preloadedImages = new Set();

export const preloadImage = (url) => {
  const src = normalizeAssetUrl(url);
  if (!src || typeof src !== 'string') {
    return;
  }
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return;
  }
  if (preloadedImages.has(src)) {
    return;
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  preloadedImages.add(src);
};

export const preloadCharacterImage = (url) => {
  const { src, thumb } = getCharacterImageSources(url);
  if (thumb) {
    preloadImage(thumb);
  }
  if (src) {
    preloadImage(src);
  }
};

// Function to replace via.placeholder.com URLs with local alternatives
export const replacePlaceholderUrl = (url) => {
  if (!url) {
    return url;
  }
  if (!url.includes('via.placeholder.com')) {
    return normalizeAssetUrl(url);
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
