# `miku-` Prefix Rename Plan

## Status and Objective

- Status: local main-repository implementation completed and verified on
  2026-08-04. GitHub repository renames and Release publication remain pending
  human gates.
- Tracking Issue:
  [#21](https://github.com/igapyon/backlog-api/issues/21)
- Main repository target:
  `igapyon/backlog-api` -> `igapyon/miku-backlog-api`
- Sister repository target:
  `igapyon/backlog-api-skills` ->
  `igapyon/miku-backlog-api-skills`

The objective is to adopt the current `miku-<domain>` naming pattern without
changing the Backlog API domain vocabulary, losing historical Releases, or
breaking the runtime handoff between the main application and its Agent Skill
without an explicit compatibility decision.

Repository renames, tag creation, GitHub Release publication, and other GitHub
settings changes are human-owned operations. Local implementation must stop at
each human gate identified below.

## Planned Name Map

| Surface | Current name | Target name | Planned treatment |
| --- | --- | --- | --- |
| Main GitHub repository | `igapyon/backlog-api` | `igapyon/miku-backlog-api` | Rename at Human Gate A |
| Node package | `backlog-api` | `miku-backlog-api` | Rename with the main implementation |
| Product metadata | `backlog-api` | `miku-backlog-api` | Rename with the main implementation |
| Canonical CLI name | `backlog-api` | `miku-backlog-api` | Keep the old CLI name temporarily as an alias |
| CLI bundle | `backlog-api.mjs` | `miku-backlog-api.mjs` | New name from the transition Release |
| Runtime bundle | `backlog-api-runtime.mjs` | `miku-backlog-api-runtime.mjs` | New name from the transition Release |
| Source archive | `backlog-api-sources.tgz` | `miku-backlog-api-sources.tgz` | New name from the transition Release |
| Release assets | `backlog-api-<version>.*` | `miku-backlog-api-<version>.*` | Do not alter historical assets |
| Local toolset and trace origin | `backlog-api` | `miku-backlog-api` | Change together as one beta contract migration |
| Verbose event type | `backlog-api-access` | `miku-backlog-api-access` | Change with the machine-readable contract |
| Backlog environment variables | `BACKLOG_*`, `BACKLOG_API_*` | unchanged | Domain configuration, not product branding |
| Upstream product | `backlog-mcp-server` | unchanged | External upstream identity |
| Sister GitHub repository | `igapyon/backlog-api-skills` | `igapyon/miku-backlog-api-skills` | Rename at Human Gate B |
| Installed Agent Skill | `igapyon-backlog-api` | `igapyon-miku-backlog-api` | Keep old product and repository names as triggers |

## Decision Gate 0: Freeze the Migration Contract

Complete the local policy decisions before editing implementation files, then
record them in Issue #21 before the integration gate.

- [x] Confirm `miku-backlog-api` and `miku-backlog-api-skills` as the final
      repository and product names.
- [x] Confirm the transition version `0.7.0`, using
      a minor release to carry the beta contract migration from `0.6.0`.
- [x] Confirm that `product.name`, the local toolset, trace origin, and verbose
      event type all move to the new name in the same version.
- [x] Confirm that `BACKLOG_DOMAIN`, `BACKLOG_API_KEY`,
      `BACKLOG_API_ALLOWED_PERMISSIONS`, other `BACKLOG_*` variables, upstream
      operation names, and `backlog-mcp-server` remain unchanged.
- [x] Confirm that the `backlog-api` CLI alias remains for all `0.7.x`
      releases and that its removal is a separate `0.8.0` or later decision.
- [x] Confirm that old Agent Skill trigger phrases remain accepted after the
      installed Skill name changes.
- [x] Confirm that new Releases publish only canonical new asset names. The
      sister runtime resolver must support old names for historical Releases
      and new names for the transition and later Releases.
- [ ] Record the accepted decisions in Issue #21 before Integration Gate 1.

Gate result: every row in the name map has one approved treatment, transition
version, and compatibility duration.

## Work Package 1: Inventory Producers and Consumers

- [ ] Capture the clean branch, worktree, current version, current tag, and
      current Release baseline.
- [ ] Classify every repository occurrence of `backlog-api`,
      `backlog-api-skills`, and `BACKLOG_API` as `rename`, `compatibility`, or
      `keep`.
- [ ] Inspect at least these producer surfaces:
  - `package.json` and `package-lock.json`
  - `src/product.ts` and `src/cli.ts`
  - local toolset, contract, traceability, and verbose event code under
    `src/core/`
  - `scripts/build-node.mjs`, `scripts/smoke-node.mjs`, and
    `scripts/generate-upstream-tool-mapping.mjs`
  - `.github/workflows/release-build.yml`
  - README, TODO, development notes, and traceability documents
  - generated traceability records and all affected tests
- [ ] Inventory consumers in `backlog-api-skills`, including the upstream
      repository URL, release download path, runtime filename resolver,
      checksum/source record, formal Skill name, activation triggers, bundle
      paths, tests, and release asset names.
- [ ] Identify references outside the two repositories: local clones, saved
      clone commands, badges, GitHub About links, automation, webhook targets,
      documentation, and installed Skill directories.
- [ ] Record every historical tag and Release as immutable migration input.

Useful inventory commands:

```bash
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' \
  'backlog-api|backlog-api-skills|BACKLOG_API' .
git status -sb
git remote -v
```

Gate result: no producer or known consumer remains unclassified.

## Work Package 2: Prepare the Main Repository Rename

Perform this work while the GitHub repository is still named `backlog-api`.

- [x] Use the active dedicated work branch from the agreed base.
- [x] Update the package, product metadata, canonical CLI name, and help text.
- [x] Add and test the temporary `backlog-api` CLI alias without making it the
      canonical name in new examples.
- [x] Update the local toolset, trace origin, verbose event type, and their
      TypeScript contracts together.
- [x] Rename build outputs and metadata outputs to the three canonical
      `miku-backlog-api` bundle names.
- [x] Update the Release workflow to stage exact versioned
      `miku-backlog-api` asset names and generate checksums from the final
      staged bytes.
- [x] Update smoke scripts to run the final CLI bundle and import the final
      runtime bundle.
- [x] Update generated traceability inputs and regenerate committed mappings
      with the repository command.
- [x] Update README, TODO, development notes, runtime-handoff documentation,
      and tests.
- [x] Verify that Backlog environment variables, upstream operation names,
      and `backlog-mcp-server` references were not renamed.
- [x] Search again for old names. Retained occurrences are the package CLI
      alias, historical facts, current GitHub URLs pending human rename gates,
      and the documented sister-repository migration.

Required verification:

```bash
npm run typecheck
npm run trace:refresh
npm test
npm run smoke:node
git status --short
git diff --check
```

Gate result: the main repository builds and tests with new canonical product
and artifact names before any GitHub repository rename occurs.

## Integration Gate 1: Merge and Freeze

- [ ] Review the complete diff and its compatibility classification.
- [ ] Merge the verified main-repository change using the normal human review
      process.
- [ ] Confirm the target branch is clean and contains the intended rename
      commit.
- [ ] Pause unrelated merges, tags, and Releases until Human Gate A and the
      post-rename checks are complete.
- [ ] Record the exact pre-rename commit in Issue #21.

Do not publish the transition Release before Human Gate A succeeds.

## Human Gate A: Rename the Main GitHub Repository

The repository owner performs this gate in GitHub.

1. Rename `igapyon/backlog-api` to `igapyon/miku-backlog-api` in repository
   settings.
2. Confirm the new repository URL and test the old URL behavior.
3. Confirm that Issues, pull requests, tags, Releases, the default branch,
   rulesets or branch protection, Actions, secrets, variables, environments,
   webhooks, deploy keys, and other repository integrations are present and
   correctly targeted.
4. Update GitHub About text, website links, and topics when needed.
5. Update each maintained local clone:

   ```bash
   git remote set-url origin git@github.com:igapyon/miku-backlog-api.git
   git remote -v
   git ls-remote origin
   ```

6. Record the rename time and post-rename verification result in Issue #21.

Gate result: the new GitHub name is authoritative and normal read access,
repository settings, and automation remain usable.

## Work Package 3: Publish the Transition Main Release

- [ ] Rebuild from a clean checkout of the exact transition commit after the
      GitHub repository rename.
- [ ] Repeat all required typecheck, trace, test, build, and smoke commands.
- [ ] Verify the final staged files are exactly:
  - `miku-backlog-api-<version>.mjs`
  - `miku-backlog-api-runtime-<version>.mjs`
  - `miku-backlog-api-sources-<version>.tgz`
  - `SHA256SUMS`
- [ ] Verify checksums against the final bytes and confirm no Agent Skill
      files are present in the main application Release.
- [ ] Have the repository owner create the approved `v<version>` tag and
      GitHub Release from the exact verified commit.
- [ ] Confirm that the Release workflow checks out the tag and attaches only
      the expected new-name assets.
- [ ] Download or otherwise independently verify the published assets before
      the sister repository consumes them.
- [ ] Leave all historical tags, Releases, asset names, and checksums intact.

Gate result: one verified, immutable Release under
`igapyon/miku-backlog-api` is available for the sister repository.

## Work Package 4: Migrate the Sister Agent Skill Repository

Do not start runtime pinning until Work Package 3 has a verified Release.

- [ ] Create a dedicated branch in `backlog-api-skills` from its agreed base.
- [ ] Change the upstream repository and Release references to
      `igapyon/miku-backlog-api`.
- [ ] Receive the exact published CLI/runtime artifact required by the Skill
      workflow and record its source tag, commit, filename, and SHA-256.
- [ ] Update runtime discovery so historical pinned artifacts named
      `backlog-api-*` and new artifacts named `miku-backlog-api-*` are resolved
      deliberately, without ambiguous broad search.
- [ ] Rename the repository package and bundle outputs to
      `miku-backlog-api-skills`.
- [ ] Rename the formal and installed Agent Skill to
      `igapyon-miku-backlog-api` with an installed path of
      `skills/igapyon-miku-backlog-api/`.
- [ ] Keep `backlog-api`, `backlog-api-skills`, and
      `igapyon-backlog-api` as documented compatibility triggers; do not
      create a second installed Skill identity solely for aliases.
- [ ] Update `SKILL.md`, references, generated `index.json`, README, source
      records, runtime smoke tests, bundle tests, and release asset tests.
- [ ] Run every repository-documented test, runtime smoke, isolated bundle
      smoke, and bundle-content verification command.
- [ ] Search all remaining old-name occurrences and document their intentional
      compatibility purpose.

Gate result: the new installed Skill name works with the new published runtime,
and old user trigger phrases still route to the same Skill.

## Integration Gate 2: Merge the Sister Change

- [ ] Review and merge the verified sister-repository change.
- [ ] Confirm the target branch is clean and records the exact main runtime
      tag, commit, filename, and checksum.
- [ ] Pause unrelated sister tags and Releases until Human Gate B completes.
- [ ] Record the exact sister commit in Issue #21.

## Human Gate B: Rename the Sister GitHub Repository

The repository owner performs this gate in GitHub.

1. Rename `igapyon/backlog-api-skills` to
   `igapyon/miku-backlog-api-skills`.
2. Repeat the URL, history, settings, Actions, credentials, webhook, and local
   remote checks from Human Gate A for the sister repository.
3. Update local remotes to the new sister URL.
4. Create the approved Skill Release from the verified sister commit.
5. Verify a clean installation from the published Skill bundle and execute a
   read-only runtime smoke through the installed layout.

Gate result: the new sister repository, Release bundle, installed Skill path,
and main-runtime source record form one verified chain.

## Work Package 5: Cross-Repository Closure

- [ ] Update remaining cross-repository links, badges, clone examples, GitHub
      About fields, and installation instructions.
- [ ] Verify the trace chain from `backlog-mcp-server` through the new main
      repository Release to the new sister repository runtime checksum and
      installed Skill bundle.
- [ ] Verify both repositories' default branches, CI, Release workflows, tags,
      Releases, Issues, and local remotes under their new names.
- [ ] Verify old URLs and trigger phrases according to the approved
      compatibility contract.
- [ ] Search both repositories for old names and retain only historical facts,
      immutable Release references, and approved compatibility aliases.
- [ ] Record deferred cleanup, including any future removal of the old CLI
      alias, as separate versioned work.
- [ ] Post the final mapping, version, commits, Release URLs, checksums,
      compatibility results, and known exceptions to Issue #21.
- [ ] Close Issue #21 only after every gate has evidence and no required work
      remains.

## Rollback Rules

- Before a Release is published, revert implementation with a normal revert
  commit; do not rewrite shared history.
- If a GitHub rename fails before publication, the repository owner may rename
  it back and restore local remotes after confirming the exact target.
- If the transition main Release is already published, do not delete, replace,
  or silently overwrite its tag or assets. Publish a corrective version and
  keep the failed version documented.
- If sister migration fails, keep the previous Skill Release usable and do not
  remove its historical runtime lookup or compatibility triggers.
- Do not remove the old CLI alias until the separately approved compatibility
  window has ended and known consumers have been checked.

## Completion Definition

The rename is complete only when:

- both GitHub repositories use the new names;
- the main package, product, canonical CLI, machine-readable identifiers, and
  current Release assets use `miku-backlog-api`;
- Backlog environment variables and upstream names remain stable;
- historical Releases remain intact;
- the sister repository consumes a verified new-name runtime artifact;
- the installed Skill is `igapyon-miku-backlog-api` and documented old trigger
  names still work;
- CI, build, smoke, bundle, checksum, and cross-repository trace verification
  pass; and
- Issue #21 contains the final evidence and is ready to close.
