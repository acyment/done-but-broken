// Cucumber-js config for the Immich pilot acceptance glue.
// --strict is MANDATORY (QA finding): without it, an undefined/pending step
// exits 0 and reads as a false pass, defeating the study. Pass/fail MUST be
// taken from the process exit code, never from scraping stdout.
//
// Shape note (v12 compatibility rider, 2026-07-22): for an .mjs config file,
// cucumber-js treats the module's default export as the DEFAULT PROFILE
// itself. The earlier `export default { default: {...} }` double-wrap made
// the profile consist of one unknown key, which the loader silently dropped —
// steps went undefined and --strict correctly failed the run (the guarantee
// working as designed). Same options, correct shape:
export default {
  requireModule: ['ts-node/register'],
  require: ['features/**/*.ts'],
  strict: true,
};
