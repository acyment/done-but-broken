// Faithful reconstruction of Immich PR #28810.
// CULPRIT (shipped, pre-fix asBirthDateString): x.toISOString().split('T')[0]  -- always UTC
// FIX (post-#28810 asDateString via isoDateToDate.encode): local calendar fields
const culprit = (x) => x.toISOString().split('T')[0];
const fixed = (x) => {
  const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, '0'), d = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
// The added test's input: new Date(2000,0,15) = 15 Jan 2000 at LOCAL midnight.
const d = new Date(2000, 0, 15);
console.log(`TZ=${process.env.TZ || '(system)'}  local=${d.toString().slice(0,21)}`);
console.log(`  culprit(asBirthDateString) -> ${culprit(d)}   ${culprit(d) === '2000-01-15' ? 'CORRECT' : 'WRONG (silent, one day early)'}`);
console.log(`  fixed  (asDateString)      -> ${fixed(d)}   ${fixed(d) === '2000-01-15' ? 'CORRECT' : 'WRONG'}`);
