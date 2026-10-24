/* ==================================================================
   REACHABILITY — which top-level functions/constants can actually run.

   Starts from what a real session executes: every top-level statement
   in index.html's own load order (the boot code in app.js, registrations
   like `VIEWS.map = jungleMapHTML`, event wiring) plus identifiers used
   in index.html's own markup. From there it follows:
     · identifier references in code
     · identifiers inside string/template text — the views render
       onclick="startLesson('x')" as text, so a handler is reachable
       exactly when the HTML naming it is
     · string literals that name a screen (go('teacher'), screen:'read')
       → that screen's VIEWS entry and AFTER hook
   Anything never reached is dead: defined, maybe even tested in
   isolation, but impossible for a child or parent to trigger.

   Deliberately an over-approximation (a word in a sentence that happens
   to match a function name counts as a reference), so a reported dead
   function is genuinely dead; a live result is "reachable as far as a
   static pass can tell".
   ================================================================== */
const acorn = require('acorn'), walk = require('acorn-walk');
const fs = require('fs'), path = require('path');

function findUnreachable(root){
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const order = [...html.matchAll(/<script src="(src\/[^"]+\.js)"/g)].map(m => m[1]);

  const nodes = new Map(), screens = new Map();
  const rootRefs = new Set(), rootStrs = new Set();
  const node = (name, file, line) => {
    if(!nodes.has(name)) nodes.set(name, { file, line, refs:new Set(), strs:new Set() });
    return nodes.get(name);
  };
  const addScreen = (s, n) => { if(!screens.has(s)) screens.set(s, new Set()); screens.get(s).add(n); };
  const ID = /[A-Za-z_$][\w$]*/g;
  function collect(ast, into){
    walk.full(ast, n => {
      if(n.type === 'Identifier') into.refs.add(n.name);
      else if(n.type === 'Literal' && typeof n.value === 'string'){
        into.strs.add(n.value);
        for(const m of n.value.match(ID) || []) into.refs.add(m);
      } else if(n.type === 'TemplateElement'){
        const v = n.value.cooked || '';
        for(const m of v.match(ID) || []) into.refs.add(m);
        for(const m of v.match(/'([\w-]+)'/g) || []) into.strs.add(m.slice(1, -1));
      } else if(n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier'){
        into.refs.add(n.property.name);
      }
    });
  }
  const rootSink = { refs: rootRefs, strs: rootStrs };

  for(const f of order){
    const ast = acorn.parse(fs.readFileSync(path.join(root, f), 'utf8'), { ecmaVersion:'latest', locations:true });
    for(const st of ast.body){
      if(st.type === 'FunctionDeclaration'){ collect(st.body, node(st.id.name, f, st.loc.start.line)); continue; }
      if(st.type === 'VariableDeclaration'){
        for(const d of st.declarations){
          if(d.id.type !== 'Identifier'){ collect(d, rootSink); continue; }
          const nm = d.id.name;
          if((nm === 'VIEWS' || nm === 'AFTER') && d.init && d.init.type === 'ObjectExpression'){
            node(nm, f, d.loc.start.line);
            for(const p of d.init.properties){
              const key = p.key.name || p.key.value, nn = `${nm}.${key}`;
              collect(p.value, node(nn, f, p.loc.start.line)); addScreen(key, nn);
            }
          } else if(d.init){
            collect(d.init, node(nm, f, d.loc.start.line));
          } else node(nm, f, d.loc.start.line);
        }
        continue;
      }
      const regs = [];
      walk.simple(st, { AssignmentExpression(a){
        if(a.left.type === 'MemberExpression' && /^(VIEWS|AFTER)$/.test(a.left.object.name || '')) regs.push(a);
      }});
      if(regs.length){
        for(const a of regs){
          const key = a.left.property.name, nn = `${a.left.object.name}.${key}`;
          collect(a.right, node(nn, f, a.loc.start.line)); addScreen(key, nn);
        }
        continue;
      }
      collect(st, rootSink);
    }
  }
  for(const m of html.replace(/<script[\s\S]*?<\/script>/g, '').match(ID) || []) rootRefs.add(m);

  const live = new Set(), queue = [];
  const mark = n => { if(nodes.has(n) && !live.has(n)){ live.add(n); queue.push(n); } };
  const markStr = s => { if(screens.has(s)) for(const n of screens.get(s)) mark(n); };
  rootRefs.forEach(mark); rootStrs.forEach(markStr);
  while(queue.length){ const n = nodes.get(queue.shift()); n.refs.forEach(mark); n.strs.forEach(markStr); }

  return {
    total: nodes.size,
    dead: [...nodes.entries()].filter(([k]) => !live.has(k)).map(([k, v]) => ({ name:k, file:v.file, line:v.line }))
  };
}

module.exports = { findUnreachable };
