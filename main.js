import { app, BrowserWindow } from "electron";
import path from "path";
import { fork } from "child_process";

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // for security, keep false if possible
      contextIsolation: true,
    },
  });

  // Load your Express server URL (where your frontend is served)
  mainWindow.loadURL("http://localhost:3000");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start backend server by forking the backend/index.js script
  backendProcess = fork(path.join(__dirname, "backend", "index.js"));

  backendProcess.on("error", (err) => {
    console.error("Backend process error:", err);
  });

  backendProcess.on("exit", (code, signal) => {
    console.log(`Backend process exited with code ${code} and signal ${signal}`);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit app when all windows are closed, and kill backend process
app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
