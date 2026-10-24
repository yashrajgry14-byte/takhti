/* ==================================================================
   CODEBASE HYGIENE — three things that drifted once and must not again.

   1. NO DEAD CODE. Every top-level function and constant in the app must
      be reachable from what a real session runs (test/_helpers/
      reachability.js). A whole cartoon system, the teacher diagnostic,
      a duplicate recorder and a never-drawn mascot once sat in the repo,
      individually tested, impossible to reach.
   2. THE OFFLINE CACHE MATCHES THE PAGE. sw.js's SHELL must list exactly
      the scripts and stylesheets index.html loads, in the same order —
      a file missing from SHELL silently never works offline.
   3. NO ORPHAN FILES. Every .js under src/ is loaded by index.html, and
      every script index.html names exists.
   ================================================================== */
const fs = require('fs'), path = require('path');
const { findUnreachable } = require('./_helpers/reachability.js');

const root = path.resolve(__dirname, '..');
let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const { total, dead } = findUnreachable(root);
console.log(`reachability: ${total - dead.length}/${total} top-level definitions reachable`);
check('no unreachable code — every top-level function/constant can run in a real session',
  dead.length === 0, dead.map(d => `${d.file}:${d.line} ${d.name}`).join(', '));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pageScripts = [...html.matchAll(/<script src="(src\/[^"]+\.js)"/g)].map(m => './' + m[1]);
const pageStyles = [...html.matchAll(/<link[^>]+href="(src\/[^"]+\.css)"/g)].map(m => './' + m[1]);
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const shell = sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];', sw.indexOf('const SHELL')));
const shellSrc = [...shell.matchAll(/'(\.\/src\/[^']+)'/g)].map(m => m[1]);
check("sw.js's SHELL lists exactly index.html's stylesheets and scripts, in the same order",
  JSON.stringify(shellSrc) === JSON.stringify([...pageStyles, ...pageScripts]),
  `missing from SHELL: ${JSON.stringify([...pageStyles, ...pageScripts].filter(x => !shellSrc.includes(x)))} · extra in SHELL: ${JSON.stringify(shellSrc.filter(x => ![...pageStyles, ...pageScripts].includes(x)))}`);

const onDisk = [];
(function walk(d){ for(const f of fs.readdirSync(d)){ const p = path.join(d, f);
  if(fs.statSync(p).isDirectory()) walk(p); else if(p.endsWith('.js')) onDisk.push('./' + path.relative(root, p).replace(/\\/g, '/')); } })(path.join(root, 'src'));
const orphans = onDisk.filter(f => !pageScripts.includes(f));
const missing = pageScripts.filter(f => !onDisk.includes(f));
check('every .js file under src/ is loaded by index.html (no orphan files)', orphans.length === 0, JSON.stringify(orphans));
check('every script index.html loads exists on disk', missing.length === 0, JSON.stringify(missing));

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length - failures}/${checks.length} checks passed`);
process.exitCode = failures ? 1 : 0;
