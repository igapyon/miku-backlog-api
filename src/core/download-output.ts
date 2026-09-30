import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { DownloadTransfer } from "./contracts.js";

export async function writeDownloadToOutput(
  transfer: DownloadTransfer,
  outputPath: string
): Promise<void> {
  if (outputPath === "-") {
    await pipeline(nodeReadable(transfer.body), process.stdout, { end: false });
    await transfer.completed;
    return;
  }

  const destination = path.resolve(outputPath);
  if (fs.existsSync(destination)) {
    throw new Error(`Refusing to overwrite existing output file: ${destination}`);
  }
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${randomUUID()}.part`
  );
  let published = false;
  try {
    await pipeline(
      nodeReadable(transfer.body),
      fs.createWriteStream(temporary, { flags: "wx" })
    );
    await transfer.completed;
    publishNewFile(temporary, destination);
    published = true;
  } finally {
    if (!published) {
      fs.rmSync(temporary, { force: true });
    }
  }
}

function nodeReadable(body: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]);
}

function publishNewFile(temporary: string, destination: string): void {
  try {
    // `link` creates the destination atomically and fails if another process
    // created it after the initial existence check. Both paths share a parent
    // directory, so they are necessarily on the same file system.
    fs.linkSync(temporary, destination);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      throw new Error(`Refusing to overwrite existing output file: ${destination}`);
    }
    throw error;
  }
  fs.rmSync(temporary);
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "EEXIST";
}
