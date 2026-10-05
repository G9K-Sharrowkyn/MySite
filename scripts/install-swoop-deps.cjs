const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gameProjects = ['SR', 'Shooter'];

for (const gameProject of gameProjects) {
  const gamePackage = path.join(projectRoot, gameProject, 'package.json');
  if (!existsSync(gamePackage)) continue;

  const result = spawnSync(npmCommand, ['--prefix', gameProject, 'ci'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.exit(0);
