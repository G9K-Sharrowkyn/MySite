const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const swoopPackage = path.join(projectRoot, 'SR', 'package.json');

if (!existsSync(swoopPackage)) {
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['--prefix', 'SR', 'ci'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
