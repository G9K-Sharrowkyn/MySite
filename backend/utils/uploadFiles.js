import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolveUploadsRoot = () =>
  path.resolve(
    String(process.env.UPLOADS_DIR || '').trim() ||
      path.join(backendRoot, 'uploads')
  );

export const getUploadsRoot = () => resolveUploadsRoot();
export const getUploadDirectory = (kind) => {
  const safeKind = String(kind || '').trim();
  if (!['avatars', 'backgrounds', 'characters'].includes(safeKind)) {
    throw new Error(`Unsupported upload directory: ${safeKind}`);
  }
  return path.join(resolveUploadsRoot(), safeKind);
};

const getUploadLocations = () =>
  new Map([
    ['/uploads/avatars/', getUploadDirectory('avatars')],
    ['/uploads/backgrounds/', getUploadDirectory('backgrounds')],
    ['/uploads/characters/', getUploadDirectory('characters')]
  ]);

export const verifyUploadStorage = async () => {
  if (
    process.env.NODE_ENV === 'production' &&
    !String(process.env.UPLOADS_DIR || '').trim()
  ) {
    throw new Error('UPLOADS_DIR is required in production.');
  }
  const root = getUploadsRoot();
  await Promise.all(
    ['avatars', 'backgrounds', 'characters'].map((kind) =>
      fs.mkdir(getUploadDirectory(kind), { recursive: true })
    )
  );
  const probe = path.join(
    root,
    `.write-probe-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  try {
    await fs.writeFile(probe, 'ok', { flag: 'wx' });
  } finally {
    await fs.unlink(probe).catch(() => {});
  }
  return root;
};

export const removeManagedUpload = async (publicPath) => {
  if (typeof publicPath !== 'string') return false;

  const location = [...getUploadLocations().entries()].find(([prefix]) =>
    publicPath.startsWith(prefix)
  );
  if (!location) return false;

  const [prefix, directory] = location;
  const filename = publicPath.slice(prefix.length);
  if (!filename || path.basename(filename) !== filename) return false;

  const resolvedDirectory = path.resolve(directory);
  const resolvedFile = path.resolve(resolvedDirectory, filename);
  if (!resolvedFile.startsWith(`${resolvedDirectory}${path.sep}`)) return false;

  try {
    await fs.unlink(resolvedFile);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

export const removeManagedUploads = async (publicPaths) => {
  const uniquePaths = Array.from(new Set((publicPaths || []).filter(Boolean)));
  const results = await Promise.allSettled(uniquePaths.map(removeManagedUpload));
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  return results.filter((result) => result.value === true).length;
};
