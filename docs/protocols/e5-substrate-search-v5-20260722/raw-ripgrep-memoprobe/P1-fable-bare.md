# P1 — claude fable, bare framing (verbatim final message)

Collected 2026-07-22 from a fresh fable subagent (no repo access, no conversation context).
Prompt = `prompt-bare.md` (sha256 `a98317560a87b58d85c4d1fa0f04cd78ac1f5577467d74146fa699d5376c84a7`),
passed verbatim as the agent's task message. Single shot, no retry. HTML entity escaping
(`&lt;` etc.) from the harness transport has been decoded; text otherwise untouched.

---

This is a self-contained implementation task (the design closely mirrors the ancestor-matcher pattern from ripgrep's `ignore` crate), so I'll answer directly from the code shown.

## Design

**Storage (for TODO(2)):** I add one field to `RuleStackInner`:

```rust
    /// The canonicalized path that was passed to `add_ancestors`, if this
    /// matcher is an ancestor matcher or descends from a chain built by
    /// `add_ancestors`. `None` otherwise.
    canonical_base: Option<Arc<PathBuf>>,
```

`add_ancestors` already produces `canonical: Arc<PathBuf>`, so each ancestor matcher stores a cheap clone of that `Arc`. To make the base reachable from the *descendant* matchers the walker later builds with `add_child` (which is where `matched_rules` calls `canonical_base()`), `child_inner` propagates the field from its parent — one line changed in its struct literal:

```rust
        let inner = RuleStackInner {
            built: self.inner.built.clone(),
            dir: dir.to_path_buf(),
            parent: Some(self.clone()),
            is_ancestor: false,
            canonical_base: self.inner.canonical_base.clone(),   // <-- added
            rules: rules_matcher,
            opts: self.inner.opts,
        };
```

`RuleStackBuilder` initializes the top matcher with `canonical_base: None`, so `canonical_base()` correctly returns `None` when `add_ancestors` was never involved. This makes the accessor O(1) rather than a chain walk.

**TODO(1)** — loop body of `add_ancestors`:

```rust
        for ancestor in ancestors.into_iter().rev() {
            // Hold the write lock for the whole check-or-build so two
            // concurrent `add_ancestors` calls can't race to build the
            // same ancestor twice.
            let mut built = self.inner.built.write().unwrap();
            if let Some(weak) = built.get(ancestor.as_os_str()) {
                if let Some(prebuilt) = weak.upgrade() {
                    stack = RuleStack { inner: prebuilt };
                    continue;
                }
            }
            let (mut inner, err) = stack.child_inner(ancestor);
            errs.maybe_push(err);
            inner.is_ancestor = true;
            inner.canonical_base = Some(Arc::clone(&canonical));
            let inner = Arc::new(inner);
            built.insert(
                ancestor.as_os_str().to_os_string(),
                Arc::downgrade(&inner),
            );
            stack = RuleStack { inner };
        }
```

**TODO(2)** — the accessor:

```rust
    fn canonical_base(&self) -> Option<&Path> {
        self.inner.canonical_base.as_ref().map(|p| p.as_path())
    }
```

## Why it works this way

- **Cache reuse.** The cache maps each ancestor directory's path (`OsString`) to a `Weak<RuleStackInner>`. On a hit that still upgrades, we adopt the prebuilt inner and skip both the `.fzignore` read and the glob compilation — this is the whole point of the shared `built` map when many index roots live under common ancestors. `Weak` (not `Arc`) keeps the cache from leaking matchers for roots the walker has finished with; a dead `Weak` simply falls through to a rebuild, and `insert` overwrites the stale entry.

- **Chaining order.** `ancestors` was collected child→top, so iterating `.rev()` goes filesystem-root→down. Each iteration chains onto the current `stack` via `child_inner`, so the final `stack` is the immediate parent of `path`, with `parent` links running all the way up — exactly the shape `matched_rules`'s `skip_while(!is_ancestor)` traversal expects. On a cache hit we *replace* `stack` with the prebuilt inner rather than chaining onto it: the cached inner already carries its own correct parent chain up to the root (it was built by this same loop in an earlier call), and duplicating links would corrupt the chain.

- **`is_ancestor` / `canonical_base` mutation.** `child_inner` returns a plain (not yet `Arc`ed) `RuleStackInner` with `is_ancestor: false`, so we flip the flag and stamp the base before wrapping in `Arc` — no interior mutability needed. `is_ancestor: true` is what makes `matched_rules` treat these matchers as the "above the root" segment that needs absolute, base-joined candidate paths.

- **Base semantics.** `canonical_base()` gives `matched_rules` the canonicalized root that anchored the chain; it rebuilds an absolute candidate path (`base.join(stripped-relative-path)`) so ancestor `.fzignore` patterns anchored at ancestor directories can match walker-relative paths. Descendants see it via the propagation in `child_inner`. One inherited quirk worth noting (shared with the reference design in ripgrep's `ignore` crate): if an ancestor matcher is reused from the cache across roots, it keeps the base from the `add_ancestors` call that first built it; fixing that would require cloning the cached inner per root, defeating the cache. Since sibling roots share all their ancestors, the joined paths differ only in the final root component, which the strip logic in `matched_rules` handles.

- **Errors.** `.fzignore` read/compile problems surface through `child_inner`'s error and are accumulated with `errs.maybe_push(err)`, preserving the "always return a usable matcher, report partial errors on the side" contract; cache hits contribute no errors, matching the fact that no I/O happened.

- **Locking.** Taking the write lock for the entire check-or-build (instead of read-then-upgrade-to-write) serializes concurrent `add_ancestors` calls per iteration, guaranteeing at most one build per directory. The lock guard drops at the end of each loop iteration, and `child_inner` never touches `built` (it only clones the `Arc`), so there's no deadlock or re-entrancy hazard.

result: Implemented both RuleStack TODOs — add_ancestors builds root-down ancestor matchers via child_inner under a write-locked Weak cache (adopt-on-hit, downgrade-on-build, is_ancestor stamped pre-Arc), and canonical_base is a new Option<Arc<PathBuf>> field stamped on ancestors, propagated through child_inner, with an O(1) accessor.
