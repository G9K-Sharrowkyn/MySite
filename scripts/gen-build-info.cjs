const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const outPath = path.join(repoRoot, 'src', 'buildInfo.generated.js');

const safeExec = (cmd) => {
  try {
    return String(execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch (_e) {
    return '';
  }
};

const main = () => {
  const githubRun = String(process.env.GITHUB_RUN_NUMBER || '').trim();
  const githubSha = String(process.env.GITHUB_SHA || '').trim();

  const revCount = safeExec('git rev-list --count HEAD');
  const shortSha = safeExec('git rev-parse --short HEAD') || (githubSha ? githubSha.slice(0, 7) : '');

  const numeric = Number(githubRun || revCount || 0);
  const buildNumber = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;

  const version = `v0.${buildNumber}`;
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

