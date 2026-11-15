# Books for the lesson library

The library is built ahead: every school on a book gets the same checked
lessons, with no network in the week (`tools/build-library.mjs`, see
CLAUDE.md → *The lesson library*). One book is built now — *Maths Mela*
Class 3 (`library/ncert-maths-mela-3`). These are set up and waiting for
their PDFs:

| class | subject | book | folder | NCERT code |
|---|---|---|---|---|
| Class 1 | maths | Joyful Mathematics (आनंदमय गणित) | `library/ncert-joyful-maths-1` | `aejm1` (check) |
| Class 2 | maths | Joyful Mathematics (आनंदमय गणित) | `library/ncert-joyful-maths-2` | `bejm1` (check) |
| Class 4 | maths | Maths Mela (गणित मेला) | `library/ncert-maths-mela-4` | `demm1` (check) |
| Class 5 | maths | Maths Mela (गणित मेला) | `library/ncert-maths-mela-5` | `eemm1` |
| Class 1 | english | Mridang (मृदंग) | `library/ncert-mridang-1` | `aemr1` (check) |
| Class 2 | english | Mridang (मृदंग) | `library/ncert-mridang-2` | `bemr1` (check) |
| Class 3 | english | Santoor (संतूर) | `library/ncert-santoor-3` | `cesa1` (check) |
| Class 4 | english | Santoor (संतूर) | `library/ncert-santoor-4` | `desa1` (check) |
| Class 5 | english | Santoor (संतूर) | `library/ncert-santoor-5` | `eesa1` |
| Class 1 | hindi | Sarangi (सारंगी) | `library/ncert-sarangi-1` | `ahsr1` (check) |
| Class 2 | hindi | Sarangi (सारंगी) | `library/ncert-sarangi-2` | `bhsr1` (check) |
| Class 3 | hindi | Veena (वीणा) | `library/ncert-veena-3` | `chve1` (check) |
| Class 4 | hindi | Veena (वीणा) | `library/ncert-veena-4` | `dhve1` (check) |
| Class 5 | hindi | Veena (वीणा) | `library/ncert-veena-5` | `ehve1` |

A book with nothing built isn't offered to a teacher (the bundle skips it).

## Building one book

1. **Get the PDFs.** On `ncert.nic.in/textbooks.php` choose the class and
   the book, then *Download complete book* (a zip). The page's address
   ends in the book's code, e.g. `textbook.php?eemm1=0-15` for *Maths
   Mela* Class 5 (from CBSE's circular 48 of 2025). The codes marked
   *(check)* follow NCERT's pattern (a = Class 1 … e = Class 5) but haven't
   been checked — the folder name is what matters, not the code.
2. **Unzip into the book's folder**, so the chapter PDFs sit next to its
   `book.json` (they are never committed — `.gitignore`).
3. **List the chapters:**
   `node tools/build-library.mjs --book library/ncert-maths-mela-5 --scan`
   — every chapter PDF in order, the front matter and answers left out.
   Read the list against the book's contents page, and add a chapter's
   title or a `note` (what to stress) in `book.json` if you like.
4. **Build, half price, through the Batch API:**
   `node tools/build-library.mjs --book library/ncert-maths-mela-5 --batch`
   — the PDFs go up through the Files API (up to 50 MB each), the drafts
   and one repair round go as two batch jobs to the full Flash model
   (`GEMINI_BATCH_MODEL`, default `gemini-3.8-flash`), and only lessons
   that pass the phone's own checks are kept. If the job isn't done in an
   hour (`--wait 60`), run the same command again later: it picks the job
   up from `.batch.json`.
5. **Read** `summary.md` and each chapter's `<ch>.report.md`; then bump
   `CACHE` in `sw.js`, run `npm test`, commit `library/<book>/*.json`,
   `*.report.md`, `summary.md` and `src/content/library.js`.

## Rebuilding a book that is already built

`--batch --force` builds every chapter again (or `--only ch5 --force`).
A chapter that comes back with **fewer** lessons than it has is kept as it
was; the new build is saved beside it as `<ch>.candidate.json` with its
report — read it, and take it with `--replace` if it is better (two
questions per lesson, say, even if fewer lessons). So a rebuild never
quietly empties a chapter a school (or a demo) already uses.

## The rules a library lesson meets

Everything a teacher's own upload meets (CLAUDE.md → *The school's own
syllabus*), and two questions: every picture lesson in a maths book, and
every lesson in a reader (Mridang, Sarangi, Santoor, Veena) — with two
answers, one question is a coin toss.
