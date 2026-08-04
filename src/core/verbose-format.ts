import type { BacklogAccessEvent } from "./contracts.js";

export function formatBacklogAccessEvent(event: BacklogAccessEvent): string {
  return `verbose: ${JSON.stringify({ type: "miku-backlog-api-access", ...event })}`;
}
