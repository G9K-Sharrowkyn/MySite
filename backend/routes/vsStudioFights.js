import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile, readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
const fightsRoot = path.resolve(__dirname, '..', '..', 'public', 'apps', 'vs-studio', 'fights-data');
const imagePattern = /\.(jpe?g|png|webp|avif)$/i;
const portraitPattern = /^([12])\.(jpe?g|png|webp|avif)$/i;
const sharedScansPattern = /(?:^|[\s._-])scans?\.json$/i;
const transparentGif = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const resolveSafeFightFolder = (folderKey) => {
  const normalizedKey = String(folderKey || '').trim().replace(/\\/g, '/');
  if (!normalizedKey) return null;

  const candidate = path.resolve(fightsRoot, normalizedKey);
  const relative = path.relative(fightsRoot, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
};

const cleanIndexValue = (value) =>
  String(value || '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim();

const parseFightImageIndex = (raw) => {
  const entries = [];
  let draft = { section: '', fileName: '' };

  const flush = () => {
    const fileName = cleanIndexValue(draft.fileName);
    const inferredSection = fileName.match(/_(\d+)_(\d+)_/);
    const section = cleanIndexValue(draft.section) ||
      (inferredSection ? `${Number(inferredSection[1])}.${Number(inferredSection[2])}` : '');
    if (fileName || section) entries.push({ section, fileName });
    draft = { section: '', fileName: '' };
  };

  String(raw || '').replace(/\r/g, '').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const sectionMatch =
      line.match(/^[-*]\s*Section:\s*`?([0-9]+(?:\.[0-9]+)?)(?:[^`]*)`?\s*$/i) ||
      line.match(/^[-*]\s*section:\s*`?([0-9]+(?:\.[0-9]+)?)(?:[^`]*)`?\s*$/i);
    if (sectionMatch) {
      if (draft.section || draft.fileName) flush();
      draft.section = sectionMatch[1];
      return;
    }

    const fileMatch =
      line.match(/^[-*]\s*Local filename:\s*`?(.+?)`?\s*$/i) ||
      line.match(/^[-*]\s*Local file:\s*`?(.+?)`?\s*$/i) ||
      line.match(/^[-*]\s*local_filename:\s*`?(.+?)`?\s*$/i) ||
      line.match(/^Local filename:\s*`?(.+?)`?\s*$/i);
    if (fileMatch) draft.fileName = fileMatch[1];
  });

  flush();
  return entries;
};

const listImageFiles = async (fightFolder) => {
  try {
    return (await readdir(path.join(fightFolder, 'img')))
      .filter((fileName) => imagePattern.test(fileName))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
  } catch {
    return [];
  }
};

const resolveIndexedImage = async (fightFolder, section, entryIndex) => {
  if (!section || !Number.isInteger(entryIndex) || entryIndex < 1) return '';

  try {
    const indexPayload = await readFile(path.join(fightFolder, 'img', 'index.md'), 'utf8');
    const indexed = parseFightImageIndex(indexPayload).filter(
      (entry) => entry.section === section && entry.fileName
    );
    if (indexed[entryIndex - 1]?.fileName) return indexed[entryIndex - 1].fileName;
  } catch {
    // Older fights use only the section markers encoded in filenames.
  }

  const sectionMatch = section.match(/^(\d+)\.(\d+)$/);
  if (!sectionMatch) return '';
  const matchingFiles = (await listImageFiles(fightFolder)).filter((fileName) =>
    fileName.includes(`_${sectionMatch[1]}_${sectionMatch[2]}_`)
  );
  return matchingFiles[entryIndex - 1] || '';
};

const findPortraitFiles = async (fightFolder) => {
  const rootFiles = await readdir(fightFolder);
  const first = rootFiles.find((fileName) => portraitPattern.test(fileName) && fileName.match(portraitPattern)?.[1] === '1');
  const second = rootFiles.find((fileName) => portraitPattern.test(fileName) && fileName.match(portraitPattern)?.[1] === '2');
  const fallbacks = rootFiles
    .filter((fileName) => imagePattern.test(fileName))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
  const portraitA = first || fallbacks[0] || '';
  const portraitB = second || fallbacks.find((fileName) => fileName !== portraitA) || '';
  return { portraitA, portraitB };
};

const sendTransparentImage = (res) => {
  res.type('gif');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(transparentGif);
};

const sendFightImage = async (res, fightFolder, fileName) => {
  if (!fileName || path.basename(fileName) !== fileName) return sendTransparentImage(res);

  for (const candidate of [path.join(fightFolder, 'img', fileName), path.join(fightFolder, fileName)]) {
    const relative = path.relative(fightsRoot, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
    try {
      await readFile(candidate);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.sendFile(candidate);
    } catch {
      // Try the root-level portrait after the img directory.
    }
  }

  return sendTransparentImage(res);
};

const readJsonFile = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const hydrateLiveFightSource = async (record, scansCache) => {
  if (!record || typeof record !== 'object') return record;

  const fightFolder = resolveSafeFightFolder(record.folderKey);
  const fileName = typeof record.fileName === 'string' ? record.fileName.trim() : '';
  if (!fightFolder || !fileName || path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith('.json')) {
    return record;
  }

  try {
    let scansJsonPromise = scansCache.get(fightFolder);
    if (!scansJsonPromise) {
      scansJsonPromise = readdir(fightFolder).then(async (files) => {
        const scansFileName = files.find((candidate) => sharedScansPattern.test(candidate));
        if (!scansFileName) throw new Error('Missing scans JSON.');
        return readJsonFile(path.join(fightFolder, scansFileName));
      });
      scansCache.set(fightFolder, scansJsonPromise);
    }

    const [localeJson, scansJson] = await Promise.all([
      readJsonFile(path.join(fightFolder, fileName)),
      scansJsonPromise,
    ]);
    return { ...record, liveSource: { localeJson, scansJson } };
  } catch {
    // Keep the last built payload while a file is partially written or invalid.
    return record;
  }
};

router.get('/scan', async (req, res) => {
  const layout = req.query.layout === 'mobile' ? 'mobile' : 'normal';
  try {
    const manifest = await readJsonFile(path.join(fightsRoot, `scan-${layout}.json`));
    const scansCache = new Map();
    const fights = Array.isArray(manifest.fights)
      ? await Promise.all(manifest.fights.map((record) => hydrateLiveFightSource(record, scansCache)))
      : [];
    res.set('Cache-Control', 'no-store').json({ ...manifest, fights });
  } catch (error) {
    res.status(503).json({ fights: [], warnings: ['VS Studio fight library is not built.'], error: String(error) });
  }
});

router.get('/image', async (req, res) => {
  const fightFolder = resolveSafeFightFolder(req.query.key);
  if (!fightFolder) return res.status(400).json({ error: 'Invalid fight folder.' });

  const requestedFile = String(req.query.file || '').trim();
  const section = String(req.query.section || '').trim();
  const entryIndex = Number(String(req.query.index || '').trim());
  const fileName = requestedFile || await resolveIndexedImage(fightFolder, section, entryIndex);
  return sendFightImage(res, fightFolder, fileName);
});

router.get('/asset', async (req, res) => {
  const fightFolder = resolveSafeFightFolder(req.query.key);
  const slot = String(req.query.slot || '');
  if (!fightFolder || !['1', '2'].includes(slot)) {
    return res.status(400).json({ error: 'Invalid fight asset request.' });
  }

  try {
    const { portraitA, portraitB } = await findPortraitFiles(fightFolder);
    return sendFightImage(res, fightFolder, slot === '1' ? portraitA : portraitB);
  } catch {
    return sendTransparentImage(res);
  }
});

router.get('/images', async (req, res) => {
  const fightFolder = resolveSafeFightFolder(req.query.key);
  if (!fightFolder) return res.status(400).json({ error: 'Invalid fight folder.' });

  const folderName = path.basename(fightFolder).replace(/^\d+\s+/, '');
  const [fighterA = '', fighterB = ''] = folderName.split(/\s+vs\.?\s+/i);
  const tokens = (value) => value.toLowerCase().split(/[^a-z0-9]+/i).filter((token) => token.length >= 3);
  const fighterATokens = tokens(fighterA);
  const fighterBTokens = tokens(fighterB);
  const files = (await listImageFiles(fightFolder)).map((fileName) => {
    const normalized = fileName.toLowerCase();
    const side = /_6_1_|_7_1_/.test(normalized)
      ? 'a'
      : /_6_2_|_7_2_/.test(normalized)
        ? 'b'
        : fighterATokens.some((token) => normalized.includes(token)) &&
            !fighterBTokens.some((token) => normalized.includes(token))
          ? 'a'
          : fighterBTokens.some((token) => normalized.includes(token)) &&
              !fighterATokens.some((token) => normalized.includes(token))
            ? 'b'
            : null;
    return { fileName, side };
  });

  return res.set('Cache-Control', 'no-store').json({ ok: true, key: String(req.query.key), files });
});

export default router;
