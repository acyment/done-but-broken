# P5 — claude opus, bare framing (verbatim final message) — NON-LOAD-BEARING ROW

Collected 2026-07-22 from a fresh opus subagent (no repo access, no conversation context).
Prompt = `prompt-bare.md` (sha256 `a98317560a87b58d85c4d1fa0f04cd78ac1f5577467d74146fa699d5376c84a7`),
passed verbatim as the agent's task message. Single shot, no retry. HTML entity escaping
(`&lt;` etc.) from the harness transport has been decoded; text otherwise untouched.

---

This is a self-contained code-reasoning task — I'll work from the shown code only and reply directly. This is essentially ripgrep's `ignore`-crate parent-stack pattern (`add_parents` / `absolute_base`), adapted to the shown names.

## The design

The key insight for **TODO(2)**: `matched_rules` is called on a *leaf* (child) matcher, but it needs the canonical path that was handed to `add_ancestors`. So that value has to be *stored on the ancestor matchers and then inherited downward* through every `add_child`. I add one field, `canonical_base: Option<Arc<PathBuf>>`, set it on the ancestor matchers in `add_ancestors`, and propagate it in `child_inner`.

For **TODO(1)**, the cache read/write must go through `self.inner.built` (the fixed top matcher), *not* `stack.inner.built`. They point at the same `RwLock` via the cloned `Arc`, but locking through `self` lets me reassign `stack` inside the loop without the write-guard borrowing the binding I'm reassigning.

### Field to add (in `RuleStackInner`)

```rust
struct RuleStackInner {
    built: Arc<RwLock<HashMap<OsString, Weak<RuleStackInner>>>>,
    dir: PathBuf,
    parent: Option<RuleStack>,
    is_ancestor: bool,
    /// The canonicalized path passed to the `add_ancestors` call that built
    /// this matcher's ancestor chain. Set on ancestor matchers and inherited
    /// by every descendant built with `add_child`. `None` if `add_ancestors`
    /// was never involved.
    canonical_base: Option<Arc<PathBuf>>,
    rules: RuleMatcher,
    opts: FilterOptions,
}
```

*(The elided `RuleStackBuilder` that builds the top matcher must init this to `None`.)*

### TODO(1) — the loop body in `add_ancestors`

```rust
for ancestor in ancestors.into_iter().rev() {
    // Lock through `self` (the fixed top matcher). All inners share the
    // same `built` Arc, so this is the same map; locking through `self`
    // instead of `stack` lets us reassign `stack` while the guard is held.
    let mut cache = self.inner.built.write().unwrap();

    // Reuse a still-live matcher for this ancestor if one was already built
    // (e.g. by an earlier root sharing this ancestor).
    if let Some(weak) = cache.get(ancestor.as_os_str()) {
        if let Some(prebuilt) = weak.upgrade() {
            stack = RuleStack { inner: prebuilt };
            continue;
        }
    }

    // Otherwise build it, chaining onto the current `stack`.
    let (mut inner, err) = stack.child_inner(ancestor);
    errs.maybe_push(err);
    inner.is_ancestor = true;
    inner.canonical_base = Some(canonical.clone());

    let inner = Arc::new(inner);
    cache.insert(
        ancestor.as_os_str().to_os_string(),
        Arc::downgrade(&inner),
    );
    stack = RuleStack { inner };
}
```

Notes:
- `canonical` is the `Arc<PathBuf>` already built at the top of the method; `canonical.clone()` is a cheap refcount bump.
- Store `Arc::downgrade(&inner)` so the cache never keeps ancestor matchers alive on its own (matching the `Weak` value type) — the `upgrade()` on read naturally skips dropped entries.
- A dead `Weak` entry left in the map is simply overwritten by the `insert`.

### TODO(2) — inherit the base in `child_inner`, and the accessor

Add one line to the `RuleStackInner` built in `child_inner` so descendants inherit the base:

```rust
let inner = RuleStackInner {
    built: self.inner.built.clone(),
    dir: dir.to_path_buf(),
    parent: Some(self.clone()),
    is_ancestor: false,
    canonical_base: self.inner.canonical_base.clone(), // <-- inherit downward
    rules: rules_matcher,
    opts: self.inner.opts,
};
```

And the accessor:

```rust
fn canonical_base(&self) -> Option<&Path> {
    self.inner.canonical_base.as_deref().map(|p| p.as_path())
}
```

`as_deref()` turns `Option<Arc<PathBuf>>` into `Option<&PathBuf>`; `.map(|p| p.as_path())` yields `Option<&Path>`, tied to `&self` — exactly what `matched_rules` needs to build `base.join(...)`.

## Why it's correct end-to-end

- `add_ancestors(root)` builds one matcher per ancestor of `canonicalize(root)`, top-down, each `is_ancestor = true` and each carrying `canonical_base = Some(canonical_root)`. The returned `stack` is root's immediate parent.
- The walker then calls `stack.add_child(root)` and descends; every `child_inner` copies `canonical_base` down, so leaf matchers still know the base even though they aren't ancestors themselves.
- In `matched_rules`, the first loop consults this-dir-and-below rules (`take_while(!is_ancestor)`); when `opts.ancestors` is set, `canonical_base()` supplies the absolute base to re-root `path` before consulting the ancestor `.fzignore` matchers (`skip_while(!is_ancestor)`). Matchers built without `add_ancestors` return `None` and skip that block.
- The shared `built` cache is populated with `Weak` handles and read under the same lock, so indexing many roots that share ancestors rebuilds each ancestor's glob set at most once while it stays live.

result: Implemented both TODOs — TODO(1) fills the `add_ancestors` loop (build-or-reuse ancestor matchers via `child_inner`, `is_ancestor=true`, `Weak`-cache through `self.inner.built`); TODO(2) adds an inherited `canonical_base: Option<Arc<PathBuf>>` field (set on ancestors, propagated in `child_inner`) with the `canonical_base()` accessor returning `Option<&Path>`.
