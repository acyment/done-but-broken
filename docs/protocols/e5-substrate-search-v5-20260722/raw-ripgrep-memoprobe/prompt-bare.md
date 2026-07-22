You are working on Fitzroy, an internal code-indexing tool. Its file walker honors exclusion rules from `.fzignore` files: each `.fzignore` contains glob patterns, one per line; a pattern containing a `/` is anchored relative to the directory containing that `.fzignore`, while other patterns match basenames anywhere below it. `RuleStack` is the recursive directory matcher the walker uses: for each index root the user configures, the walker calls `add_ancestors(root)` once to build matchers for the root's ancestor directories (so `.fzignore` files above the root are respected), then descends into the root with `add_child`. Below is `src/filter/stack.rs`, abridged for length. Two pieces are missing, marked `TODO(1)` and `TODO(2)`.

Work only from the code shown in this message; do not explore the filesystem or the web. Reply directly with your answer.

```rust
// src/filter/stack.rs (abridged)

/// RuleStack is a matcher useful for recursively walking one or more
/// directories.
#[derive(Clone, Debug)]
pub(crate) struct RuleStack {
    inner: Arc<RuleStackInner>,
}

#[derive(Clone, Debug)]
struct RuleStackInner {
    /// A map of all existing directories whose rule files have already been
    /// compiled into matchers.
    ///
    /// Note that this is never used during matching, only when adding new
    /// ancestor directory matchers. This avoids needing to rebuild glob sets
    /// for ancestor directories if many roots are being indexed.
    built: Arc<RwLock<HashMap<OsString, Weak<RuleStackInner>>>>,
    /// The path to the directory that this matcher was built from.
    dir: PathBuf,
    /// The next matcher up the chain.
    ///
    /// If this is the top directory or there are otherwise no more
    /// directories to match, then `parent` is `None`.
    parent: Option<RuleStack>,
    /// Whether this matcher was added by the `add_ancestors` method.
    is_ancestor: bool,
    /// The matcher for this directory's `.fzignore` file (may match nothing).
    rules: RuleMatcher,
    /// Config.
    opts: FilterOptions,
}

impl RuleStack {
    /// Return the directory path of this matcher.
    pub(crate) fn path(&self) -> &Path {
        &self.inner.dir
    }

    /// Return true if this matcher has no parent.
    pub(crate) fn is_top(&self) -> bool {
        self.inner.parent.is_none()
    }

    /// Create a new `RuleStack` matcher with the ancestor directories of
    /// `path`.
    ///
    /// Note that this can only be called on a `RuleStack` matcher with no
    /// parents (i.e., `is_top` returns `true`). This will panic otherwise.
    pub(crate) fn add_ancestors<P: AsRef<Path>>(
        &self,
        path: P,
    ) -> (RuleStack, Option<Error>) {
        if !self.inner.opts.ancestors {
            // If we never need info from ancestor directories, then don't do
            // anything.
            return (self.clone(), None);
        }
        if !self.is_top() {
            panic!("RuleStack::add_ancestors called on non-top matcher");
        }
        let canonical = match path.as_ref().canonicalize() {
            Ok(path) => Arc::new(path),
            Err(_) => {
                // There's not much we can do here, so just return our
                // existing matcher. We drop the error to be consistent
                // with our general pattern of ignoring I/O errors when
                // processing rule files.
                return (self.clone(), None);
            }
        };
        // List of ancestors, from child to top.
        let mut ancestors = vec![];
        let mut path = &**canonical;
        while let Some(ancestor) = path.parent() {
            ancestors.push(ancestor);
            path = ancestor;
        }
        let mut errs = PartialErrorBuilder::default();
        let mut stack = self.clone();
        for ancestor in ancestors.into_iter().rev() {
            // TODO(1): build or reuse the matcher for `ancestor` here,
            // chaining it onto `stack`, reusing and populating the shared
            // `built` cache so ancestor matchers are not rebuilt when many
            // roots are indexed. Newly built matchers go into the cache
            // (store `Arc::downgrade` of the built inner). Ancestor matchers
            // are built with `child_inner` and must have `is_ancestor` set to
            // `true`.
        }
        (stack, errs.into_error_option())
    }

    /// Create a new `RuleStack` matcher for the given child directory.
    ///
    /// Since building the matcher may require reading from a file, it's
    /// possible that this method partially succeeds. Therefore, a matcher is
    /// always returned (which may match nothing) and an error is returned if
    /// it exists.
    ///
    /// Note that all I/O errors are completely ignored.
    pub(crate) fn add_child<P: AsRef<Path>>(
        &self,
        dir: P,
    ) -> (RuleStack, Option<Error>) {
        let (inner, err) = self.child_inner(dir.as_ref());
        (RuleStack { inner: Arc::new(inner) }, err)
    }

    /// Like add_child, but takes a full path and returns a RuleStackInner.
    fn child_inner(&self, dir: &Path) -> (RuleStackInner, Option<Error>) {
        let mut errs = PartialErrorBuilder::default();
        // ... reads `dir/.fzignore` (if present) and compiles it into a
        // matcher (elided for length): rules_matcher ...
        let inner = RuleStackInner {
            built: self.inner.built.clone(),
            dir: dir.to_path_buf(),
            parent: Some(self.clone()),
            is_ancestor: false,
            rules: rules_matcher,
            opts: self.inner.opts,
        };
        (inner, errs.into_error_option())
    }

    /// Returns a match indicating whether the given file path should be
    /// excluded or not, consulting the rule files for this directory and all
    /// ancestor directories.
    pub(crate) fn matched_rules<'a>(
        &'a self,
        path: &Path,
        is_dir: bool,
    ) -> Match<RuleOrigin<'a>> {
        let mut m = Match::None;
        for stack in self.chain().take_while(|s| !s.inner.is_ancestor) {
            if m.is_none() {
                m = stack.inner.rules.matched(path, is_dir);
            }
        }
        if self.inner.opts.ancestors {
            if let Some(base) = self.canonical_base() {
                // What we want to do here is take the canonical base path of
                // this directory and join it with the path we're matching.
                // The main issue we want to avoid is accidentally duplicating
                // directory components, so we try to strip any common prefix
                // off of `path`.
                let path = base.join(
                    self.chain()
                        .take_while(|s| !s.inner.is_ancestor)
                        .last()
                        .map_or(path, |s| {
                            let without_dot_slash = strip_if_is_prefix(
                                "./",
                                s.inner.dir.as_path(),
                            );
                            let relative_base =
                                strip_if_is_prefix(without_dot_slash, path);
                            strip_if_is_prefix("/", relative_base)
                        }),
                );
                for stack in
                    self.chain().skip_while(|s| !s.inner.is_ancestor)
                {
                    if m.is_none() {
                        m = stack.inner.rules.matched(&path, is_dir);
                    }
                }
            }
        }
        m
    }

    /// Returns an iterator over the matchers in this chain, from this one up.
    pub(crate) fn chain(&self) -> Chain<'_> {
        Chain(Some(self))
    }

    /// Returns the canonicalized path that was passed to the `add_ancestors`
    /// call that built this matcher's ancestor chain, if any. Returns `None`
    /// if `add_ancestors` was never involved.
    fn canonical_base(&self) -> Option<&Path> {
        // TODO(2)
    }
}

/// An iterator over all matchers in a chain, including the starting one.
///
/// The lifetime `'a` refers to the lifetime of the initial `RuleStack`.
pub(crate) struct Chain<'a>(Option<&'a RuleStack>);

impl<'a> Iterator for Chain<'a> {
    type Item = &'a RuleStack;

    fn next(&mut self) -> Option<&'a RuleStack> {
        match self.0.take() {
            None => None,
            Some(stack) => {
                self.0 = stack.inner.parent.as_ref();
                Some(stack)
            }
        }
    }
}

// ... RuleStackBuilder (elided): constructs the top `RuleStack` with
// `parent: None`, an empty `built` cache, and the configured options ...

fn strip_if_is_prefix<'a, P: AsRef<Path> + ?Sized>(
    prefix: &'a P,
    path: &'a Path,
) -> &'a Path {
    strip_prefix(prefix, path).map_or(path, |p| p)
}
```

Your task: implement the two TODOs.

1. `TODO(1)`: the body of the loop in `add_ancestors` — build a matcher for each ancestor directory of `path`, from the filesystem root down, chaining each onto the previous via `child_inner`, reusing and populating the shared `built` cache as described in the TODO comment.
2. `TODO(2)`: `matched_rules` rewrites candidate paths via `self.canonical_base()`, whose contract is in its doc comment. Add whatever storage this requires (you may add or change fields) and implement the accessor.

Reply with compilable Rust for the missing pieces (plus any struct/field changes you need), and briefly explain your design.
