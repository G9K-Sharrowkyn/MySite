const { cpSync, existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const studioRoot = process.env.VS_GRAPHIC_STUDIO_DIR
  ? path.resolve(process.env.VS_GRAPHIC_STUDIO_DIR)
  : path.resolve(projectRoot, '..', '..', 'YT', 'VS', 'App', 'vs-graphic-studio');
const viteEntry = path.join(studioRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const outputDir = path.join(projectRoot, 'public', 'apps', 'vs-studio');
const outputEntry = path.join(outputDir, 'index.html');

const keepStaticBuildOrFail = (message) => {
  if (existsSync(outputEntry)) {
    console.log(`[vs-studio] ${message}; using the existing static build.`);
    process.exit(0);
  }

  console.error(`[vs-studio] ${message}, and no static build exists at ${outputEntry}.`);
  process.exit(1);
};

if (!existsSync(path.join(studioRoot, 'package.json'))) {
  keepStaticBuildOrFail(`Source checkout not found at ${studioRoot}`);
}

if (!existsSync(viteEntry)) {
  keepStaticBuildOrFail(`Vite is not installed in ${studioRoot}`);
}

const result = spawnSync(
  process.execPath,
  [viteEntry, 'build', '--base=/apps/vs-studio/', `--outDir=${outputDir}`, '--emptyOutDir'],
  {
    cwd: studioRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

for (const directoryName of ['search', 'anime']) {
  const sourceDirectory = path.join(studioRoot, directoryName);
  if (existsSync(sourceDirectory)) {
    cpSync(sourceDirectory, path.join(outputDir, directoryName), { recursive: true });
  }
}

// Older template definitions intentionally use root-absolute /assets URLs.
// Keep those URLs working when the Studio is embedded below /apps/vs-studio/.
const sharedAssetsDirectory = path.join(studioRoot, 'public', 'assets');
if (existsSync(sharedAssetsDirectory)) {
  cpSync(sharedAssetsDirectory, path.join(projectRoot, 'public', 'assets'), { recursive: true });
}
