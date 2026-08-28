import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const UPLOAD_LOCATIONS = new Map([
  ['/uploads/avatars/', path.join(backendRoot, 'uploads', 'avatars')],
  ['/uploads/backgrounds/', path.join(backendRoot, 'uploads', 'backgrounds')],
  ['/uploads/characters/', path.join(backendRoot, 'uploads', 'characters')]
]);

export const removeManagedUpload = async (publicPath) => {
  if (typeof publicPath !== 'string') return false;

  const location = [...UPLOAD_LOCATIONS.entries()].find(([prefix]) =>
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
