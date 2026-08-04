import mapping from "../../docs/traceability/upstream-tool-mapping.json" with { type: "json" };
import type { UpstreamTrace } from "./contracts.js";

interface TraceMappingEntry {
  operation: string;
  origin?: "upstream" | "miku-backlog-api";
  upstreamSource: string | null;
  upstreamTest: string | null;
  targetEntry: string;
  targetTest?: string | null;
}

const byOperation = new Map(
  mapping.operations.map((entry) => [
    entry.operation,
    entry as TraceMappingEntry
  ])
);

export function getUpstreamTrace(operation: string): UpstreamTrace {
  const entry = byOperation.get(operation);
  if (entry?.origin === "miku-backlog-api") {
    return {
      origin: "miku-backlog-api",
      repository: mapping.target.repository,
      version: mapping.target.version,
      operation,
      source: entry.targetEntry,
      test: entry.targetTest
    };
  }
  return {
    origin: "upstream",
    repository: mapping.upstream.repository,
    version: mapping.upstream.version,
    commit: mapping.upstream.commit,
    operation,
    source: entry?.upstreamSource ?? undefined,
    test: entry?.upstreamTest
  };
}

export function getMapping(): typeof mapping {
  return mapping;
}
