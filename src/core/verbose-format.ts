import type { BacklogAccessEvent } from "./contracts.js";

export function formatBacklogAccessEvent(event: BacklogAccessEvent): string {
  return (
    `verbose: phase=${event.phase} access=${event.access} ` +
    `operation=${event.operation} method=${event.method} ` +
    `permission=${event.permission} organization=${event.organization}`
  );
}
