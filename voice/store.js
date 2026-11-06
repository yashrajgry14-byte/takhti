/* ==================================================================
   STORAGE — one JSON file per record, behind get / put / list.

   Same idea as src/core/store.js: callers never touch the disk, so a
   hosted deployment can swap this for a KV store or Postgres without
   changing anything else. Fine for a pilot of a few hundred children
   on one small server; not for a serverless host with no disk.

   Writes are atomic (temp file + rename) so a crash mid-write never
   leaves half a child's record behind.
   ================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

function createStore(dir) {
  const root = path.resolve(dir || path.join(__dirname, 'data'));
  const safe = id => { if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(id))) throw new Error('bad id'); return String(id); };
  const file = (col, id) => path.join(root, safe(col), safe(id) + '.json');

  function get(col, id) {
    try { return JSON.parse(fs.readFileSync(file(col, id), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT' || e.message === 'bad id') return null; throw e; }
  }
  function put(col, id, doc) {
    const f = file(col, id);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 1));
    fs.renameSync(tmp, f);
    return doc;
  }
  function list(col) {
    const d = path.join(root, safe(col));
    let names = [];
    try { names = fs.readdirSync(d).filter(n => n.endsWith('.json')); } catch (e) { return []; }
    return names.map(n => get(col, n.slice(0, -5))).filter(Boolean);
  }
  function remove(col, id) {
    try { fs.unlinkSync(file(col, id)); return true; } catch (e) { return false; }
  }
  return { get, put, list, remove, root };
}

module.exports = { createStore };
