/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.join(__dirname, '..', '..');
const charactersDir = path.join(repoRoot, 'public', 'characters');
const thumbsDir = path.join(charactersDir, 'thumbs');

const OUTPUT_QUALITY = 90;
const PNG_BG = '#0b0f16';

const isConvertible = (file) => {
  const ext = path.extname(file).toLowerCase();
  return ext === '.webp' || ext === '.png';
};

const toJpgPath = (dir, file) =>
  path.join(dir, `${path.basename(file, path.extname(file))}.jpg`);

const convertOne = async (dir, file) => {
  const src = path.join(dir, file);
  const dest = toJpgPath(dir, file);

  if (fs.existsSync(dest)) {
    return { file, status: 'exists' };
  }

  const input = fs.readFileSync(src);
  const ext = path.extname(file).toLowerCase();

  let pipeline = sharp(input, { failOnError: false }).rotate();

  if (ext === '.png') {
    // JPG has no alpha: composite over a dark background that matches the site/share palette.
    pipeline = pipeline.flatten({ background: PNG_BG });
  }

  const jpg = await pipeline
    .jpeg({
      quality: OUTPUT_QUALITY,
      mozjpeg: true
    })
    .toBuffer();

  fs.writeFileSync(dest, jpg);
  return { file, status: 'converted' };
};

const main = async () => {
  if (!fs.existsSync(charactersDir)) {
    throw new Error(`Missing characters dir: ${charactersDir}`);
  }

  const jobs = [];
  const rootFiles = fs.readdirSync(charactersDir).filter(isConvertible);
  rootFiles.sort((a, b) => a.localeCompare(b));
  jobs.push({ dir: charactersDir, files: rootFiles, label: 'characters' });

  if (fs.existsSync(thumbsDir)) {
    const thumbFiles = fs.readdirSync(thumbsDir).filter(isConvertible);
    thumbFiles.sort((a, b) => a.localeCompare(b));
    jobs.push({ dir: thumbsDir, files: thumbFiles, label: 'thumbs' });
  }

  let converted = 0;
  let skipped = 0;

  for (const job of jobs) {
    for (const file of job.files) {
      // eslint-disable-next-line no-await-in-loop
      const result = await convertOne(job.dir, file);
      if (result.status === 'converted') converted += 1;
      else skipped += 1;
    }
  }

  console.log(`Converted: ${converted}`);
  console.log(`Skipped (already had .jpg): ${skipped}`);
  console.log('Done.');
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
