// usage: node tools/sizes.js [n] -- the longest top-level functions in game/src (lines), with their file
const fs = require('fs'), path = require('path');
let acorn;
try {
  acorn = require('acorn');
} catch {
  acorn = require('/opt/node-tools/node_modules/acorn');
}
const dir = path.join(__dirname, '..', 'game', 'src');
const out = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const n of acorn.parse(src, { ecmaVersion: 2022, locations: true, allowReturnOutsideFunction: true }).body)
    if (n.type === 'FunctionDeclaration') out.push([n.loc.end.line - n.loc.start.line + 1, n.id.name, f]);
}
out.sort((a, b) => b[0] - a[0]);
for (const [l, n, f] of out.slice(0, +(process.argv[2] || 30))) console.log(String(l).padStart(5), n.padEnd(22), f);
console.log(out.length, 'functions');
