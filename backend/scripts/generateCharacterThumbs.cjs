/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.join(__dirname, '..', '..');
const charactersDir = path.join(repoRoot, 'public', 'characters');
const thumbsDir = path.join(charactersDir, 'thumbs');

const THUMB_MAX_W = 480;
const THUMB_MAX_H = 480;
const QUALITY = 80;

const main = async () => {
  if (!fs.existsSync(charactersDir)) {
    throw new Error(`Missing: ${charactersDir}`);
  }
  fs.mkdirSync(thumbsDir, { recursive: true });

  const files = fs
    .readdirSync(charactersDir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => path.extname(name).toLowerCase() === '.jpg');

  files.sort((a, b) => a.localeCompare(b));

  let written = 0;
  for (const file of files) {
    const src = path.join(charactersDir, file);
    const dest = path.join(thumbsDir, file);

    // eslint-disable-next-line no-await-in-loop
    const out = await sharp(src, { failOnError: false })
      .rotate()
      .resize({
        width: THUMB_MAX_W,
        height: THUMB_MAX_H,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(dest, out);
    written += 1;
  }

  console.log(`Generated thumbs: ${written}`);
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

