# Template setup and release-pipeline test

Template-repository only. `npm run init` removes this folder from generated packages; their
day-to-day release runbook is `MAINTAINING.md`.

## A. Template repository (once)

1. Settings → General → tick **Template repository**.
2. Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create
   and approve pull requests** (the Version Packages workflow needs it).
3. Settings → Branches (or Rules) → protect `main`: require a pull request and the CI checks.
4. Settings → Code security → enable Dependabot alerts and secret scanning.

## B. Each new package

1. **Use this template** on GitHub (or `gh repo create <owner>/<name> --template <owner>/npm-package-boilerplate --public --clone`), then clone it.
   Never run `init` inside the template repository itself.
2. `npm ci`, then
   `npm run init -- --name <name> --owner <owner> --repo <owner>/<repo> --description "..." --language ts|js --browser true|false --yes`
3. Replace `src/`, `docs/`, `examples/` and the README with your package. Run `npm run verify`.
4. Commit and push. Repeat A.2 and A.3 for the new repository.
5. Settings → Environments → create **`npm`**, add required reviewers, and restrict it to `main`.
6. npm trusted publisher: on npmjs.com open the package → Settings → Trusted publisher → GitHub
   Actions, with owner, repo, workflow `release.yml` and environment `npm`.
   Open question: npm may not allow registering this before the package's first version exists.
   If so, publish the first version once manually with a short-lived token, then register the
   trusted publisher and revoke the token.

## C. Every release

1. Add a changeset in your PR (`npm run changeset`) and merge it.
2. The Version Packages workflow opens a "Version Packages" PR. Merge it.
3. Wait for CI to pass on that commit.
4. Actions → **Release** → Run workflow on `main`, and type the version in `confirm-version`.
5. Approve the `npm` environment prompt.
6. The workflow publishes, then tags and creates the GitHub release.
   If publish succeeds but finalize fails, re-run only finalize. Never republish.

## D. Test the release pipeline first (throwaway package)

Publishing is irreversible and public, so do this once before relying on the pipeline.

1. `gh repo create <owner>/release-test --template <owner>/npm-package-boilerplate --public --clone`
2. In it: `npm ci`, then
   `npm run init -- --name @<npm-scope>/<test-name> --owner <owner> --repo <owner>/release-test --description "Release pipeline test" --language ts --yes`
3. `npm run verify`, commit, push.
4. Do A.2 and B.5 for this repository, and B.6 for the npm side.
5. Add a changeset (a prerelease is ideal so it goes to the `next` dist-tag), merge it, merge the
   Version Packages PR, then run the **Release** workflow and approve the `npm` environment.
6. Check the npm page (version, dist-tag, provenance badge), the git tag and the GitHub release.
7. Clean up: `npm deprecate "<name>@*" "release pipeline test"`.

## What is not automated

- GitHub repository and environment settings (UI only).
- npm account, scope and trusted-publisher setup (UI only).
- `release.yml` has not been exercised end to end yet. Step D is how to prove it.
