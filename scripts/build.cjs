const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('./prepare-native.cjs');

const env = { ...process.env };
if (fs.existsSync('/tmp/esbuild')) {
  env.ESBUILD_BINARY_PATH = '/tmp/esbuild';
}

const vitePath = path.join(__dirname, '../node_modules/vite/bin/vite.js');
const res = spawnSync(process.execPath, [vitePath, 'build'], {
  stdio: 'inherit',
  env,
});

process.exit(res.status || 0);
