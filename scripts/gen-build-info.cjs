const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const outPath = path.join(repoRoot, 'src', 'buildInfo.generated.js');
const packageJsonPath = path.join(repoRoot, 'package.json');

const safeExec = (cmd) => {
  try {
    return String(execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch (_e) {
    return '';
  }
};

const main = () => {
  const githubSha = String(process.env.GITHUB_SHA || '').trim();
  const shortSha = safeExec('git rev-parse --short HEAD') || (githubSha ? githubSha.slice(0, 7) : '');
  const revCount = safeExec('git rev-list --count HEAD');
  const buildNumber = Number(revCount || 0);

  // Read version from package.json
  let version = 'v0.0.0';
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    version = packageJson.version.startsWith('v') ? packageJson.version : `v${packageJson.version}`;
  } catch (err) {
    console.error('Failed to read package.json version:', err.message);
  }

  const builtAt = new Date().toISOString();

  const contents = `// Generated at build time. Do not edit.
export const BUILD_INFO = Object.freeze({
  version: ${JSON.stringify(version)},
  buildNumber: ${JSON.stringify(buildNumber)},
  sha: ${JSON.stringify(shortSha)},
  builtAt: ${JSON.stringify(builtAt)}
});
`;

  fs.writeFileSync(outPath, contents, 'utf8');
};

main();

