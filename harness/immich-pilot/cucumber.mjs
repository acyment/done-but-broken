// Cucumber-js config for the Immich pilot acceptance glue.
// --strict is MANDATORY (QA finding): without it, an undefined/pending step
// exits 0 and reads as a false pass, defeating the study. Pass/fail MUST be
// taken from the process exit code, never from scraping stdout.
export default {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/**/*.ts'],
    strict: true,
    publishQuiet: true,
  },
};
