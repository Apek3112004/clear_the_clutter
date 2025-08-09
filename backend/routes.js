import express from "express";
import path from "path";
import fs from "fs/promises";
import fsn from "fs";
import { getFileHash, organizeFiles } from "./services/FileOrganizer.js";
import { deleteEmptyFolders } from "./services/DeleteEmptyFolders.js";

const router = express.Router();

const forbiddenPaths = [
  "C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\System32",
  "/bin", "/boot", "/dev", "/etc", "/lib", "/proc", "/root", "/sbin", "/sys", "/usr", "/var"
];

// Utility to check forbidden system paths
function isForbiddenPath(basepath) {
  return forbiddenPaths.some(fp => basepath.startsWith(fp));
}

router.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

router.post("/preview", async (req, res) => {
  const basepath = req.body.basepath;
  if (isForbiddenPath(basepath)) {
    return res.status(400).send("❌ Operation not allowed on protected system folders.");
  }

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

router.post("/organize", async (req, res) => {
  const {
    basepath,
    excludeExt = [],
    customFolders = {},
    copyInstead = false,
    batchSize,
    batchNumber
  } = req.body;

  if (isForbiddenPath(basepath)) {
    return res.status(400).send("❌ Operation not allowed on protected system folders.");
  }

  // Initialize per-user logs & lastMoved
  req.session.logs = [];
  req.session.lastMoved = [];

  try {
    const summary = await organizeFiles({
      basepath,
      excludeExt,
      customFolders,
      copyInstead,
      batchSize,
      batchNumber
    }, req.session);

    await deleteEmptyFolders(basepath, req.session.logs);

    res.json({
      message: "Organizing complete",
      logs: req.session.logs,
      summary,
    });
  } catch (err) {
    console.error("Error during organizing:", err);
    res.status(500).send("Error: " + err.message);
  }
});

router.get("/download-logs", async (req, res) => {
  try {
    const logFile = path.join(process.cwd(), "public", "logs.txt");
    await fs.writeFile(logFile, (req.session.logs || []).join("\n"));
    res.download(logFile);
  } catch (err) {
    res.status(500).send("Error downloading logs: " + err.message);
  }
});

router.post("/undo", async (req, res) => {
  try {
    for (const move of (req.session.lastMoved || []).reverse()) {
      if (fsn.existsSync(move.from)) {
        await fs.rename(move.from, move.to);
        req.session.logs.push(`↩️ Undid: ${path.basename(move.from)} moved back`);
      }
    }
    req.session.lastMoved = [];
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Undo failed: " + err.message);
  }
});

export default router;
