const T = {
  en:{ read:'Read aloud', write:'Write it', writeSub:'Trace the letter',
       count:'Count', ask:'Ask me', askSub:'Any question at all',
       level:'Level', tapMic:'Tap and read it out', listening:'Listening…',
       next:'Next', hear:'Hear it', check:'Check', clear:'Clear',
       parent:'For parents', back:'Back', sendQ:'Ask', typeQ:'Type your question…',
       typeInstead:'Type what you read instead', savedQ:'Saved. I will answer this when we get signal.' },
  hi:{ read:'पढ़ो', write:'लिखो', writeSub:'अक्षर बनाओ',
       count:'गिनो', ask:'पूछो', askSub:'कुछ भी पूछो',
       level:'स्तर', tapMic:'दबाओ और पढ़ो', listening:'सुन रहा हूँ…',
       next:'आगे', hear:'सुनो', check:'जाँचो', clear:'मिटाओ',
       parent:'माता-पिता के लिए', back:'वापस', sendQ:'पूछो', typeQ:'अपना सवाल लिखो…',
       typeInstead:'बोलने की जगह लिखो', savedQ:'सवाल सुरक्षित है। सिग्नल आते ही जवाब मिलेगा।' }
};
const t = k => T[S.lang][k];
