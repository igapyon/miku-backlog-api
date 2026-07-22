import mapping from "../../docs/traceability/upstream-tool-mapping.json" with { type: "json" };
import type { UpstreamTrace } from "./contracts.js";

const byOperation = new Map(
  mapping.operations.map((entry) => [entry.operation, entry])
);

export function getUpstreamTrace(operation: string): UpstreamTrace {
  const entry = byOperation.get(operation);
  return {
    repository: mapping.upstream.repository,
    version: mapping.upstream.version,
    commit: mapping.upstream.commit,
    operation,
    source: entry?.upstreamSource,
    test: entry?.upstreamTest
  };
}

export function getMapping(): typeof mapping {
  return mapping;
}
