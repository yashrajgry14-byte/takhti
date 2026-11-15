/* ==================================================================
   THE LESSON LIBRARY, on the phone — content/library.js is built ahead by
   tools/build-library.mjs (Gemini drafts every chapter of a school's book,
   Takhti's checker keeps the lessons that pass) and shipped in the offline
   shell.

   The teacher picks the class's book once; its chapters make the term, in
   the book's order, which the teacher can move to the school's own
   calendar. This week's chapter opens its ready lessons in the same card a
   teacher's own upload fills (ui/teacher.js), so approving its aims is the
   same tap, the lessons reach children the same way (the class mirror,
   then the class sync) — and none of it needs a network or a wait.

   Nothing in the library is trusted: every lesson is checked again here by
   sylClean(), and one whose id no longer matches its content (edited after
   it was built) is shown as not used.

   S.libPlan is the teacher phone's own setting (a device field, like the
   sync keys): class code → { book, order, week }. It is never sent.
   ================================================================== */

function libBooks(clsId){
  const all = typeof LIBRARY !== 'undefined' && LIBRARY && Array.isArray(LIBRARY.books) ? LIBRARY.books : [];
  return clsId ? all.filter(b => b.cls === clsId) : all;
}
const libBook = id => libBooks().find(b => b.id === id) || null;
const libChapterOf = (book, id) => (book && book.chapters.find(c => c.id === id)) || null;

/* The class's term: the book's chapters in the teacher's order. A chapter
   added to the book later joins at the end; one taken out leaves. */
function libPlan(code){
  const p = code && (S.libPlan || {})[code], book = p && libBook(p.book);
  if(!book) return null;
  const ids = book.chapters.slice().sort((a, b) => (a.n || 99) - (b.n || 99)).map(c => c.id);
  const kept = (p.order || []).filter(id => ids.includes(id));
  const order = kept.concat(ids.filter(id => !kept.includes(id)));
  return { book, order, week: order.includes(p.week) ? p.week : order[0] };
}
function libSave(code, plan){
  S.libPlan = { ...(S.libPlan || {}) };
  if(plan) S.libPlan[code] = { book: plan.book, order: plan.order, week: plan.week };
  else delete S.libPlan[code];
  save();
}
function libSetBook(code, bookId){
  if(!code) return;
  const book = libBook(bookId);
  if(!book) return libSave(code, null);
  libSave(code, { book: book.id, order: [], week: null });
  const p = libPlan(code);
  libSave(code, { book: book.id, order: p.order, week: p.week });
}
function libMove(code, chId, by){
  const p = libPlan(code);
  if(!p) return;
  const i = p.order.indexOf(chId), j = i + by;
  if(i < 0 || j < 0 || j >= p.order.length) return;
  const order = p.order.slice();
  [order[i], order[j]] = [order[j], order[i]];
  libSave(code, { book: p.book.id, order, week: p.week });
}
function libSetWeek(code, chId){
  const p = libPlan(code);
  if(p && p.order.includes(chId)) libSave(code, { book: p.book.id, order: p.order, week: chId });
}
/* the week after this one, in the term's order (stays on the last) */
function libNextWeek(code){
  const p = libPlan(code);
  if(!p) return null;
  const next = p.order[Math.min(p.order.indexOf(p.week) + 1, p.order.length - 1)];
  libSave(code, { book: p.book.id, order: p.order, week: next });
  return next;
}

/* A chapter's ready lessons as the teacher's draft card reads them, each
   checked again on this phone. */
/* An English book's lessons are English lessons, read in English whatever the
   app's language: built with lang 'en' (tools/build-library.mjs, inside the
   id), and checked again with it here — a lesson built without it (or with
   it taken off on the way) gets a different id and is not offered. */
const libLangOf = book => (book && book.subject === 'english' ? 'en' : undefined);
function libDrafts(book, ch){
  const cls = sylClass(book.cls), skills = sylSkills(cls, book.subject);
  const drafts = (ch.lessons || []).map(les => {
    const c = sylClean(les, { band: cls.band, skills, lang: libLangOf(book) });
    if(c.ok && c.lesson.id === les.id) return { raw: les, ...c };
    return { raw: les, ...c, lesson: c.lesson || les, ok: false,
      errors: c.ok ? ['this lesson changed after it was built, so it is not offered'] : c.errors };
  });
  return { chapter: (ch.title && (ch.title[S.lang] || ch.title.en)) || ch.id, model: 'library', cls: cls.id, drafts,
    library: { book: book.id, chapter: ch.id } };
}
