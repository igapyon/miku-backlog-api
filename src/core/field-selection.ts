import { wrapWithFieldPicking } from "backlog-mcp-server/build/handlers/transformers/wrapWithFieldPicking.js";

export async function validateFieldsSelection(fields: unknown): Promise<void> {
  if (fields === undefined) {
    return;
  }
  if (typeof fields !== "string" || fields.trim().length === 0) {
    throw new Error("fields must be a non-empty GraphQL selection string.");
  }
  await selectFields({}, fields);
}

export async function selectResultFields(data: unknown, fields: unknown): Promise<unknown> {
  if (fields === undefined) {
    return data;
  }
  if (typeof fields !== "string") {
    throw new Error("fields must be a GraphQL selection string.");
  }
  const result = await selectFields(data, fields);
  if (result.kind === "error") {
    throw new Error(result.message);
  }
  return result.data;
}

async function selectFields(data: unknown, fields: string) {
  const select = wrapWithFieldPicking(async () => ({ kind: "ok", data }));
  return select({ fields });
}
