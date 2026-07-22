// Frozen-instant clock pin for the Immich server process (prereg v2 §3).
//
// Loaded via NODE_OPTIONS="--require .../pin-clock.cjs" so it applies to the
// server process and every node child it forks (nest watch children, worker
// forks) BEFORE any application code runs.
//
// Semantics: at process start the JS clock is set to the absolute instant in
// PIN_CLOCK_INSTANT (an ISO string WITH an explicit UTC offset, so the
// zone/DST question is resolved by construction, not by TZ parsing) and then
// advances at normal speed. A literally stopped clock would wedge timers,
// DB pools, and health checks; a start-at pin is the standard fake-clock
// semantics for long-lived processes.
//
// What is patched: Date.now(), the zero-argument `new Date()`, and
// Date.prototype via subclassing. Explicit-argument Date construction,
// Date.parse, toISOString, and all TZ arithmetic are untouched — the pin can
// never mask or simulate the timezone behavior under study; it only moves
// "now". The wall-calendar zone comes from TZ= in the environment, exactly as
// it would in production.
'use strict';

const RealDate = Date;
const pin = process.env.PIN_CLOCK_INSTANT;

if (pin) {
  if (!/[+-]\d{2}:\d{2}$|Z$/.test(pin)) {
    throw new Error(
      `pin-clock: PIN_CLOCK_INSTANT must carry an explicit UTC offset (got ${JSON.stringify(pin)}); ` +
        'a zone-less string would be DST-ambiguous, which prereg v2 §3 forbids',
    );
  }
  const target = new RealDate(pin).getTime();
  if (Number.isNaN(target)) {
    throw new Error(`pin-clock: unparseable PIN_CLOCK_INSTANT: ${JSON.stringify(pin)}`);
  }
  const offsetMs = target - RealDate.now();

  class PinnedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(RealDate.now() + offsetMs);
      } else {
        super(...args);
      }
    }
    static now() {
      return RealDate.now() + offsetMs;
    }
  }

  globalThis.Date = PinnedDate;
}
