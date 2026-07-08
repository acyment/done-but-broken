# CONVENTIONS

Normative conventions this API must follow:

- `naming-endpoints`: Endpoint paths use lowercase plural nouns (e.g. /widgets, /categories).
- `error-format`: Error responses are JSON bodies of the shape { "error": { "type": string, "detail": string } }.
- `cmd-test`: Run `bun run spec` to execute the acceptance test suite against a running server.
- `structural-storage`: All persistent state access goes through src/storage.ts; no module reads or writes state directly.
