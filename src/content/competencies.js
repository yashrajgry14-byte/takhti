/* ==================================================================
   NIPUN BHARAT / NCERT COMPETENCY MAP

   Names the six levels of each module after the Foundational Literacy
   and Numeracy (FLN) competency progression a teacher already knows —
   NIPUN Bharat's Lakshya Soochi (Balvatika through Grade 3) and the
   NCF for the Foundational Stage (NCERT, 2022). See CURRICULUM.md for
   the full mapping and reasoning; this file is only the display copy.
   ================================================================== */
const COMPETENCY = {
  read: {
    1:{ en:'Phonological Awareness',      hi:'ध्वनि-जागरूकता' },
    2:{ en:'Letter-Sound Decoding',       hi:'अक्षर-ध्वनि पहचान' },
    3:{ en:'Word & Sentence Reading',     hi:'शब्द व वाक्य पठन' },
    4:{ en:'Reading Fluency',             hi:'धाराप्रवाह पठन' },
    5:{ en:'Reading Comprehension',       hi:'पठन-बोध' },
    6:{ en:'Independent Fluent Reading',  hi:'स्वतंत्र सुगम पठन' },
    // Classes 6–10 (content/ages.js UPPER_CLASS): the NCF's middle and secondary stages
    7:{ en:'Reading to Learn',            hi:'सीखने के लिए पठन' },
    8:{ en:'Reading Subject Texts',       hi:'विषय-पाठ पठन' },
    9:{ en:'Critical Reading',            hi:'आलोचनात्मक पठन' },
    10:{ en:'Advanced Reading',           hi:'उन्नत पठन' }
  },
  write: {
    1:{ en:'Pre-Writing & Fine Motor',        hi:'पूर्व-लेखन कौशल' },
    2:{ en:'Letter Formation',                hi:'अक्षर लेखन' },
    3:{ en:'Word Writing',                    hi:'शब्द लेखन' },
    4:{ en:'Sentence Copying & Dictation',    hi:'वाक्य लेखन व श्रुतलेख' },
    5:{ en:'Independent Sentence Writing',    hi:'स्वतंत्र वाक्य लेखन' },
    6:{ en:'Short Paragraph Writing',         hi:'लघु अनुच्छेद लेखन' },
    7:{ en:'Dictation of Long Sentences',     hi:'लंबे वाक्यों का श्रुतलेख' },
    8:{ en:'Writing Subject Sentences',       hi:'विषय-वाक्य लेखन' },
    9:{ en:'Accurate Complex Sentences',      hi:'सटीक जटिल वाक्य लेखन' },
    10:{ en:'Advanced Writing',               hi:'उन्नत लेखन' }
  },
  math: {
    1:{ en:'Pre-Number Concepts',              hi:'पूर्व-संख्या अवधारणा' },
    2:{ en:'Number Recognition & Counting',    hi:'संख्या पहचान व गणना' },
    3:{ en:'Place Value & Single-Digit Sums',  hi:'स्थानीय मान व इकाई जोड़-घटाव' },
    4:{ en:'Two-Digit Addition & Subtraction', hi:'दो अंकों का जोड़-घटाव' },
    5:{ en:'Multiplication & Division Basics', hi:'गुणा-भाग की शुरुआत' },
    6:{ en:'Measurement, Patterns & Data',     hi:'माप, पैटर्न व आँकड़े' },
    7:{ en:'Integers, Fractions & Ratio',      hi:'पूर्णांक, भिन्न व अनुपात' },
    8:{ en:'Equations, Percentages & Area',    hi:'समीकरण, प्रतिशत व क्षेत्रफल' },
    9:{ en:'Powers, Volume & Factorising',     hi:'घात, आयतन व गुणनखंड' },
    10:{ en:'Algebra, Geometry & Chance',      hi:'बीजगणित, ज्यामिति व प्रायिकता' }
  }
};
function competencyName(mod, lvl){
  const c = COMPETENCY[mod] && COMPETENCY[mod][lvl];
  return c ? (S.lang==='hi'? c.hi : c.en) : '';
}
