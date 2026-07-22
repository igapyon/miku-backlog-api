import type { BacklogAccessEvent } from "./contracts.js";

export function formatBacklogAccessEvent(event: BacklogAccessEvent): string {
  return `verbose: ${JSON.stringify({ type: "backlog-api-access", ...event })}`;
}
