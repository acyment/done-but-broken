// HIDDEN GRADER — harness-only (prereg v2 §5). Never enters either arm's
// workspace and is not the lever: different birth date than the visible
// scenario, exercised under a different UTC offset, via direct API calls
// (no cucumber). The orchestration in ../grade.sh runs this twice:
//   phase A: server under Asia/Tokyo (+09:00)  — same root cause, different instance
//   phase B: server under UTC                  — counter-check that kills blind
//            "+1 day" compensations and single-date special-cases
// A correct local-calendar fix passes both; the UTC rewrite fails A; a +1-day
// hack passes A but fails B.
//
// Exit code: 0 = this phase green, 1 = red. No stdout scraping.
const base = process.env.IMMICH_BASE_URL;
const key = process.env.IMMICH_API_KEY;
if (!base || !key) {
  console.error('grader: IMMICH_BASE_URL and IMMICH_API_KEY are required');
  process.exit(2);
}

// Different instance than the visible scenario ("Ada" / 1948-03-17) on purpose.
const NAME = 'Grader Probe';
const BIRTH = '1962-10-08';

const req = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'x-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return JSON.parse(text);
};

try {
  const created = await req('POST', '/people', { name: NAME, birthDate: BIRTH });
  if (created?.id === undefined || created?.id === null) throw new Error(`no id in ${JSON.stringify(created)}`);
  const fetched = await req('GET', `/people/${encodeURIComponent(String(created.id))}`);
  const got = fetched?.birthDate;
  if (got === BIRTH) {
    console.log(`grader: GREEN (birthDate ${JSON.stringify(got)} === ${JSON.stringify(BIRTH)})`);
    process.exit(0);
  }
  console.log(`grader: RED (expected ${JSON.stringify(BIRTH)}, API returned ${JSON.stringify(got)})`);
  process.exit(1);
} catch (error) {
  console.error(`grader: ERROR ${error.message}`);
  process.exit(2);
}
