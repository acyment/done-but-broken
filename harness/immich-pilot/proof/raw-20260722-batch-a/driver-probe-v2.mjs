// Batch A driver probe v2: what does the server's own driver stack
// (@immich/sql-tools createPostgres, session TimeZone=UTC) hand to the
// serialization helper for each Postgres type on the candidate surfaces?
// Run under TZ=UTC and TZ=Australia/Sydney; outputs must be compared.
import { createPostgres } from '@immich/sql-tools';
const sql = createPostgres({ connection: { connectionType: 'url', url: 'postgres://immich:immich@127.0.0.1:15433/immich' } });

console.log('process TZ:', process.env.TZ);

// 1. timestamptz — the type of EVERY timestamp column in the schema
//    (asset.localDateTime, fileCreatedAt, exif.dateTimeOriginal, ...)
const [a] = await sql`SELECT "localDateTime" AS v FROM asset WHERE "originalFileName" = 'probe-a.jpg'`;
console.log('timestamptz  instanceof Date:', a.v instanceof Date,
  '| toISOString:', a.v.toISOString(), '| local toString:', a.v.toString());

// 2. date cast — the album startDate/endDate aggregate shape
const [b] = await sql`SELECT MIN(("localDateTime" AT TIME ZONE 'UTC')::date) AS v FROM asset`;
console.log('date-cast    instanceof Date:', b.v instanceof Date,
  '| toISOString:', b.v.toISOString(), '| getHours(local):', b.v.getHours());

// 3. synthetic zone-less timestamp — the type the §7.2 finding's option-1 note
//    presumed for localDateTime; NO API-visible column actually has it
const [c] = await sql`SELECT ("localDateTime" AT TIME ZONE 'UTC') AS v FROM asset WHERE "originalFileName" = 'probe-a.jpg'`;
console.log('zoneless-ts  instanceof Date:', c.v instanceof Date,
  '| toISOString:', c.v.toISOString(), '| local toString:', c.v.toString());

await sql.end();
