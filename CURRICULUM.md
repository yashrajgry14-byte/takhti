# Curriculum mapping

Takhti's six levels per module aren't an arbitrary difficulty ramp — each one
is named after a real Foundational Literacy and Numeracy (FLN) competency, so
a teacher opening the app for the first time recognises where a child sits
without needing an explanation from us.

## Where this comes from

India's [NIPUN Bharat](https://www.education.gov.in/nipun-bharat) mission
(Ministry of Education, launched July 2021, under NEP 2020) sets the goal
that every child achieves foundational literacy and numeracy by the end of
Grade 3 (target year 2026–27). Its **Lakshya Soochi** (targets list) lays out
age-appropriate learning outcomes from Balvatika (pre-school) through Grade
3. The **NCF for the Foundational Stage** (NCERT, 2022) supplies the
competency structure underneath it — for reading, the same phonological
awareness → decoding → fluency → comprehension progression used worldwide
(the "five pillars of reading" from the National Reading Panel, which NIPUN
Bharat's literacy guidelines adopt); for numeracy, the standard FLN strands of
number sense, place value, operations, measurement, patterns, and data
handling.

The level names below use that standard NIPUN Bharat / NCF-FS terminology.
They are **not** verbatim line items copied from the official Lakshya Soochi
document (which is only distributed as a scanned PDF we could not extract
text from reliably) — they're Takhti's own within-band progression, built
from the same competency vocabulary a NIPUN Bharat-trained teacher already
uses, so the mapping reads as familiar rather than invented. Treat this as a
practical adaptation, not a certified equivalence table.

Six app levels don't divide evenly into four grade bands (Balvatika, Grade 1,
Grade 2, Grade 3), so several levels sit within the same grade, ordered by
sub-skill rather than by year. That mirrors how NIPUN Bharat itself works in
practice — a teacher differentiates within a grade, not just between grades.

## Reading (`read`)

| Level | Competency | Roughly maps to | Hindi label |
|---|---|---|---|
| 1 | Phonological Awareness | Balvatika — hearing and playing with sounds before print | ध्वनि-जागरूकता |
| 2 | Letter-Sound Decoding | Grade 1, early — matching aksharas/letters to sounds, blending | अक्षर-ध्वनि पहचान |
| 3 | Word & Sentence Reading | Grade 1, late — reading familiar words and short sentences | शब्द व वाक्य पठन |
| 4 | Reading Fluency | Grade 2 — reading grade-level text at an even pace, not just accurately | धाराप्रवाह पठन |
| 5 | Reading Comprehension | Grade 2–3 — reading *for meaning*, answering questions about the text | पठन-बोध |
| 6 | Independent Fluent Reading | Grade 3 exit — NIPUN Bharat's headline benchmark: independent, fluent, comprehending reading | स्वतंत्र सुगम पठन |

Implementation: `src/content/sentences.js` grades each level's sentence bank
by word count in step with this progression (L1 3–4 words up to L6 12–15
words) — see the file header there for the exact bands.

## Writing (`write`)

| Level | Competency | Roughly maps to | Hindi label |
|---|---|---|---|
| 1 | Pre-Writing & Fine Motor | Balvatika — line and shape tracing, pencil grip | पूर्व-लेखन कौशल |
| 2 | Letter Formation | Grade 1, early — writing individual letters and matras correctly | अक्षर लेखन |
| 3 | Word Writing | Grade 1, late — copying and writing simple familiar words | शब्द लेखन |
| 4 | Sentence Copying & Dictation | Grade 2 — writing a short sentence from a model or from dictation | वाक्य लेखन व श्रुतलेख |
| 5 | Independent Sentence Writing | Grade 2–3 — composing an original simple sentence | स्वतंत्र वाक्य लेखन |
| 6 | Short Paragraph Writing | Grade 3 exit — a short paragraph or short piece written independently | लघु अनुच्छेद लेखन |

Implementation: trace mode uses `GLYPHS` (letters at L1–3, words at L4–6);
paper mode reuses the `SENTENCES` bank at the same level for copy-and-photo
practice.

## Counting (`math`)

| Level | Competency | Roughly maps to | Hindi label |
|---|---|---|---|
| 1 | Pre-Number Concepts | Balvatika — sorting, comparing, one-to-one correspondence | पूर्व-संख्या अवधारणा |
| 2 | Number Recognition & Counting | Grade 1, early — recognising and writing numerals, counting on | संख्या पहचान व गणना |
| 3 | Place Value & Single-Digit Sums | Grade 1, late — tens and ones, addition/subtraction within 20 | स्थानीय मान व इकाई जोड़-घटाव |
| 4 | Two-Digit Addition & Subtraction | Grade 2 — regrouping, the NIPUN Bharat Grade-3 benchmark pulled forward as a milestone | दो अंकों का जोड़-घटाव |
| 5 | Multiplication & Division Basics | Grade 2–3 — multiplication as repeated addition, simple sharing/division | गुणा-भाग की शुरुआत |
| 6 | Measurement, Patterns & Data | Grade 3 exit — applying number sense to measurement, shapes, patterns, simple data | माप, पैटर्न व आँकड़े |

Implementation: `src/core/mathgen.js` levels problem generation to match;
`playMath()` in `src/ui/handlers.js` picks the array-grid explainer for
multiplication problems (level 5), the number-line explainer for larger
sums (level 4+), and object-counting otherwise — so the visual model a
child sees already lines up with the competency being practised.

## Where a teacher sees this

The competency name is shown, in the child's current language, alongside
every level number:

- Home screen — under the child's name, for reading and counting.
- The `read` / `write` / `math` screens themselves.
- The parent dashboard (`parent` screen) — one line per module, this is the
  view a teacher or parent is most likely to actually read.

The mapping data lives in `src/content/competencies.js` (`COMPETENCY` object
+ `competencyName(mod, level)` helper), separate from the display strings in
`src/content/copy.js`, so it can be revised independently — e.g. if a future
version wants to cite exact Lakshya Soochi outcome codes once we have a
reliable text source for them.

## Sources

- [NIPUN Bharat guidelines (PIB / Ministry of Education, PDF)](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/jul/doc20217531.pdf)
- [NIPUN Bharat Mission overview — Ministry of Education](https://www.education.gov.in/nipun-bharat)
- [NCF for the Foundational Stage, 2022 (NCERT, PDF)](https://ncert.nic.in/pdf/NCF_for_Foundational_Stage_20_October_2022.pdf)
- [Foundational Learning Study (FLS) — NIPUN Bharat Mission](https://nipunbharat.education.gov.in/fls/fls.aspx)
