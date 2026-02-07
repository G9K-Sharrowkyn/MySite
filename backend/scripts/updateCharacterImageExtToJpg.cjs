/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');

const files = [
  path.join(repoRoot, 'backend', 'scripts', 'characters.json'),
  path.join(repoRoot, 'backend', 'db.json')
];

const replaceInFile = (filePath) => {
  const buf = fs.readFileSync(filePath);
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = buf.toString('utf8');
  const body = hasBom ? text.slice(1) : text;

  const re = /\/characters\/([^\"\r\n]+?)\.(webp|png)(?=\")/g;
  let count = 0;
  const updated = body.replace(re, (_m, name) => {
    count += 1;
    return `/characters/${name}.jpg`;
  });

  if (!count) {
    return { filePath, count: 0, changed: false };
  }

  const out = hasBom ? `\ufeff${updated}` : updated;
  fs.writeFileSync(filePath, out, 'utf8');
  return { filePath, count, changed: true };
};

const main = () => {
  let total = 0;
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`Missing: ${filePath}`);
      continue;
    }
    const res = replaceInFile(filePath);
    console.log(`${path.relative(repoRoot, res.filePath)}: ${res.count} replacements`);
    total += res.count;
  }
  console.log(`Total replacements: ${total}`);
};

main();

