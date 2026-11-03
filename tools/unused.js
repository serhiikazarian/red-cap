// usage: node tools/unused.js  -- top-level names in game/src that nothing else uses (candidates for removal)
const fs = require('fs'), path = require('path');
const acorn = require('./acorn');
const dir = path.join(__dirname, '..', 'game', 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const all = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ast = acorn.parse(all, { ecmaVersion: 2022, sourceType: 'script' });
const names = [];
for (const n of ast.body) {
  if (n.type === 'FunctionDeclaration') names.push(n.id.name);
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') names.push(d.id.name);
}
const words = {};
for (const w of all.match(/[A-Za-z_$][\w$]*/g)) words[w] = (words[w] || 0) + 1;
const html = fs.readFileSync(path.join(dir, '..', 'index.html'), 'utf8');
for (const n of names) if (words[n] === 1 && !html.includes(n)) console.log(n);
