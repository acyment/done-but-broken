// Probe: what does the server's own driver stack hand to asBirthDateString?
import { createPostgres } from '@immich/sql-tools';
const sql = createPostgres({ connection: { connectionType: 'url', url: 'postgres://immich:immich@127.0.0.1:15433/immich' } });
const [row] = await sql`SELECT "birthDate", "updatedAt" FROM person WHERE "birthDate" IS NOT NULL LIMIT 1`;
const x = row.birthDate;
console.log('process TZ:', process.env.TZ);
console.log('birthDate instanceof Date:', x instanceof Date);
console.log('birthDate.toISOString():', x.toISOString());
console.log('local rendering:', x.toString());
console.log('getHours() in this TZ:', x.getHours(), '(0 would mean local midnight; 11 means UTC midnight seen from Sydney)');
console.log('culprit toISOString().split =>', x.toISOString().split('T')[0]);
const y = row.updatedAt;
console.log('updatedAt instanceof Date:', y instanceof Date, y?.toISOString?.());
await sql.end();
