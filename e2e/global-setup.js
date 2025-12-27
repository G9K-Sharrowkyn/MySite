const fs = require('fs/promises');
const path = require('path');

module.exports = async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const templatePath = path.join(projectRoot, 'e2e', 'fixtures', 'db.e2e.template.json');
  const targetDir = path.join(projectRoot, 'backend', '.tmp');
  const targetPath = path.join(targetDir, 'db.e2e.json');

  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(templatePath, targetPath);
};
