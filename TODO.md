# TODO

## `miku-` Prefix Rename

- [ ] Complete the staged rename plan in
      [`docs/miku-prefix-rename-plan.md`](docs/miku-prefix-rename-plan.md) for
      [Issue #21](https://github.com/igapyon/backlog-api/issues/21).
- [x] Confirm the target-name, compatibility, version, and release-asset
      decisions before changing product or repository names.
- [x] Prepare and verify the `miku-backlog-api` product, CLI, machine-readable
      identifiers, bundle, documentation, and test changes in this repository.
- [ ] After the prepared change is merged, have the repository owner rename
      `igapyon/backlog-api` to `igapyon/miku-backlog-api` and complete the
      documented GitHub and local-remote checks.
- [ ] Publish and verify the first `miku-backlog-api` Release without modifying
      historical tags, Releases, or assets.
- [ ] Migrate the sister `backlog-api-skills` repository to the new runtime,
      repository, package, bundle, and installed Skill names while preserving
      the documented compatibility triggers and historical runtime lookup.
- [ ] Have the repository owner rename `igapyon/backlog-api-skills` to
      `igapyon/miku-backlog-api-skills`, then complete cross-repository
      verification before closing Issue #21.

## Repository Split Completion

- [ ] Review and commit the initial Node-only migration on the `backlog-api`
      work branch before synchronizing the runtime back into
      `backlog-api-skills`.
- [ ] Confirm the initial standalone Node version and tag policy, including how
      the existing `0.3.0` version is carried forward after the repository split.
- [ ] Finalize the transition Release artifact contract for
      `miku-backlog-api-<version>.mjs`,
      `miku-backlog-api-runtime-<version>.mjs`, source archives, and
      `SHA256SUMS`.
- [ ] After the Node migration is committed, rebuild from a clean worktree and
      run `npm run sync:runtime` in `backlog-api-skills` so its source record
      contains the exact Node commit, `dirty: false`, and the matching SHA-256.
- [ ] Verify the complete trace chain from the pinned `backlog-mcp-server`
      tag/commit/tool through the `miku-backlog-api` version/commit/operation/artifact
      to the sister Skill runtime checksum and workflow references.
- [ ] Confirm that CI and release workflows pass independently in both
      repositories and that the Node release contains no Agent Skill files.
- [x] Register the Node-specific GitHub Issues as
      [Issues #2–#7 and #18](https://github.com/igapyon/backlog-api/issues).

## Node Compatibility and Maintenance

- [x] Refresh the upstream compatibility baseline to `backlog-mcp-server`
      v0.14.0 for [Issue #18](https://github.com/igapyon/backlog-api/issues/18),
      including operation mapping, safety contracts, differential tests, and
      downstream handoff prerequisites for [Issue #7](https://github.com/igapyon/backlog-api/issues/7).

Node compatibility and maintenance work is tracked in
[GitHub Issues #2–#7 and #18](https://github.com/igapyon/backlog-api/issues).
