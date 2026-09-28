import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut } from "./storage";

let tempDir = "";
afterEach(async () => {
  ENV.localStorageDir = "";
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = "";
});

describe("local storage", () => {
  it("writes uploaded bytes to the configured local data directory", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "scan-ordering-storage-"));
    ENV.localStorageDir = tempDir;
    const result = await storagePut("dishes/1/test.txt", Buffer.from("local-file"), "text/plain");
    expect(result.url).toMatch(/^\/manus-storage\/dishes\/1\/test_/);
    const filePath = path.join(tempDir, result.key);
    expect(await readFile(filePath, "utf8")).toBe("local-file");
    await expect(storageGetSignedUrl(result.key)).resolves.toBe(result.url);
  });
});
