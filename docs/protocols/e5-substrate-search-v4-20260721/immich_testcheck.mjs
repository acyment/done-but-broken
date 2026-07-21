const culprit = (x) => x.toISOString().split('T')[0];
const d = new Date(2000, 0, 15);
const got = culprit(d);
console.log(`TZ=${process.env.TZ}: buggy asBirthDateString yields ${got} -> the fix's own regression test ${got === '2000-01-15' ? 'PASSES (DECOY: original bug NOT caught)' : 'FAILS (bug caught)'}`);
