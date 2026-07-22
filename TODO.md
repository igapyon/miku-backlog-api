# TODO

## Repository Split Completion

- [ ] Review and commit the initial Node-only migration on the `backlog-api`
      work branch before synchronizing the runtime back into
      `backlog-api-skills`.
- [ ] Confirm the initial standalone Node version and tag policy, including how
      the existing `0.3.0` version is carried forward after the repository split.
- [ ] Finalize the release artifact contract for `backlog-api-<version>.mjs`,
      `backlog-api-runtime-<version>.mjs`, source archives, and `SHA256SUMS`.
- [ ] After the Node migration is committed, rebuild from a clean worktree and
      run `npm run sync:runtime` in `backlog-api-skills` so its source record
      contains the exact Node commit, `dirty: false`, and the matching SHA-256.
- [ ] Verify the complete trace chain from the pinned `backlog-mcp-server`
      tag/commit/tool through the `backlog-api` version/commit/operation/artifact
      to the `backlog-api-skills` runtime checksum and workflow references.
- [ ] Confirm that CI and release workflows pass independently in both
      repositories and that the Node release contains no Agent Skill files.
- [ ] Register the Node-specific GitHub Issues using the Japanese drafts in
      `docs/github-issue-drafts.md`.

## Node Compatibility and Maintenance

- [ ] Add differential tests that invoke representative upstream MCP-composed
      handlers and converted Node operations with the same mocked Backlog
      responses.
- [ ] Decide whether to add CLI parity for upstream GraphQL-style `fields`
      selection and token limiting.
- [ ] Decide whether organization discovery should become a tracked Node
      meta-operation.
- [ ] Reduce the install-time dependency tree so unused MCP SDK and HTTP
      dependencies from the published upstream package are not installed. The
      generated runtime currently excludes them and tests verify that boundary.
- [ ] Validate a read-only operation against a real Backlog environment without
      storing credentials or tenant data.
- [ ] Recheck and regenerate all mappings when intentionally moving beyond
      upstream `v0.13.2`.
