# P2 — claude fable, in-context framing (verbatim final message)

Collected 2026-07-22 from a fresh fable subagent (no repo access, no conversation context).
Prompt = `prompt-ctx.md` (sha256 `03d640d9a163d5808d2989dbc8886e64ec4b09fe702c1c9171706b59ab91c56e`),
passed verbatim as the agent's task message. Single shot, no retry. HTML entity escaping
(`&lt;` etc.) from the harness transport has been decoded; text otherwise untouched.

---

Both pieces come from the same design fact: `add_parents` is the only place that knows the canonicalized search root, so the parent matchers it builds must (a) be cached/shared across roots and (b) carry the canonical base path down the chain so `matched_ignore` can re-anchor relative candidate paths. Here is the implementation.

**TODO(2) storage — one new field on `IgnoreInner`:**

```rust
struct IgnoreInner {
    // ... existing fields ...
    /// The absolute base path of this matcher. Populated only if parent
    /// directories are added.
    absolute_base: Option<Arc<PathBuf>>,
    // ... existing fields ...
}
```

Two existing construction sites must be updated for the new field:

```rust
// In add_child_path, inside the `IgnoreInner { ... }` literal:
            absolute_base: self.inner.absolute_base.clone(),

// In IgnoreBuilder::build (the elided root constructor):
            absolute_base: None,
```

**TODO(1) — the loop body in `add_parents`:**

```rust
        for parent in parents.into_iter().rev() {
            let mut compiled = self.inner.compiled.write().unwrap();
            if let Some(weak) = compiled.get(parent.as_os_str()) {
                if let Some(prebuilt) = weak.upgrade() {
                    ig = Ignore { inner: prebuilt };
                    continue;
                }
            }
            let (mut igtmp, err) = ig.add_child_path(parent);
            errs.maybe_push(err);
            igtmp.is_absolute_parent = true;
            igtmp.absolute_base = Some(absolute_base.clone());
            igtmp.has_git =
                if self.inner.opts.require_git && self.inner.opts.git_ignore {
                    parent.join(".git").exists()
                        || parent.join(".jj").exists()
                } else {
                    false
                };
            let inner = Arc::new(igtmp);
            compiled.insert(
                parent.as_os_str().to_os_string(),
                Arc::downgrade(&inner),
            );
            ig = Ignore { inner };
        }
```

**TODO(2) accessor:**

```rust
    /// Returns the canonicalized path that was passed to the `add_parents`
    /// call that built this matcher's ancestor chain, if any. Returns `None`
    /// if `add_parents` was never involved.
    fn absolute_base(&self) -> Option<&Path> {
        self.inner.absolute_base.as_deref().map(|p| p.as_path())
    }
}
```

(Equivalently `self.inner.absolute_base.as_ref().map(|p| &***p)` — any spelling that turns `Option<Arc<PathBuf>>` into `Option<&Path>`.)

**Design notes**

- *Cache protocol.* The cache maps a parent directory's `OsString` path to a `Weak<IgnoreInner>`. Each iteration takes the write lock, tries `get` + `upgrade`; a hit means some earlier `add_parents` call (another search root) already built this ancestor's matcher, so we chain onto the shared `Arc` and skip all ignore-file I/O and glob compilation for it. A miss (absent, or `Weak` dead because every `Ignore` referencing it was dropped) rebuilds and re-inserts. Storing `Weak` rather than `Arc` means the cache never keeps matchers alive on its own — memory for ancestor matchers is reclaimed once no walker holds them.
- *Why mutate `igtmp` after `add_child_path`.* `add_child_path` returns a plain `IgnoreInner` (not yet wrapped in `Arc`) precisely so `add_parents` can fix up three fields before freezing it: `is_absolute_parent = true` (this is the flag `matched_ignore` uses to split the chain into "real" child matchers vs. ancestor matchers, via `take_while`/`skip_while`); `absolute_base = Some(absolute_base.clone())` (an `Arc<PathBuf>` shared by every ancestor matcher of this root, cheap to clone); and `has_git` recomputed with a bare `exists()` check on `.git`/`.jj`, gated on `require_git && git_ignore` per the TODO contract — for parents we don't need the file-type metadata that `add_child_path` gathers, just presence, and when git isn't required for git rules to apply, `false` is fine because `matched_ignore`'s `any_git` short-circuits on `!require_git`.
- *Why the inheritance in `add_child_path` matters.* When the walker later descends from the root with `add_child`, each child copies `absolute_base` from its parent. That is what makes `absolute_base()` return `Some` on the deep matcher doing the matching, letting `matched_ignore` join the walker's relative candidate path onto the canonical root (after prefix-stripping) so ancestor `.gitignore` matchers — which were built against absolute directories — see absolute paths. If `add_parents` was never called (or bailed early), everything stays `None` and that whole re-anchoring branch is skipped.
- *Error handling.* Per-parent errors from `add_child_path` are accumulated with `errs.maybe_push(err)` and surfaced once via `errs.into_error_option()`, matching the crate's partial-success convention.

result: Implemented both TODOs — `add_parents` loop with Weak-cache reuse/insert, `is_absolute_parent`/`has_git` (.git or .jj) fixups, and a new inherited `absolute_base: Option<Arc<PathBuf>>` field backing the `absolute_base()` accessor.
