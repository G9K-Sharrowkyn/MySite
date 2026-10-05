const path = require('node:path');

const devServerConfigPath = require.resolve(
  'react-scripts/config/webpackDevServer.config.js'
);
const createDevServerConfig = require(devServerConfigPath);
const fightsDataPattern = path
  .resolve(__dirname, '..', 'public', 'apps', 'vs-studio', 'fights-data')
  .replace(/\\/g, '/');

require.cache[devServerConfigPath].exports = (...args) => {
  const config = createDevServerConfig(...args);
  const currentIgnored = config.static?.watch?.ignored;

  if (config.static?.watch) {
    config.static.watch.ignored = [
      ...(Array.isArray(currentIgnored) ? currentIgnored : currentIgnored ? [currentIgnored] : []),
      `${fightsDataPattern}/**`,
    ];
  }

  return config;
};

require('react-scripts/scripts/start.js');
