import fs from "fs/promises";
import path from "path";

/**
 * Recursively deletes empty folders starting from `dir`.
 * Adds log messages to the provided `logs` array.
 * 
 * @param {string} dir - Directory path to check and delete if empty
 * @param {string[]} logs - Array to store log messages
 */
export async function deleteEmptyFolders(dir, logs) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  if (entries.length === 0) {
    await fs.rmdir(dir);
    logs.push(`🧹 Deleted empty folder: ${dir}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await deleteEmptyFolders(fullPath, logs);
    }
  }

  const check = await fs.readdir(dir);
  if (check.length === 0 && dir !== process.cwd()) {
    await fs.rmdir(dir);
    logs.push(`🧹 Deleted empty folder: ${dir}`);
  }
}
