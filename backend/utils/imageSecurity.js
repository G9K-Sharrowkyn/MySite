import dns from 'node:dns';
import net from 'node:net';
import axios from 'axios';
import sharp from 'sharp';

export const MAX_IMAGE_INPUT_PIXELS = 40_000_000;
export const MAX_STORED_IMAGE_BYTES = 5 * 1024 * 1024;

const DATA_IMAGE_PATTERN =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,([a-z0-9+/=\s]+)$/i;
const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);
const SAFE_LOCAL_IMAGE_PREFIXES = [
  '/uploads/avatars/',
  '/uploads/backgrounds/',
  '/uploads/characters/',
  '/characters/',
  '/api/media/characters/'
];
const SAFE_LOCAL_IMAGE_FILES = new Set([
  '/logo192.png',
  '/logo512.png',
  '/VS.png',
  '/placeholder-character.png'
]);

const normalizeMime = (value) => {
  const mime = String(value || '').split(';')[0].trim().toLowerCase();
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
};

export const isAllowedImageMimeType = (value) =>
  SAFE_IMAGE_MIME_TYPES.has(normalizeMime(value));

export const isValidUploadedImage = (file) => {
  const mime = normalizeMime(file?.mimetype);
  return (
    Buffer.isBuffer(file?.buffer) &&
    file.buffer.length > 0 &&
    file.buffer.length <= MAX_STORED_IMAGE_BYTES + 3 * 1024 * 1024 &&
    SAFE_IMAGE_MIME_TYPES.has(mime) &&
    imageBufferMatchesMime(file.buffer, mime)
  );
};

export const imageBufferMatchesMime = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const mime = normalizeMime(mimeType);
  if (mime === 'image/png') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  if (mime === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  return false;
};

export const detectSafeImageMimeType = (buffer) => {
  for (const mime of SAFE_IMAGE_MIME_TYPES) {
    if (imageBufferMatchesMime(buffer, mime)) return mime;
  }
  return null;
};

export const decodeSafeDataImage = (
  source,
  { maxBytes = MAX_STORED_IMAGE_BYTES } = {}
) => {
  if (typeof source !== 'string') return null;
  const match = source.trim().match(DATA_IMAGE_PATTERN);
  if (!match) return null;

  const mime = normalizeMime(`image/${match[1]}`);
  const encoded = match[2].replace(/\s+/g, '');
  if (!SAFE_IMAGE_MIME_TYPES.has(mime) || encoded.length > Math.ceil(maxBytes * 4 / 3) + 4) {
    return null;
  }
  if (!/^[a-z0-9+/]*={0,2}$/i.test(encoded) || encoded.length % 4 === 1) {
    return null;
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (
    buffer.length === 0 ||
    buffer.length > maxBytes ||
    !imageBufferMatchesMime(buffer, mime)
  ) {
    return null;
  }

  return { buffer, mime, source: `data:${mime};base64,${buffer.toString('base64')}` };
};

const hasSafePath = (pathname) => {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_error) {
    return false;
  }
  if (
    !decoded.startsWith('/') ||
    decoded.includes('\0') ||
    decoded.includes('\\') ||
    decoded.split('/').includes('..')
  ) {
    return false;
  }
  return (
    SAFE_LOCAL_IMAGE_FILES.has(decoded) ||
    SAFE_LOCAL_IMAGE_PREFIXES.some((prefix) => decoded.startsWith(prefix))
  );
};

export const normalizeSafeImageSource = (
  source,
  { allowedOrigins = [], allowData = true } = {}
) => {
  if (typeof source !== 'string') return null;
  const raw = source.trim();
  if (!raw) return null;

  if (/^data:/i.test(raw)) {
    return allowData ? decodeSafeDataImage(raw)?.source || null : null;
  }
  if (raw.length > 2048 || raw.startsWith('//')) return null;

  const trustedOrigins = new Set(
    allowedOrigins
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean)
  );

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (
        url.username ||
        url.password ||
        url.hash ||
        !trustedOrigins.has(url.origin) ||
        !hasSafePath(url.pathname)
      ) {
        return null;
      }
      return url.href;
    }

    if (!raw.startsWith('/')) return null;
    const url = new URL(raw, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || url.hash || !hasSafePath(url.pathname)) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch (_error) {
    return null;
  }
};

export const sanitizePostPhotos = (value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) {
    const error = new Error('A post can contain at most 6 photos');
    error.code = 'INVALID_IMAGE_SOURCE';
    throw error;
  }

  return value.map((entry) => {
    const source = typeof entry === 'string' ? entry : entry?.url;
    const normalized = normalizeSafeImageSource(source);
    if (!normalized) {
      const error = new Error(
        'Post images must be uploaded image data or a managed site image path'
      );
      error.code = 'INVALID_IMAGE_SOURCE';
      throw error;
    }
    return normalized;
  });
};

const isPrivateIpv4 = (address) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

export const isPublicIpAddress = (address) => {
  const normalized = String(address || '').trim().toLowerCase();
  const family = net.isIP(normalized);
  if (family === 4) return !isPrivateIpv4(normalized);
  if (family !== 6) return false;

  if (normalized.startsWith('::ffff:')) {
    return isPublicIpAddress(normalized.slice(7));
  }
  return !(
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
};

const createValidatedLookup = ({ allowPrivateNetwork }) =>
  (hostname, options, callback) => {
    const lookupOptions =
      typeof options === 'object'
        ? { ...options, all: true, verbatim: true }
        : { family: options, all: true, verbatim: true };
    dns.lookup(hostname, lookupOptions, (error, addresses) => {
      if (error) return callback(error);
      const candidates = Array.isArray(addresses) ? addresses : [addresses];
      const selected = candidates.find(
        (entry) => entry?.address && (allowPrivateNetwork || isPublicIpAddress(entry.address))
      );
      if (!selected) {
        const lookupError = new Error('Image host resolved to a non-public network');
        lookupError.code = 'UNSAFE_IMAGE_HOST';
        return callback(lookupError);
      }
      return callback(null, selected.address, selected.family);
    });
  };

const readBoundedStream = async (stream, maxBytes) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maxBytes) {
      stream.destroy();
      const error = new Error('Remote image exceeded the response size limit');
      error.code = 'IMAGE_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
};

const fetchImageBufferFromUrl = async (
  url,
  {
    allowPrivateNetwork = false,
    maxBytes = MAX_STORED_IMAGE_BYTES,
    timeoutMs = 5000
  } = {}
) => {
  if (net.isIP(url.hostname) && !allowPrivateNetwork && !isPublicIpAddress(url.hostname)) {
    return null;
  }

  const response = await axios.get(url.href, {
    responseType: 'stream',
    timeout: timeoutMs,
    maxRedirects: 0,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    decompress: false,
    proxy: false,
    lookup: createValidatedLookup({ allowPrivateNetwork }),
    validateStatus: (status) => status >= 200 && status < 300
  });
  const mime = normalizeMime(response.headers?.['content-type']);
  const contentLength = Number(response.headers?.['content-length'] || 0);
  if (
    !SAFE_IMAGE_MIME_TYPES.has(mime) ||
    (Number.isFinite(contentLength) && contentLength > maxBytes) ||
    (response.headers?.['content-encoding'] &&
      response.headers['content-encoding'] !== 'identity')
  ) {
    response.data.destroy();
    return null;
  }

  const buffer = await readBoundedStream(response.data, maxBytes);
  return imageBufferMatchesMime(buffer, mime) ? { buffer, mime } : null;
};

export const fetchTrustedImageBuffer = async (
  source,
  {
    allowedOrigins,
    allowPrivateNetwork = false,
    maxBytes = MAX_STORED_IMAGE_BYTES,
    timeoutMs = 5000
  }
) => {
  const normalized = normalizeSafeImageSource(source, {
    allowedOrigins,
    allowData: false
  });
  if (!normalized || !/^https?:\/\//i.test(normalized)) return null;

  const url = new URL(normalized);
  return fetchImageBufferFromUrl(url, {
    allowPrivateNetwork,
    maxBytes,
    timeoutMs
  });
};

export const fetchPublicImageBuffer = async (
  source,
  {
    allowPrivateNetwork = false,
    maxBytes = MAX_STORED_IMAGE_BYTES,
    timeoutMs = 5000
  } = {}
) => {
  if (typeof source !== 'string' || source.length > 2048) return null;

  let url;
  try {
    url = new URL(source.trim());
  } catch (_error) {
    return null;
  }
  const allowDevelopmentHttp =
    allowPrivateNetwork && process.env.NODE_ENV !== 'production';
  if (
    (url.protocol !== 'https:' && !(allowDevelopmentHttp && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return null;
  }

  return fetchImageBufferFromUrl(url, {
    allowPrivateNetwork,
    maxBytes,
    timeoutMs
  });
};

export const sanitizeImageForStorage = async (
  buffer,
  {
    maxBytes = MAX_STORED_IMAGE_BYTES,
    maxWidth = 1600,
    maxHeight = 1600
  } = {}
) => {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0 ||
    buffer.length > maxBytes ||
    !detectSafeImageMimeType(buffer)
  ) {
    return null;
  }

  const sanitized = await sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    sequentialRead: true,
    animated: false
  })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();

  if (!sanitized.length || sanitized.length > maxBytes) return null;
  return { buffer: sanitized, mime: 'image/webp' };
};

export const renderSafeImageDataUri = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_STORED_IMAGE_BYTES) {
    return null;
  }
  const png = await sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    sequentialRead: true,
    animated: false
  })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
};

export const isUnsafeImageError = (error) =>
  /pixel limit|unsupported image format|corrupt|invalid image/i.test(
    String(error?.message || '')
  );
