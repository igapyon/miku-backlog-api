import { z } from "zod";
import type { BacklogClientRegistry } from "./contracts.js";

interface LocalBacklogClient {
  getRateLimit(): Promise<unknown>;
  getProjectStatuses(projectIdOrKey: string | number): Promise<unknown>;
}

interface ProjectStatusesInput {
  projectId?: number;
  projectKey?: string;
}

interface LocalToolOptions {
  registry?: BacklogClientRegistry;
}

const rateLimitBucketSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number()
});

const projectStatusSchema = z.object({
  id: z.number(),
  projectId: z.number(),
  name: z.string(),
  color: z.string(),
  displayOrder: z.number()
});

const projectIdentifierSchema = {
  projectId: z.number().optional(),
  projectKey: z.string().optional()
};

export function createLocalToolset(backlog: object, options: LocalToolOptions = {}) {
  const client = backlog as LocalBacklogClient;
  return {
    name: "miku-backlog-api",
    description: "Operations provided directly by the miku-backlog-api Node runtime.",
    enabled: false,
    tools: [
      {
        name: "list_organizations",
        description:
          "List configured Backlog organizations and identify the default organization.",
        schema: z.object({}).strict(),
        outputSchema: z.array(z.object({
          name: z.string(),
          domain: z.string(),
          isDefault: z.boolean()
        })),
        importantFields: ["name", "domain", "isDefault"],
        async handler() {
          if (options.registry === undefined) {
            throw new Error("Configured organization metadata is unavailable.");
          }
          return options.registry.listOrganizations();
        }
      },
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
      },
      {
        name: "get_project_statuses",
        description:
          "Get the status list configured for one Backlog project.",
        schema: z.object(projectIdentifierSchema),
        outputSchema: z.array(projectStatusSchema),
        importantFields: ["id", "projectId", "name", "displayOrder"],
        async handler(input: unknown) {
          const { projectId, projectKey } = input as ProjectStatusesInput;
          const projectIdOrKey = projectId !== undefined && projectId > 0
            ? projectId
            : projectKey;
          if (projectIdOrKey === undefined) {
            throw new Error("Project ID or key is required.");
          }
          return client.getProjectStatuses(projectIdOrKey);
        }
      }
    ]
  };
}

export function isClientlessLocalOperation(operation: string): boolean {
  return operation === "list_organizations";
}
