export { listOperations } from "./core/catalog.mjs";
export { getMapping, getUpstreamTrace } from "./core/traceability.mjs";
export { runOperation } from "./core/run-operation.mjs";

export const product = Object.freeze({
  name: "backlog-api",
  version: "0.3.0",
  upstream: "backlog-mcp-server@0.13.2"
});
