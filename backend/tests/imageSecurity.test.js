import http from 'node:http';
import {
  decodeSafeDataImage,
  fetchPublicImageBuffer,
  fetchTrustedImageBuffer,
  isPublicIpAddress,
  normalizeSafeImageSource,
  renderSafeImageDataUri,
  sanitizeImageForStorage,
  sanitizePostPhotos
} from '../utils/imageSecurity.js';

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const ONE_PIXEL_DATA_URL = `data:image/png;base64,${ONE_PIXEL_PNG}`;

describe('Image security', () => {
  test('accepts verified raster data but rejects SVG and forged data URLs', () => {
    expect(decodeSafeDataImage(ONE_PIXEL_DATA_URL)?.buffer.length).toBeGreaterThan(0);
    expect(
      decodeSafeDataImage(
        'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4='
      )
    ).toBeNull();
    expect(decodeSafeDataImage('data:image/png;base64,dGV4dA==')).toBeNull();
  });

  test('allows only managed paths and explicitly trusted origins', () => {
    expect(normalizeSafeImageSource('/uploads/avatars/user.jpg')).toBe(
      '/uploads/avatars/user.jpg'
    );
    expect(normalizeSafeImageSource('/characters/Test.jpg')).toBe(
      '/characters/Test.jpg'
    );
    expect(normalizeSafeImageSource('/../backend/.env')).toBeNull();
    expect(normalizeSafeImageSource('//169.254.169.254/latest/meta-data')).toBeNull();
    expect(normalizeSafeImageSource('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(
      normalizeSafeImageSource('https://cdn.example/characters/Test.jpg', {
        allowedOrigins: ['https://cdn.example']
      })
    ).toBe('https://cdn.example/characters/Test.jpg');
    expect(
      normalizeSafeImageSource('https://evil.example/characters/Test.jpg', {
        allowedOrigins: ['https://cdn.example']
      })
    ).toBeNull();
  });

  test('rejects private, loopback, link-local and documentation addresses', () => {
    [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '192.0.2.1',
      '::1',
      'fc00::1',
      'fe80::1',
      '2001:db8::1',
      '::ffff:127.0.0.1'
    ].forEach((address) => expect(isPublicIpAddress(address)).toBe(false));
    expect(isPublicIpAddress('8.8.8.8')).toBe(true);
    expect(isPublicIpAddress('2606:4700:4700::1111')).toBe(true);
  });

  test('rejects remote URLs from post data before persistence', () => {
    expect(() =>
      sanitizePostPhotos(['http://169.254.169.254/latest/meta-data'])
    ).toThrow(/managed site image path/);
    expect(sanitizePostPhotos([ONE_PIXEL_DATA_URL])).toEqual([ONE_PIXEL_DATA_URL]);
  });

  test('sanitizes stored media to a decoded raster and rejects disguised content', async () => {
    const sanitized = await sanitizeImageForStorage(
      Buffer.from(ONE_PIXEL_PNG, 'base64')
    );
    expect(sanitized?.mime).toBe('image/webp');
    expect(sanitized?.buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    await expect(
      sanitizeImageForStorage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    ).resolves.toBeNull();
    await expect(sanitizeImageForStorage(Buffer.from('not an image'))).resolves.toBeNull();
  });

  test('public image importer refuses unsafe protocols and private IPs', async () => {
    await expect(fetchPublicImageBuffer('file:///etc/passwd')).resolves.toBeNull();
    await expect(
      fetchPublicImageBuffer('https://127.0.0.1/private.png')
    ).resolves.toBeNull();
    await expect(
      fetchPublicImageBuffer('https://169.254.169.254/latest/meta-data')
    ).resolves.toBeNull();
  });

  test('does not follow redirects and accepts a bounded trusted raster response', async () => {
    const png = Buffer.from(ONE_PIXEL_PNG, 'base64');
    const server = http.createServer((req, res) => {
      if (req.url === '/uploads/avatars/redirect.png') {
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
        res.end();
        return;
      }
      res.writeHead(200, {
        'content-type': 'image/png',
        'content-length': String(png.length)
      });
      res.end(png);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const origin = `http://127.0.0.1:${port}`;

    try {
      const valid = await fetchTrustedImageBuffer(
        `${origin}/uploads/avatars/valid.png`,
        { allowedOrigins: [origin], allowPrivateNetwork: true }
      );
      expect(valid?.buffer.equals(png)).toBe(true);

      await expect(
        fetchTrustedImageBuffer(`${origin}/uploads/avatars/redirect.png`, {
          allowedOrigins: [origin],
          allowPrivateNetwork: true
        })
      ).rejects.toBeTruthy();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('enforces the decoded pixel limit before rendering', async () => {
    const oversizedSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="7000" height="7000"><rect width="100%" height="100%"/></svg>'
    );
    await expect(renderSafeImageDataUri(oversizedSvg)).rejects.toThrow(/pixel limit/i);
  });
});
