declare module "backlog-mcp-server/build/backlog/parseBacklogAPIError.js" {
  export function parseBacklogAPIError(error: unknown): { message: string } | undefined;
}

declare module "backlog-mcp-server/build/tools/tools.js" {
  interface ToolDefinition {
    name: string;
    description: string;
    schema: {
      safeParse(input: unknown):
        | { success: true; data: unknown }
        | {
            success: false;
            error: {
              issues: Array<{ path: PropertyKey[]; message: string }>;
            };
          };
    };
    handler(input: unknown): Promise<unknown>;
  }

  interface Toolset {
    name: string;
    tools: ToolDefinition[];
  }

  export function allTools(
    backlog: object,
    translation: {
      t(key: string, fallback: string): string;
      dump(): Record<string, never>;
    }
  ): { toolsets: Toolset[] };
}

declare module "backlog-mcp-server/build/handlers/transformers/wrapWithFieldPicking.js" {
  type SafeResult<T> = { kind: "ok"; data: T } | { kind: "error"; message: string };

  export function wrapWithFieldPicking<T>(
    handler: (input: Record<string, unknown>) => Promise<SafeResult<T>>
  ): (input: { fields?: string }) => Promise<SafeResult<T>>;
}
