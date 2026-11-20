/* ==================================================================
   CLASS SYNC — api/class-sync.mjs (the real merge, with an in-memory
   store in place of Netlify Blobs) and src/core/class-sync.js on two
   simulated phones whose fetch() reaches it.

   Proves: nothing about a child leaves the phone until a parent switches
   sync on; with consent, the teacher's phone gets the child and the
   child's phone gets the homework — and its withdrawal; each class syncs
   once an hour, not on every check; offline and a server with no storage
   are handled calmly with no data touched; the server accepts only what
   it should.
   ================================================================== */
const fs = require('fs'), vm = require('vm'), path = require('path');
const { pathToFileURL } = require('url');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

(async () => {
  const { syncCore, default: handler } = await import(pathToFileURL(path.resolve(__dirname, '../api/class-sync.mjs')).href);

  /* the "server": the real merge over a shared in-memory store */
  const blobs = new Map();
  const store = { get: async k => blobs.has(k) ? JSON.parse(blobs.get(k)) : null, setJSON: async (k, v) => { blobs.set(k, JSON.stringify(v)); } };
  let serverUp = true, fetches = 0;
  const fetchStub = async (url, opts) => {
    fetches++;
    if(!serverUp) return { ok:false, status:503, json: async () => ({}) };
    const out = await syncCore(store, JSON.parse(opts.body));
    return { ok: out.status === 200, status: out.status, json: async () => out.json };
  };

  const LOAD_LIST = ['src/state.js','src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
    'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
    'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
    'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js','src/content/comprehension.js',
    'src/core/diagnose.js','src/core/class-share.js','src/core/class-sync.js','src/core/mathgen.js',
    'src/core/log.js','src/core/store.js','src/core/profiles.js'];
  function phone(){
    const data = {};
    const ctx = { console, Intl, setTimeout, clearTimeout, setInterval: () => 0, crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob,
      localStorage: { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
      navigator: { onLine: true }, fetch: fetchStub, window: { addEventListener(){} },
      document: { getElementById: () => ({ appendChild(){}, classList:{ add(){}, remove(){} } }), createElement: () => ({}) } };
    vm.createContext(ctx);
    for(const f of LOAD_LIST) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename:f });
    vm.runInContext(`globalThis.__ = { S, createProfile, noteSkillAttempt, syncClass, syncDue, syncStatusLine,
      readClassShared, assignHomework, clearHomework, getAssignedHomework, tDiagnose, mirrorToClassNow, newTeacherKey,
      setSchoolClass, schoolClassOf, bandFor, homeworkCode, importHomework, syncProfileOut };`, ctx);
    return { X: ctx.__, ctx };
  }

  /* ---- the child's phone ---- */
  const kid = phone(), K = kid.X;
  K.createProfile('Meera');
  K.S.classCode = 'ABC123';
  for(const ok of [1,0,0,1,0,0,1,0,0,0]) K.noteSkillAttempt('tables', !!ok, K.S);
  K.mirrorToClassNow(K.S);
  await K.syncClass('ABC123');
  check('without a parent\'s consent, nothing about the child reaches the server', !blobs.get('class-ABC123') || !Object.keys(JSON.parse(blobs.get('class-ABC123')).children).length, blobs.get('class-ABC123'));
  check('…and with no consent, the class isn\'t even on the automatic list', !(await K.syncDue(true)) && fetches === 1, `fetches ${fetches}`);

  K.S.syncOn = true;
  await K.syncClass('ABC123');
  const onServer = JSON.parse(blobs.get('class-ABC123')).children[K.S.id];
  check('with consent, the child\'s name and practice counts reach the class', onServer && onServer.childName === 'Meera' && onServer.skillHistory.tables.n === 10, JSON.stringify(onServer));
  check('…and nothing else from the profile (no photos, levels, voice, sentences)', Object.keys(onServer).sort().join() === 'at,childName,skillHistory', Object.keys(onServer).join());

  /* ---- the teacher's phone ---- */
  const tch = phone(), T = tch.X;
  T.S.syncClasses = ['ABC123'];
  T.S.syncKeys = { ABC123: T.newTeacherKey() };
  await T.syncDue();
  check("the teacher's phone, on its hourly sync, gets the child from the other phone", T.readClassShared('ABC123')[K.S.id] && T.readClassShared('ABC123')[K.S.id].skillHistory.tables.n === 10, JSON.stringify(T.readClassShared('ABC123')));
  const res = T.tDiagnose(['bodmas'], [{ id: K.S.id, name:'Meera', skillHistory:{} }], 'ABC123');
  check("…and the class diagnosis uses that child's real evidence", res[0].guesswork === false && res[0].plan.some(p => p.skill.id === 'tables' && p.verdict === 'gap'), JSON.stringify(res[0].plan.map(p => p.skill.id + ':' + p.verdict)));
  check('the status line says when it last synced', /Last synced \d/.test(T.syncStatusLine('ABC123')), T.syncStatusLine('ABC123'));

  /* ---- who may see and set what ---- */
  const kid2 = phone(), K2 = kid2.X;
  K2.createProfile('Ravi'); K2.S.classCode = 'ABC123'; K2.S.syncOn = true;
  K2.noteSkillAttempt('add2', true, K2.S); K2.mirrorToClassNow(K2.S);
  await K2.syncClass('ABC123');
  check("a child's phone gets back only its own record — never a classmate's", !K2.readClassShared('ABC123')[K.S.id], Object.keys(K2.readClassShared('ABC123')).join());
  await T.syncClass('ABC123');
  check("…while the teacher's phone gets the whole class", !!T.readClassShared('ABC123')[K.S.id] && !!T.readClassShared('ABC123')[K2.S.id], Object.keys(T.readClassShared('ABC123')).join());
  K2.assignHomework('ABC123', ['bodmas'], 'fake homework from a parent phone');
  await K2.syncClass('ABC123');
  check("a parent's phone can't set homework for the class", !JSON.parse(blobs.get('class-ABC123')).homework, JSON.stringify(JSON.parse(blobs.get('class-ABC123')).homework));
  const other = phone(), O = other.X;
  O.S.syncClasses = ['ABC123']; O.S.syncKeys = { ABC123: O.newTeacherKey() };
  await O.syncClass('ABC123');
  check("another phone can't take over a class already claimed by its teacher", !O.readClassShared('ABC123')[K.S.id] && /another teacher/.test(O.syncStatusLine('ABC123')), O.syncStatusLine('ABC123'));
  check('the server stores only a hash of the teacher key, never the key', !blobs.get('class-ABC123').includes(T.S.syncKeys.ABC123), 'key stored');

  /* ---- homework, and its withdrawal, travel back ---- */
  T.assignHomework('ABC123', ['tables'], 'Practise tables');
  await T.syncClass('ABC123');
  await K.syncDue(true);
  const hw = K.getAssignedHomework(K.S);
  check("the teacher's homework reaches the child's phone", hw && hw.skills[0] === 'tables' && hw.note === 'Practise tables', JSON.stringify(hw));
  check('…with the same assignment timestamp, so "finished" means the same homework everywhere', hw.assignedAt === T.readClassShared('ABC123')._homework.assignedAt, `${hw.assignedAt}`);
  for(const t0 = Date.now(); Date.now() <= t0 + 2;);
  T.clearHomework('ABC123');
  await T.syncClass('ABC123');
  await K.syncDue(true);
  check('withdrawing the homework reaches the child\'s phone too (it isn\'t brought back by the older copy)', K.getAssignedHomework(K.S) === null, JSON.stringify(K.readClassShared('ABC123')._homework));

  /* ---- the school's roster sets the class ---- */
  K.S.cls = 'c2'; K2.S.cls = 'c3';                      // what each family picked at onboarding
  T.setSchoolClass('ABC123', 'c5');                      // the teacher: this is Class 5
  T.setSchoolClass('ABC123', 'c4', K2.S.id);             // …and Ravi is in Class 4
  await T.syncClass('ABC123');
  await K.syncClass('ABC123'); await K2.syncClass('ABC123');
  check("the teacher's class reaches a child's phone with the sync: Meera is now Class 5, set by the school",
    K.S.cls === 'c5' && K.S.clsBy === 'school' && K.bandFor(K.S).id === 'fluent', `${K.S.cls} / ${K.S.clsBy} / ${K.bandFor(K.S).id}`);
  check("one child's own class from the teacher wins over the class's: Ravi is Class 4", K2.S.cls === 'c4' && K2.S.clsBy === 'school', `${K2.S.cls} / ${K2.S.clsBy}`);
  const kr = K.readClassShared('ABC123')._roster;
  check("a child's phone sees the class's grade and its own entry only — never a classmate's",
    kr && kr.cls === 'c5' && !(kr.kids || {})[K2.S.id], JSON.stringify(kr));
  check("…while the teacher's phone keeps every child's entry", (T.readClassShared('ABC123')._roster.kids || {})[K2.S.id] === 'c4', JSON.stringify(T.readClassShared('ABC123')._roster));
  K2.S.syncKeys = {};
  const fakeRoster = await syncCore(store, { code:'ABC123', roster:{ cls:'c1', kids:{}, at: Date.now() + 1e6 } });
  check('a phone without the teacher key cannot change the roster', JSON.parse(blobs.get('class-ABC123')).roster.cls === 'c5', JSON.stringify(fakeRoster.json.roster));
  await new Promise(r => setTimeout(r, 5));
  const junk = await syncCore(store, { code:'ABC123', teacherKey: T.S.syncKeys.ABC123, roster:{ cls:'class 99', kids:{ x:'<b>', _y:'c3', ok:'c7' }, at: Date.now() } });
  const stored = JSON.parse(blobs.get('class-ABC123')).roster;
  check('the server keeps only real class ids in the roster', stored.cls === null && Object.keys(stored.kids).join() === 'ok' && stored.kids.ok === 'c7', JSON.stringify(stored));
  await new Promise(r => setTimeout(r, 5));
  T.setSchoolClass('ABC123', 'c5'); T.setSchoolClass('ABC123', 'c4', K2.S.id); await T.syncClass('ABC123');   // put it back
  await K.syncClass('ABC123');
  check('a newer roster from the teacher replaces the one the server tidied', K.S.cls === 'c5' && K.S.clsBy === 'school' && JSON.parse(blobs.get('class-ABC123')).roster.cls === 'c5', `${K.S.cls} / ${K.S.clsBy}`);

  /* the homework code carries the class's grade to a phone that never syncs */
  T.assignHomework('ABC123', ['tables'], 'grade check');
  const hwc = T.homeworkCode('ABC123');
  const kid3 = phone(), K3 = kid3.X;
  K3.createProfile('Asha'); K3.S.cls = 'c2';
  const imp = K3.importHomework(hwc);
  check("the homework code links a child with no sync and sets the class's grade from the school", imp.ok && K3.S.cls === 'c5' && K3.S.clsBy === 'school', `${JSON.stringify(imp)} / ${K3.S.cls} / ${K3.S.clsBy}`);
  check("…the grade only — one child's own class doesn't travel in a code everyone gets", !Object.keys((K3.readClassShared('ABC123')._roster || {}).kids || {}).length, JSON.stringify(K3.readClassShared('ABC123')._roster));

  /* the teacher clears the class: the class stays, the family may change it again */
  T.setSchoolClass('ABC123', null); T.setSchoolClass('ABC123', null, K2.S.id); await T.syncClass('ABC123');
  await K.syncClass('ABC123');
  check('when the teacher clears the class, the child keeps Class 5 and the parent may change it again', K.S.cls === 'c5' && K.S.clsBy === null, `${K.S.cls} / ${K.S.clsBy}`);
  T.setSchoolClass('ABC123', 'c5'); T.setSchoolClass('ABC123', 'c4', K2.S.id); await T.syncClass('ABC123');
  await K.syncClass('ABC123'); await K2.syncClass('ABC123');

  /* ---- once an hour ---- */
  const before = fetches;
  await K.syncDue();
  check('a class synced in the last hour is not synced again on the next check', fetches === before, `${fetches - before} extra`);
  K.S.syncAt.ABC123 = Date.now() - 61 * 60 * 1000;
  await K.syncDue();
  check('…but is, once the hour is up', fetches === before + 1, `${fetches - before}`);

  /* ---- offline, and a server with no storage ---- */
  kid.ctx.navigator.onLine = false;
  const f0 = fetches;
  check('offline: no request is attempted', (await K.syncClass('ABC123')) === false && fetches === f0, `${fetches - f0}`);
  check('…and the status says it will sync when connected', /No connection/.test(K.syncStatusLine('ABC123')), K.syncStatusLine('ABC123'));
  kid.ctx.navigator.onLine = true;
  serverUp = false;
  const snapshot = JSON.stringify(K.readClassShared('ABC123'));
  check('a server with no sync storage is handled calmly — nothing changes on the phone', (await K.syncClass('ABC123')) === false && JSON.stringify(K.readClassShared('ABC123')) === snapshot, 'changed');
  check('…and the status says sync isn\'t set up, rather than an error', /isn't set up/.test(K.syncStatusLine('ABC123')), K.syncStatusLine('ABC123'));
  serverUp = true;

  /* ---- what the server accepts ---- */
  check('the server refuses a malformed class code', (await syncCore(store, { code:'bad' })).status === 400, 'accepted');
  const s1 = await syncCore(store, { code:'XYZ789', teacherKey:'t'.repeat(32), children:{
    'c-a': { childName:'A'.repeat(200), skillHistory:{ tables:{ n:5, right:9 }, 'Bad Id!':{ n:1, right:1 } }, at:1, photos:['x'] },
    '_homework': { childName:'sneaky' } } });
  const a = s1.json.children['c-a'];
  check('the server keeps only a capped name and well-formed counts (right ≤ tries), and drops extra fields', a.childName.length === 40 && a.skillHistory.tables.right === 5 && !a.skillHistory['Bad Id!'] && !a.photos, JSON.stringify(a));
  check('…and a reserved id can\'t be smuggled in as a child', !s1.json.children._homework, Object.keys(s1.json.children).join());
  const older = await syncCore(store, { code:'XYZ789', teacherKey:'t'.repeat(32), children:{ 'c-a': { childName:'Old', skillHistory:{}, at:0 } } });
  check('an older record never overwrites a newer one on the server', older.json.children['c-a'].childName !== 'Old', older.json.children['c-a'].childName);

  /* ---- the HTTP wrapper ---- */
  const get = await handler(new Request('http://x/api/class-sync'), {});
  check('the function only accepts POST', get.status === 405, get.status);
  const bad = await handler(new Request('http://x/api/class-sync', { method:'POST', body:'{nope' }), {});
  check('…and rejects a body that isn\'t JSON', bad.status === 400, bad.status);
  let vStatus = 0; const vres = { status(c){ vStatus = c; return this; }, json(){ return this; } };
  await handler({ method:'POST', body:{ code:'ABC123' } }, vres);
  check('with no blob store configured (outside Netlify), it answers 503 under either calling convention, and the app carries on', vStatus === 503, `${vStatus}`);

  console.log('-'.repeat(70));
  checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exitCode = failures ? 1 : 0;
})();
