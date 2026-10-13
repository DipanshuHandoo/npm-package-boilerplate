# Changesets

Every user-facing change needs a changeset: run `npm run changeset`, pick the bump type and
describe the change. CI fails pull requests that change `src/` without one. Merging to `main`
makes the version workflow open a "Version Packages" pull request; merging that PR updates the
version and `CHANGELOG.md`. Publishing is a separate, manual step (see `MAINTAINING.md`).
