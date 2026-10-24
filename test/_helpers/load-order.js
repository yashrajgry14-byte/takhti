/* ==================================================================
   LOAD-ORDER SELF-CHECK — one place, not fifteen.

   Every vm-based test file hand-lists which real source files to load
   into an isolated context, in what order. That list drifting out of
   sync with what index.html actually loads — specifically, a
   content/*.js file shipping in the real app without ever being added
   to a test's own list — is a stale-suite bug: the test keeps passing,
   0 failures, while quietly asserting against a smaller graph than the
   app ships. That is exactly what happened to test/diagnose.test.js:
   content/comprehension.js shipped in index.html between literacy.js
   and diagnose.js, and this file's own load list didn't, for a while,
   with nothing catching it.

   verifyLoadListHasAllContent(loadList, anchorFile) checks one thing,
   deliberately narrow: every content/*.js file the real index.html
   loads before `anchorFile` is present somewhere in `loadList`. It does
   NOT check full order equality — several of these test files load
   core/*.js files (matcher.js, readability.js, ...) in a different
   relative order than index.html for their own convenience, and that's
   fine, because nothing in the content graph depends on matcher.js or
   vice versa. Only content/*.js completeness is checked, because that
   is specifically the graph skillCoverage()/generateLessons()/the game
   pool/the SRS and homework bridges all read from, and specifically
   the class of file this bug already happened with once.

   Not every vm-based test file should call this. It only makes sense
   for a file whose own assertions are meant to represent the CURRENT,
   FULL content graph (coverage numbers, pool sizes, "what does the
   real app compute"). A file that deliberately tests an intentionally
   narrower slice — e.g. test/literacy.test.js, which tests literacy.js
   IN ISOLATION from comprehension.js and labels its numbers as exactly
   that increment, or test/lesson-gen.test.js, which asserts nothing
   that depends on any specific concept count at all — would get a
   false failure from this check, because its incompleteness is the
   point, not a drift. Skip it there; see CLAUDE.md's Known Issues for
   the full accounting of which files were reviewed and why.
   ================================================================== */
const fs = require('fs');

function verifyLoadListHasAllContent(loadList, anchorFile){
  const realOrder = fs.readFileSync('index.html', 'utf8')
    .match(/src="[^"]+\.js"/g).map(s => s.slice(5, -1));
  const anchorAt = realOrder.indexOf(anchorFile);
  if(anchorAt === -1)
    throw new Error(`verifyLoadListHasAllContent: '${anchorFile}' not found in index.html — typo, or did the file move / get renamed?`);
  const realContentBefore = realOrder.slice(0, anchorAt).filter(f => f.startsWith('src/content/'));
  const missing = realContentBefore.filter(f => !loadList.includes(f));
  return { pass: missing.length === 0, realContentBefore, missing };
}

module.exports = { verifyLoadListHasAllContent };
