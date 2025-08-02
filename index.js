import express from "express";
import fsn from "fs";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

let lastMoved = [];
let logs = [];



// Helper to hash files for duplicate detection
async function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fsn.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// 🧹 Helper to delete empty folders recursively
async function deleteEmptyFolders(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  if (entries.length === 0) {
    await fs.rmdir(dir);
    logs.push(`🧹 Deleted empty folder: ${dir}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await deleteEmptyFolders(fullPath);
    }
  }

  const check = await fs.readdir(dir);
  if (check.length === 0 && dir !== process.cwd()) {
    await fs.rmdir(dir);
    logs.push(`🧹 Deleted empty folder: ${dir}`);
  }
}

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// Preview files to be organized
app.post("/preview", async (req, res) => {
  const basepath = req.body.basepath;
  try {
    const files = await fs.readdir(basepath);
    const preview = [];

    for (const item of files) {
      const fullPath = path.join(basepath, item);
      const stat = await fs.lstat(fullPath);
      if (stat.isDirectory()) continue;
      const extension = path.extname(item).slice(1).toLowerCase();

if (extension && extension !== "js" && extension !== "json") {
  const customFolders = req.body.customFolders || {};
  const targetFolder = customFolders[extension] || extension;
  preview.push({ file: item, targetFolder });
}

    }

    res.json(preview);
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});



// Organize files and remove duplicates
app.post("/organize", async (req, res) => {
  /*
  Expect body:
  {
    basepath: string,
    excludeExt: string[], // e.g. ['tmp','log']
    customFolders: { [ext]: folderName },
    copyInstead: boolean
  }
  */

  const { basepath, excludeExt = [], customFolders = {}, copyInstead = false } = req.body;
  logs = [];
  lastMoved = [];
  const seenHashes = new Map();

  try {
    const files = await fs.readdir(basepath);

    for (const item of files) {
      const itemPath = path.join(basepath, item);
      let stat;
      try {
        stat = await fs.lstat(itemPath);
      } catch (err) {
        console.error(`Error getting stats for file ${item}:`, err);
        continue;
      }
      if (stat.isDirectory()) continue;

      const extension = path.extname(item).slice(1).toLowerCase();

      if (!extension || excludeExt.includes(extension) || extension === "js" || extension === "json") {
        continue;
      }

      let hash;
      try {
        hash = await getFileHash(itemPath);
      } catch (err) {
        console.error(`Error hashing file ${item}:`, err);
        continue;
      }

      if (seenHashes.has(hash)) {
        try {
          await fs.unlink(itemPath);
          logs.push(`🗑️ Deleted duplicate: ${item}`);
        } catch (err) {
          console.error(`Error deleting duplicate file ${item}:`, err);
        }
        continue;
      }
      seenHashes.set(hash, itemPath);

      // Decide target folder:
      let targetFolder = customFolders[extension] || extension;
      const extDir = path.join(basepath, targetFolder);

      try {
        if (!fsn.existsSync(extDir)) {
          await fs.mkdir(extDir);
          logs.push(`📁 Created folder: ${targetFolder}`);
        }
      } catch (err) {
        console.error(`Error creating directory ${extDir}:`, err);
        continue;
      }

      const destPath = path.join(extDir, item);

      try {
        if (copyInstead) {
          await fs.copyFile(itemPath, destPath);
          logs.push(`📋 Copied: ${item} → ${targetFolder}/${item}`);
        } else {
          await fs.rename(itemPath, destPath);
          logs.push(`➡️ Moved: ${item} → ${targetFolder}/${item}`);
          lastMoved.push({ from: destPath, to: itemPath });
        }
      } catch (err) {
        console.error(`Error processing file ${item}:`, err);
      }
    }

    // 🧹 Clean up empty folders
    await deleteEmptyFolders(basepath);

    res.json({ message: "Organizing complete", logs });
  } catch (err) {
    console.error("Error during organizing:", err);
    res.status(500).send("Error: " + err.message);
  }
});

// Download logs
app.get("/download-logs", async (req, res) => {
  try {
    const logFile = path.join(process.cwd(), "public", "logs.txt");
    await fs.writeFile(logFile, logs.join("\n"));
    res.download(logFile);
  } catch (err) {
    res.status(500).send("Error downloading logs: " + err.message);
  }
});

// Undo last operation
app.post("/undo", async (req, res) => {
  try {
    for (const move of lastMoved.reverse()) {
      if (fsn.existsSync(move.from)) {
        await fs.rename(move.from, move.to);
        logs.push(`↩️ Undid: ${path.basename(move.from)} moved back`);
      }
    }
    lastMoved = [];
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Undo failed: " + err.message);
  }
});



app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
