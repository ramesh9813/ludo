const fs = require('fs');
const path = require('path');

const esbuildSrc = path.join(__dirname, '../node_modules/@esbuild/linux-arm64/bin/esbuild');
if (fs.existsSync(esbuildSrc) && !fs.existsSync('/tmp/esbuild')) {
  try {
    fs.copyFileSync(esbuildSrc, '/tmp/esbuild');
    fs.chmodSync('/tmp/esbuild', 0o755);
  } catch (e) {}
}

const rollupSrc = path.join(__dirname, '../node_modules/@rollup/rollup-linux-arm64-gnu/rollup.linux-arm64-gnu.node');
if (fs.existsSync(rollupSrc) && !fs.existsSync('/tmp/rollup.node')) {
  try {
    fs.copyFileSync(rollupSrc, '/tmp/rollup.node');
  } catch (e) {}
}

const rollupNative = path.join(__dirname, '../node_modules/rollup/dist/native.js');
if (fs.existsSync(rollupNative)) {
  let content = fs.readFileSync(rollupNative, 'utf8');
  if (!content.includes('/tmp/rollup.node')) {
    content = content.replace(
      "return require(id);\n\t} catch (error) {",
      "return require(id);\n\t} catch (error) {\n\t\tif (require('fs').existsSync('/tmp/rollup.node')) {\n\t\t\ttry { return require('/tmp/rollup.node'); } catch {}\n\t\t}"
    );
    fs.writeFileSync(rollupNative, content);
  }
}
