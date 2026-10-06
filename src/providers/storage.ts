import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { StorageProvider } from "./interfaces";
const root = path.resolve(
  /* turbopackIgnore: true */ process.env.STORAGE_PATH || ".storage",
);
function resolveKey(key: string) {
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key) || key.includes(".."))
    throw new Error("Invalid storage key");
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error("Invalid path");
  return p;
}
export const storage: StorageProvider = {
  async put(key, bytes) {
    if (bytes.length > 10 * 1024 * 1024)
      throw new Error("Media exceeds size limit");
    const p = resolveKey(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, bytes, { flag: "wx" });
  },
  async get(key) {
    return readFile(/* turbopackIgnore: true */ resolveKey(key));
  },
};
