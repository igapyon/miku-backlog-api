export async function validateFieldsSelection(fields: unknown): Promise<void> {
  if (fields === undefined) {
    return;
  }
  if (typeof fields !== "string" || fields.trim().length === 0) {
    throw new Error("fields must be a non-empty GraphQL selection string.");
  }
  parseSelection(fields);
}

export async function selectResultFields(data: unknown, fields: unknown): Promise<unknown> {
  if (fields === undefined) {
    return data;
  }
  if (typeof fields !== "string") {
    throw new Error("fields must be a GraphQL selection string.");
  }
  return selectFields(data, parseSelection(fields));
}

interface FieldSelection {
  name: string;
  children?: readonly FieldSelection[];
}

function selectFields(data: unknown, fields: readonly FieldSelection[]): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => selectFields(item, fields));
  }
  if (!isRecord(data)) {
    return data;
  }
  const selected: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.name in data)) {
      continue;
    }
    const value = data[field.name];
    selected[field.name] = field.children === undefined
      ? value
      : selectFields(value, field.children);
  }
  return selected;
}

function parseSelection(input: string): readonly FieldSelection[] {
  let offset = 0;

  function fail(message: string): never {
    throw new Error(`Invalid GraphQL-style fields selection at character ${offset}: ${message}`);
  }

  function skipWhitespace(): void {
    while (offset < input.length && /[\t\n\r ,]/.test(input[offset] ?? "")) {
      offset += 1;
    }
  }

  function readName(): string {
    const start = offset;
    if (!/[A-Za-z_]/.test(input[offset] ?? "")) {
      fail("expected a field name");
    }
    offset += 1;
    while (/[A-Za-z0-9_]/.test(input[offset] ?? "")) {
      offset += 1;
    }
    return input.slice(start, offset);
  }

  function readSet(): readonly FieldSelection[] {
    skipWhitespace();
    if (input[offset] !== "{") {
      fail("expected '{'");
    }
    offset += 1;
    const fields: FieldSelection[] = [];
    while (true) {
      skipWhitespace();
      if (input[offset] === "}") {
        if (fields.length === 0) {
          fail("selection must contain at least one field");
        }
        offset += 1;
        return fields;
      }
      const name = readName();
      skipWhitespace();
      if (input[offset] === ":" || input[offset] === "(" || input[offset] === "@") {
        fail("aliases, arguments, and directives are not supported");
      }
      const children = input[offset] === "{" ? readSet() : undefined;
      fields.push({ name, ...(children === undefined ? {} : { children }) });
    }
  }

  const selection = readSet();
  skipWhitespace();
  if (offset !== input.length) {
    fail("unexpected trailing input");
  }
  return selection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
