export { listOperations } from "./core/catalog.js";
export type {
  BacklogAccessEvent,
  CrudPermission,
  RunOperationOptions
} from "./core/contracts.js";
export { getMapping, getUpstreamTrace } from "./core/traceability.js";
export { runOperation } from "./core/run-operation.js";

export const product = Object.freeze({
  name: "backlog-api",
  version: "0.3.3",
  upstream: "backlog-mcp-server@0.13.2"
});
