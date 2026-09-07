import { z } from "zod";
import type { BacklogClientRegistry } from "./contracts.js";

interface LocalBacklogClient {
  getRateLimit(): Promise<unknown>;
  getProjectStatuses(projectIdOrKey: string | number): Promise<unknown>;
  getSharedFiles(
    projectIdOrKey: string | number,
    path: string,
    params: { order?: "asc" | "desc"; offset?: number; count?: number }
  ): Promise<unknown>;
  getIssueAttachment(issueIdOrKey: string | number, attachmentId: number): Promise<unknown>;
  getWikiAttachment(wikiId: number, attachmentId: number): Promise<unknown>;
  getSharedFile(projectIdOrKey: string | number, sharedFileId: number): Promise<unknown>;
}

interface ProjectStatusesInput {
  projectId?: number;
  projectKey?: string;
}

interface IssueAttachmentInput {
  issueId?: number;
  issueKey?: string;
  attachmentId: number;
}

interface WikiAttachmentInput {
  wikiId: number;
  attachmentId: number;
}

interface SharedFilesInput {
  projectId?: number;
  projectKey?: string;
  path: string;
  order?: "asc" | "desc";
  offset?: number;
  count?: number;
}

interface SharedFileInput {
  projectId?: number;
  projectKey?: string;
  sharedFileId: number;
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

const issueIdentifierSchema = {
  issueId: z.number().int().optional(),
  issueKey: z.string().min(1).optional()
};

const positiveInteger = z.number().int().positive();

const sharedFileSchema = z.object({
  id: positiveInteger,
  projectId: positiveInteger,
  type: z.string(),
  dir: z.string(),
  name: z.string(),
  size: z.number().nonnegative()
}).passthrough();

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
      },
      {
        name: "get_shared_files",
        description:
          "List one shared-file directory with paging and file or folder metadata.",
        schema: z.object({
          ...projectIdentifierSchema,
          path: z.string().min(1),
          order: z.enum(["asc", "desc"]).optional(),
          offset: z.number().int().nonnegative().optional(),
          count: z.number().int().min(1).max(1000).optional()
        }).strict(),
        outputSchema: z.array(sharedFileSchema),
        importantFields: ["id", "type", "dir", "name", "size"],
        async handler(input: unknown) {
          const value = input as SharedFilesInput;
          return client.getSharedFiles(
            projectIdOrKey(value.projectId, value.projectKey),
            value.path,
            compactPaging(value)
          );
        }
      },
      {
        name: "download_issue_attachment",
        description:
          "Open a readable stream for an attachment belonging to one issue.",
        binaryOutput: true,
        schema: z.object({
          ...issueIdentifierSchema,
          attachmentId: positiveInteger
        }).strict(),
        importantFields: ["attachmentId"],
        async handler(input: unknown) {
          const value = input as IssueAttachmentInput;
          return client.getIssueAttachment(
            issueIdOrKey(value.issueId, value.issueKey),
            value.attachmentId
          );
        }
      },
      {
        name: "download_wiki_attachment",
        description:
          "Open a readable stream for an attachment belonging to one Wiki page.",
        binaryOutput: true,
        schema: z.object({
          wikiId: positiveInteger,
          attachmentId: positiveInteger
        }).strict(),
        importantFields: ["wikiId", "attachmentId"],
        async handler(input: unknown) {
          const value = input as WikiAttachmentInput;
          return client.getWikiAttachment(value.wikiId, value.attachmentId);
        }
      },
      {
        name: "download_shared_file",
        description:
          "Open a readable stream for one shared file in a project.",
        binaryOutput: true,
        schema: z.object({
          ...projectIdentifierSchema,
          sharedFileId: positiveInteger
        }).strict(),
        importantFields: ["projectId", "projectKey", "sharedFileId"],
        async handler(input: unknown) {
          const value = input as SharedFileInput;
          return client.getSharedFile(
            projectIdOrKey(value.projectId, value.projectKey),
            value.sharedFileId
          );
        }
      }
    ]
  };
}

export function isClientlessLocalOperation(operation: string): boolean {
  return operation === "list_organizations";
}

export function isBinaryLocalOperation(operation: string): boolean {
  return operation === "download_issue_attachment" ||
    operation === "download_wiki_attachment" ||
    operation === "download_shared_file";
}

function issueIdOrKey(issueId: number | undefined, issueKey: string | undefined): string | number {
  if (issueId !== undefined && issueId > 0) {
    return issueId;
  }
  if (issueKey !== undefined) {
    return issueKey;
  }
  throw new Error("Issue ID or key is required.");
}

function projectIdOrKey(
  projectId: number | undefined,
  projectKey: string | undefined
): string | number {
  if (projectId !== undefined && projectId > 0) {
    return projectId;
  }
  if (projectKey !== undefined) {
    return projectKey;
  }
  throw new Error("Project ID or key is required.");
}

function compactPaging(value: SharedFilesInput): {
  order?: "asc" | "desc";
  offset?: number;
  count?: number;
} {
  return {
    ...(value.order === undefined ? {} : { order: value.order }),
    ...(value.offset === undefined ? {} : { offset: value.offset }),
    ...(value.count === undefined ? {} : { count: value.count })
  };
}
