const pathForm = document.getElementById("pathForm");
const organizeForm = document.getElementById("organizeForm");
const hiddenBasepath = document.getElementById("hiddenBasepath");
const previewResult = document.getElementById("preview-result");
const dropZone = document.getElementById("drop-zone");

// ✅ Handle organize form submit
organizeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const basepath = hiddenBasepath.value;
  const excludeExt = document.getElementById("excludeExt").value
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const customFoldersRaw = document.getElementById("customFolders").value;
  const copyInstead = document.getElementById("copyInstead").checked;

  const customFolders = {};
  if (customFoldersRaw) {
    customFoldersRaw.split(",").forEach(pair => {
      const [ext, folder] = pair.split("=").map(s => s.trim());
      if (ext && folder) customFolders[ext.toLowerCase()] = folder;
    });
  }

  // 🔍 Debug Logs
  console.log("🛠 SUBMITTING /organize");
  console.log("📂 basepath:", basepath);
  console.log("🚫 excludeExt:", excludeExt);
  console.log("📦 customFoldersRaw:", customFoldersRaw);
  console.log("📁 Parsed customFolders:", customFolders);
  console.log("📄 copyInstead:", copyInstead);

  try {
    const response = await fetch("/organize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basepath,
        excludeExt,
        customFolders,
        copyInstead,
      }),
    });

    const text = await response.text();

    if (!response.ok) throw new Error(text);

    console.log("✅ Organize response:", text);

    window.location.href = "/done.html";
  } catch (error) {
    console.error("❌ Organize request failed:", error);
    alert("Error: " + error.message);
  }
});

// ✅ Handle preview form submit
pathForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const basepath = document.getElementById("basepath").value.trim();

  if (!basepath) return alert("Please enter a folder path.");

  previewResult.innerHTML = "<p>Loading preview...</p>";

  // 🔍 Debug log
  console.log("🔎 SUBMITTING /preview");
  console.log("📂 basepath:", basepath);

  try {
    const response = await fetch("/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ basepath }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Preview failed:", data);
      throw new Error(data.message || "Unknown error");
    }

    console.log("✅ Preview response:", data);

    if (data.length === 0) {
      previewResult.innerHTML =
        "<p>No files to organize or only js/json files present.</p>";
      organizeForm.style.display = "none";
      return;
    }

    previewResult.innerHTML = "<h3>Preview of files to be organized:</h3>";
    const ul = document.createElement("ul");
    data.forEach(({ file, targetFolder }) => {
      const li = document.createElement("li");
      li.textContent = `${file} → ${targetFolder}/`;
      ul.appendChild(li);
    });
    previewResult.appendChild(ul);

    hiddenBasepath.value = basepath;
    organizeForm.style.display = "block";
  } catch (error) {
    console.error("❌ Error in preview:", error);
    previewResult.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
    organizeForm.style.display = "none";
  }
});

// ✅ Drag & drop event listeners
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");

  const existingMsg = document.querySelector(".drop-warning");
  if (existingMsg) existingMsg.remove();

  const items = e.dataTransfer.items;
  let folderDetected = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i].webkitGetAsEntry?.();
    if (item && item.isDirectory) {
      folderDetected = true;
      break;
    }
  }

  if (folderDetected) {
    const msg = document.createElement("p");
    msg.className = "drop-warning";
    msg.style.color = "orange";
    msg.style.marginTop = "10px";
    msg.style.fontWeight = "500";
    msg.style.transition = "opacity 0.5s ease";
    msg.style.opacity = "0";

    msg.textContent =
      "⚠️ Folder drag & drop is limited in browsers. Please copy-paste the folder path instead.";
    dropZone.appendChild(msg);

    requestAnimationFrame(() => {
      msg.style.opacity = "1";
    });

    setTimeout(() => {
      msg.style.opacity = "0";
      setTimeout(() => msg.remove(), 500);
    }, 5000);
  }
});
