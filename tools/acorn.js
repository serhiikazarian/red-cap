// acorn, the JavaScript parser the tools read game/src with: the copy that comes with the globally installed eslint
const root = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim();
module.exports = require(require.resolve('acorn', { paths: [require.resolve('eslint', { paths: [root] })] }));
