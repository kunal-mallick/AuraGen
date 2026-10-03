const babel = require('@babel/core');
const crypto = require('crypto');

function compile(source) {
  const { code } = babel.transformSync(source, {
    babelrc: false, configFile: false,
    presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  return { code, hash: crypto.createHash('sha256').update(code).digest('hex').slice(0, 16) };
}
module.exports = { compile };
