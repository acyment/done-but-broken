You are working on ripgrep's `ignore` crate. `Ignore` is the recursive directory matcher the walker uses: for each search root passed on the command line, the walker calls `add_parents(root)` once to build matchers for the root's ancestor directories (so ignore files above the root are respected), then descends into the root with `add_child`. Below is `crates/ignore/src/dir.rs` at commit `79a23e0`, abridged for length. Two pieces are missing, marked `TODO(1)` and `TODO(2)`.

Work only from the code shown in this message; do not explore the filesystem or the web. Reply directly with your answer.

```rust
// crates/ignore/src/dir.rs (abridged)

/// Options for the ignore matcher, shared between the matcher itself and the
/// builder.
#[derive(Clone, Copy, Debug)]
struct IgnoreOptions {
    /// Whether to ignore hidden file paths or not.
    hidden: bool,
    /// Whether to read .ignore files.
    ignore: bool,
    /// Whether to respect any ignore files in parent directories.
    parents: bool,
    /// Whether to read git's global gitignore file.
    git_global: bool,
    /// Whether to read .gitignore files.
    git_ignore: bool,
    /// Whether to read .git/info/exclude files.
    git_exclude: bool,
    /// Whether to ignore files case insensitively
    ignore_case_insensitive: bool,
    /// Whether a git repository must be present in order to apply any
    /// git-related ignore rules.
    require_git: bool,
}

/// Ignore is a matcher useful for recursively walking one or more directories.
#[derive(Clone, Debug)]
pub(crate) struct Ignore {
    inner: Arc<IgnoreInner>,
}

#[derive(Clone, Debug)]
struct IgnoreInner {
    /// A map of all existing directories that have already been
    /// compiled into matchers.
    ///
    /// Note that this is never used during matching, only when adding new
    /// parent directory matchers. This avoids needing to rebuild glob sets for
    /// parent directories if many paths are being searched.
    compiled: Arc<RwLock<HashMap<OsString, Weak<IgnoreInner>>>>,
    /// The path to the directory that this matcher was built from.
    dir: PathBuf,
    /// An override matcher (default is empty).
    overrides: Arc<Override>,
    /// A file type matcher.
    types: Arc<Types>,
    /// The parent directory to match next.
    ///
    /// If this is the root directory or there are otherwise no more
    /// directories to match, then `parent` is `None`.
    parent: Option<Ignore>,
    /// Whether this is an absolute parent matcher, as added by add_parent.
    is_absolute_parent: bool,
    /// The directory that gitignores should be interpreted relative to.
    global_gitignores_relative_to: Option<PathBuf>,
    /// Explicit global ignore matchers specified by the caller.
    explicit_ignores: Arc<Vec<Gitignore>>,
    /// Ignore files used in addition to `.ignore`
    custom_ignore_filenames: Arc<Vec<OsString>>,
    /// The matcher for custom ignore files
    custom_ignore_matcher: Gitignore,
    /// The matcher for .ignore files.
    ignore_matcher: Gitignore,
    /// A global gitignore matcher, usually from $XDG_CONFIG_HOME/git/ignore.
    git_global_matcher: Arc<Gitignore>,
    /// The matcher for .gitignore files.
    git_ignore_matcher: Gitignore,
    /// Special matcher for `.git/info/exclude` files.
    git_exclude_matcher: Gitignore,
    /// Whether this directory contains a .git sub-directory.
    has_git: bool,
    /// Ignore config.
    opts: IgnoreOptions,
}

impl Ignore {
    /// Return the directory path of this matcher.
    pub(crate) fn path(&self) -> &Path {
        &self.inner.dir
    }

    /// Return true if this matcher has no parent.
    pub(crate) fn is_root(&self) -> bool {
        self.inner.parent.is_none()
    }

    /// Returns true if this matcher was added via the `add_parents` method.
    pub(crate) fn is_absolute_parent(&self) -> bool {
        self.inner.is_absolute_parent
    }

    /// Return this matcher's parent, if one exists.
    pub(crate) fn parent(&self) -> Option<Ignore> {
        self.inner.parent.clone()
    }

    /// Create a new `Ignore` matcher with the parent directories of `dir`.
    ///
    /// Note that this can only be called on an `Ignore` matcher with no
    /// parents (i.e., `is_root` returns `true`). This will panic otherwise.
    pub(crate) fn add_parents<P: AsRef<Path>>(
        &self,
        path: P,
    ) -> (Ignore, Option<Error>) {
        if !self.inner.opts.parents
            && !self.inner.opts.git_ignore
            && !self.inner.opts.git_exclude
            && !self.inner.opts.git_global
        {
            // If we never need info from parent directories, then don't do
            // anything.
            return (self.clone(), None);
        }
        if !self.is_root() {
            panic!("Ignore::add_parents called on non-root matcher");
        }
        let absolute_base = match path.as_ref().canonicalize() {
            Ok(path) => Arc::new(path),
            Err(_) => {
                // There's not much we can do here, so just return our
                // existing matcher. We drop the error to be consistent
                // with our general pattern of ignoring I/O errors when
                // processing ignore files.
                return (self.clone(), None);
            }
        };
        // List of parents, from child to root.
        let mut parents = vec![];
        let mut path = &**absolute_base;
        while let Some(parent) = path.parent() {
            parents.push(parent);
            path = parent;
        }
        let mut errs = PartialErrorBuilder::default();
        let mut ig = self.clone();
        for parent in parents.into_iter().rev() {
            // TODO(1): build or reuse the matcher for `parent` here, chaining
            // it onto `ig`, reusing the shared `compiled` cache so ancestor
            // matchers are not rebuilt when many paths are searched. Newly
            // built matchers go into the cache (store `Arc::downgrade` of the
            // built inner). Parent matchers are built with `add_child_path`,
            // must have `is_absolute_parent` set to `true`, and (when
            // `opts.require_git && opts.git_ignore`) must recompute `has_git`
            // as `parent.join(".git").exists() || parent.join(".jj").exists()`.
        }
        (ig, errs.into_error_option())
    }

    /// Create a new `Ignore` matcher for the given child directory.
    ///
    /// Since building the matcher may require reading from multiple
    /// files, it's possible that this method partially succeeds. Therefore,
    /// a matcher is always returned (which may match nothing) and an error is
    /// returned if it exists.
    ///
    /// Note that all I/O errors are completely ignored.
    pub(crate) fn add_child<P: AsRef<Path>>(
        &self,
        dir: P,
    ) -> (Ignore, Option<Error>) {
        let (ig, err) = self.add_child_path(dir.as_ref());
        (Ignore { inner: Arc::new(ig) }, err)
    }

    /// Like add_child, but takes a full path and returns an IgnoreInner.
    fn add_child_path(&self, dir: &Path) -> (IgnoreInner, Option<Error>) {
        let check_vcs_dir = self.inner.opts.require_git
            && (self.inner.opts.git_ignore || self.inner.opts.git_exclude);
        let git_type = if check_vcs_dir {
            dir.join(".git").metadata().ok().map(|md| md.file_type())
        } else {
            None
        };
        let has_git =
            check_vcs_dir && (git_type.is_some() || dir.join(".jj").exists());

        let mut errs = PartialErrorBuilder::default();
        // ... builds the custom-ignore/.ignore/.gitignore/.git-info-exclude
        // matchers for `dir` (elided for length): custom_ig_matcher,
        // ig_matcher, gi_matcher, gi_exclude_matcher ...
        let ig = IgnoreInner {
            compiled: self.inner.compiled.clone(),
            dir: dir.to_path_buf(),
            overrides: self.inner.overrides.clone(),
            types: self.inner.types.clone(),
            parent: Some(self.clone()),
            is_absolute_parent: false,
            global_gitignores_relative_to: self
                .inner
                .global_gitignores_relative_to
                .clone(),
            explicit_ignores: self.inner.explicit_ignores.clone(),
            custom_ignore_filenames: self
                .inner
                .custom_ignore_filenames
                .clone(),
            custom_ignore_matcher: custom_ig_matcher,
            ignore_matcher: ig_matcher,
            git_global_matcher: self.inner.git_global_matcher.clone(),
            git_ignore_matcher: gi_matcher,
            git_exclude_matcher: gi_exclude_matcher,
            has_git,
            opts: self.inner.opts,
        };
        (ig, errs.into_error_option())
    }

    // ... has_any_ignore_rules, matched_dir_entry, matched (elided): `matched`
    // strips any leading `./`, checks override and file-type matchers, and
    // otherwise delegates to `matched_ignore` ...

    /// Performs matching only on the ignore files for this directory and
    /// all parent directories.
    fn matched_ignore<'a>(
        &'a self,
        path: &Path,
        is_dir: bool,
    ) -> Match<IgnoreMatch<'a>> {
        let (
            mut m_custom_ignore,
            mut m_ignore,
            mut m_gi,
            mut m_gi_exclude,
            mut m_explicit,
        ) = (Match::None, Match::None, Match::None, Match::None, Match::None);
        let any_git = !self.inner.opts.require_git
            || self.parents().any(|ig| ig.inner.has_git);
        let mut saw_git = false;
        for ig in self.parents().take_while(|ig| !ig.inner.is_absolute_parent)
        {
            if m_custom_ignore.is_none() {
                m_custom_ignore = ig
                    .inner
                    .custom_ignore_matcher
                    .matched(path, is_dir)
                    .map(IgnoreMatch::gitignore);
            }
            if m_ignore.is_none() {
                m_ignore = ig
                    .inner
                    .ignore_matcher
                    .matched(path, is_dir)
                    .map(IgnoreMatch::gitignore);
            }
            if any_git && !saw_git && m_gi.is_none() {
                m_gi = ig
                    .inner
                    .git_ignore_matcher
                    .matched(path, is_dir)
                    .map(IgnoreMatch::gitignore);
            }
            if any_git && !saw_git && m_gi_exclude.is_none() {
                m_gi_exclude = ig
                    .inner
                    .git_exclude_matcher
                    .matched(path, is_dir)
                    .map(IgnoreMatch::gitignore);
            }
            saw_git = saw_git || ig.inner.has_git;
        }
        if self.inner.opts.parents {
            if let Some(abs_parent_path) = self.absolute_base() {
                // What we want to do here is take the absolute base path of
                // this directory and join it with the path we're searching.
                // The main issue we want to avoid is accidentally duplicating
                // directory components, so we try to strip any common prefix
                // off of `path`. Overall, this seems a little ham-fisted, but
                // it does fix a nasty bug. It should do fine until we overhaul
                // this crate.
                let path = abs_parent_path.join(
                    self.parents()
                        .take_while(|ig| !ig.inner.is_absolute_parent)
                        .last()
                        .map_or(path, |ig| {
                            // This is a weird special case when ripgrep users
                            // search with just a `.`, as some tools do
                            // automatically (like consult). In this case, if
                            // we don't bail out now, the code below will strip
                            // a leading `.` from `path`, which might mangle
                            // a hidden file name!
                            if ig.inner.dir.as_path() == Path::new(".") {
                                return path;
                            }
                            let without_dot_slash = strip_if_is_prefix(
                                "./",
                                ig.inner.dir.as_path(),
                            );
                            let relative_base =
                                strip_if_is_prefix(without_dot_slash, path);
                            strip_if_is_prefix("/", relative_base)
                        }),
                );

                for ig in self
                    .parents()
                    .skip_while(|ig| !ig.inner.is_absolute_parent)
                {
                    if m_custom_ignore.is_none() {
                        m_custom_ignore = ig
                            .inner
                            .custom_ignore_matcher
                            .matched(&path, is_dir)
                            .map(IgnoreMatch::gitignore);
                    }
                    if m_ignore.is_none() {
                        m_ignore = ig
                            .inner
                            .ignore_matcher
                            .matched(&path, is_dir)
                            .map(IgnoreMatch::gitignore);
                    }
                    if any_git && !saw_git && m_gi.is_none() {
                        m_gi = ig
                            .inner
                            .git_ignore_matcher
                            .matched(&path, is_dir)
                            .map(IgnoreMatch::gitignore);
                    }
                    if any_git && !saw_git && m_gi_exclude.is_none() {
                        m_gi_exclude = ig
                            .inner
                            .git_exclude_matcher
                            .matched(&path, is_dir)
                            .map(IgnoreMatch::gitignore);
                    }
                    saw_git = saw_git || ig.inner.has_git;
                }
            }
        }
        for gi in self.inner.explicit_ignores.iter().rev() {
            if !m_explicit.is_none() {
                break;
            }
            m_explicit = gi.matched(&path, is_dir).map(IgnoreMatch::gitignore);
        }
        let m_global = if any_git {
            self.inner
                .git_global_matcher
                .matched(&path, is_dir)
                .map(IgnoreMatch::gitignore)
        } else {
            Match::None
        };

        m_custom_ignore
            .or(m_ignore)
            .or(m_gi)
            .or(m_gi_exclude)
            .or(m_global)
            .or(m_explicit)
    }

    /// Returns an iterator over parent ignore matchers, including this one.
    pub(crate) fn parents(&self) -> Parents<'_> {
        Parents(Some(self))
    }

    /// Returns the canonicalized path that was passed to the `add_parents`
    /// call that built this matcher's ancestor chain, if any. Returns `None`
    /// if `add_parents` was never involved.
    fn absolute_base(&self) -> Option<&Path> {
        // TODO(2)
    }
}

/// An iterator over all parents of an ignore matcher, including itself.
///
/// The lifetime `'a` refers to the lifetime of the initial `Ignore` matcher.
pub(crate) struct Parents<'a>(Option<&'a Ignore>);

impl<'a> Iterator for Parents<'a> {
    type Item = &'a Ignore;

    fn next(&mut self) -> Option<&'a Ignore> {
        match self.0.take() {
            None => None,
            Some(ig) => {
                self.0 = ig.inner.parent.as_ref();
                Some(ig)
            }
        }
    }
}

// ... IgnoreBuilder (elided): constructs the root `Ignore` with
// `parent: None`, an empty `compiled` cache, and the configured options ...

fn strip_if_is_prefix<'a, P: AsRef<Path> + ?Sized>(
    prefix: &'a P,
    path: &'a Path,
) -> &'a Path {
    strip_prefix(prefix, path).map_or(path, |p| p)
}
```

Your task: implement the two TODOs.

1. `TODO(1)`: the body of the loop in `add_parents` — build a matcher for each ancestor directory of `path`, from the filesystem root down, chaining each onto the previous via `add_child_path`, reusing and populating the shared `compiled` cache as described in the TODO comment.
2. `TODO(2)`: `matched_ignore` rewrites candidate paths via `self.absolute_base()`, whose contract is in its doc comment. Add whatever storage this requires (you may add or change fields) and implement the accessor.

Reply with compilable Rust for the missing pieces (plus any struct/field changes you need), and briefly explain your design.
