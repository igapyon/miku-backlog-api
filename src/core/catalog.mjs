import { allTools } from "backlog-mcp-server/build/tools/tools.js";

const fallbackTranslation = {
  t(_key, fallback) {
    return fallback;
  },
  dump() {
    return {};
  }
};

const metadataOnlyClient = new Proxy({}, {
  get(_target, property) {
    return async () => {
      throw new Error(
        `Backlog client method ${String(property)} cannot run during metadata discovery.`
      );
    };
  }
});

export function createToolsets(backlog = metadataOnlyClient) {
  return allTools(backlog, fallbackTranslation).toolsets;
}

export function listOperations() {
  return createToolsets()
    .flatMap((toolset) => toolset.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      toolset: toolset.name,
      mutationClass: classifyMutation(tool.name)
    })))
    .sort((left, right) => compareUtf16(left.name, right.name));
}

export function resolveTool(backlog, operationName) {
  for (const toolset of createToolsets(backlog)) {
    const tool = toolset.tools.find((candidate) => candidate.name === operationName);
    if (tool) {
      return { tool, toolset: toolset.name };
    }
  }
  return undefined;
}

export function classifyMutation(operationName) {
  if (operationName.startsWith("delete_")) {
    return "destructive";
  }
  if (operationName === "reset_unread_notification_count") {
    return "broad-mutation";
  }
  if (
    operationName.startsWith("add_") ||
    operationName === "addDocument" ||
    operationName.startsWith("update_") ||
    operationName.startsWith("mark_")
  ) {
    return "mutation";
  }
  return "read";
}

function compareUtf16(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
