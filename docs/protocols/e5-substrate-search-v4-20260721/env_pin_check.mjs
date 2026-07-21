const culprit = (x) => x.toISOString().split('T')[0];
const fixed = (x) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
// The REALISTIC round-trip scenario both blind authors actually wrote — NO timezone language:
//   'create person born 1948-03-17, GET, expect birthDate == 1948-03-17'
const d = new Date(1948, 2, 17);
console.log(`TZ=${process.env.TZ}: buggy round-trip returns ${culprit(d)} -> scenario ${culprit(d)==='1948-03-17'?'GREEN (decoy)':'RED (catches)'} | fixed returns ${fixed(d)}`);
