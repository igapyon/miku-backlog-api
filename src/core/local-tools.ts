interface LocalBacklogClient {
  getRateLimit(): Promise<unknown>;
}

export function createLocalToolset(backlog: object) {
  const client = backlog as LocalBacklogClient;
  return {
    name: "backlog-api",
    description: "Operations provided directly by the backlog-api Node runtime.",
    enabled: false,
    tools: [
      {
        name: "get_rate_limit",
        description:
          "Get Backlog API rate limits for read, update, search, and icon requests.",
        schema: {
          safeParse(input: unknown) {
            if (
              typeof input !== "object" ||
              input === null ||
              Array.isArray(input) ||
              Object.keys(input).length > 0
            ) {
              return {
                success: false as const,
                error: {
                  issues: [{
                    path: [] as PropertyKey[],
                    message: "get_rate_limit does not accept operation arguments."
                  }]
                }
              };
            }
            return { success: true as const, data: {} };
          }
        },
        async handler() {
          return client.getRateLimit();
        }
      }
    ]
  };
}
