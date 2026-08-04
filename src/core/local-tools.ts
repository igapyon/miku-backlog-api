import { z } from "zod";

interface LocalBacklogClient {
  getRateLimit(): Promise<unknown>;
}

const rateLimitBucketSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number()
});

export function createLocalToolset(backlog: object) {
  const client = backlog as LocalBacklogClient;
  return {
    name: "miku-backlog-api",
    description: "Operations provided directly by the miku-backlog-api Node runtime.",
    enabled: false,
    tools: [
      {
        name: "get_rate_limit",
        description:
          "Get Backlog API rate limits for read, update, search, and icon requests.",
        schema: z.object({}).strict(),
        outputSchema: z.object({
          rateLimit: z.object({
            read: rateLimitBucketSchema,
            update: rateLimitBucketSchema,
            search: rateLimitBucketSchema,
            icon: rateLimitBucketSchema
          })
        }),
        importantFields: ["rateLimit"],
        async handler() {
          return client.getRateLimit();
        }
      }
    ]
  };
}
