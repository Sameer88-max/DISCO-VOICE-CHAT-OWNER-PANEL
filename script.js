
/* ==========================================
   DISCO VOICE CHAT - OWNER PANEL
   COMPLETE FIREBASE OWNER PANEL
   FRAME PNG + TRANSPARENT VIDEO UPLOAD
   ========================================== */

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyChGhLMnMsGWpmszHnzyvvyLEwemcDOEcY",
  authDomain: "disco-voice-chat.firebaseapp.com",
  projectId: "disco-voice-chat",
  storageBucket: "disco-voice-chat.firebasestorage.app",
  messagingSenderId: "684091788511",
  appId: "1:684091788511:web:2580ebc70e09d79d38ed6a",
  measurementId: "G-NJ9GPLLM4Q"
};

// FIREBASE INITIALIZATION
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentAdmin = null;
let currentPage = "dashboard";
let selectedFrameFile = null;
let framePreviewUrl = null;

const el = id => document.getElementById(id);

// CONNECTION
const loginScreen = el("loginScreen");
const loginForm = el("loginForm");
const loginError = el("loginError");
const appScreen = el("app");
const pageContent = el("pageContent");
const connectionStatus = el("connectionStatus");

function setConnection(status, message) {
  if (!connectionStatus) return;
  connectionStatus.textContent = message;
  connectionStatus.dataset.status = status;
}

// FIREBASE CONNECTION
db.collection("app_config").limit(1).get()
  .then(() => setConnection("connected", "Firebase Connected"))
  .catch(error => {
    console.error(error);
    setConnection("error", "Firebase Connection Error");
  });

// LOGIN
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = el("email").value.trim();
    const password = el("password").value;

    if (!email || !password) {
      showError("Enter email and password.");
      return;
    }

    try {
      showError("Signing in...");
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      showError(error.message);
    }
  });
}

function showError(message) {
  if (loginError) loginError.textContent = message;
}

// AUTHORIZATION
auth.onAuthStateChanged(async user => {
  if (!user) {
    currentAdmin = null;
    loginScreen?.classList.remove("hidden");
    appScreen?.classList.add("hidden");
    return;
  }

  try {
    const adminDoc = await db.collection("admins")
      .doc(user.uid).get();

    if (!adminDoc.exists) {
      await auth.signOut();
      showError("Admin account not authorized.");
      return;
    }

    const admin = adminDoc.data();

    if (
      !["owner", "super_admin"].includes(
        String(admin.role || "").toLowerCase()
      ) ||
      admin.active === false
    ) {
      await auth.signOut();
      showError("Owner access denied.");
      return;
    }

    currentAdmin = user;

    loginScreen?.classList.add("hidden");
    appScreen?.classList.remove("hidden");

    if (el("adminEmail")) {
      el("adminEmail").textContent = user.email || "Owner";
    }

    setConnection("connected", "Firebase Connected");
    await loadDashboard();

  } catch (error) {
    console.error(error);
    showError("Admin verification failed.");
  }
});

// LOGOUT
el("logoutBtn")?.addEventListener("click", async () => {
  await auth.signOut();
});

// COLLECTIONS
const collections = [
  "users",
  "rooms",
  "gifts",
  "frames",
  "staff",
  "agencies",
  "payouts",
  "transactions",
  "recharge_packages",
  "events",
  "reports",
  "audit_logs",
  "app_config"
];

// SAFE HTML
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// DASHBOARD
async function loadDashboard() {
  if (!currentAdmin) return;

  currentPage = "dashboard";

  pageContent.innerHTML = `
    <h2>DISCO VOICE CHAT</h2>
    <h3>Owner Dashboard</h3>

    <div class="dashboard-grid">
      <div class="dashboard-card">
        <h3>Total Users</h3>
        <strong id="totalUsers">Loading...</strong>
      </div>
      <div class="dashboard-card">
        <h3>Total Rooms</h3>
        <strong id="totalRooms">Loading...</strong>
      </div>
      <div class="dashboard-card">
        <h3>Total Gifts</h3>
        <strong id="totalGifts">Loading...</strong>
      </div>
      <div class="dashboard-card">
        <h3>Total Frames</h3>
        <strong id="totalFrames">Loading...</strong>
      </div>
    </div>

    <h3>System Collections</h3>
    <div id="collectionStatus">Loading...</div>
  `;

  const targets = [
    ["users", "totalUsers"],
    ["rooms", "totalRooms"],
    ["gifts", "totalGifts"],
    ["frames", "totalFrames"]
  ];

  for (const [name, target] of targets) {
    try {
      const snapshot = await db.collection(name).get();
      if (el(target)) el(target).textContent = snapshot.size;
    } catch (error) {
      if (el(target)) el(target).textContent = "Unavailable";
    }
  }

  const status = el("collectionStatus");
  if (status) {
    status.innerHTML = collections.map(name =>
      `<div class="collection-item">${escapeHTML(name)}</div>`
    ).join("");
  }
}

// USER MANAGEMENT
async function loadUsers() {
  if (!currentAdmin) return;

  currentPage = "users";

  pageContent.innerHTML = `
    <h2>User Management</h2>
    <input id="userSearch" placeholder="Search User ID or Name">
    <div id="usersList">Loading users...</div>
  `;

  try {
    const snapshot = await db.collection("users").limit(100).get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    function renderUsers(search = "") {
      const list = el("usersList");
      if (!list) return;

      const filtered = users.filter(user =>
        `${user.id} ${user.name || ""} ${user.email || ""}`
          .toLowerCase().includes(search.toLowerCase())
      );

      list.innerHTML = filtered.map(user => `
        <div class="dashboard-card">
          <h3>${escapeHTML(user.name || "Unknown User")}</h3>
          <p>ID: ${escapeHTML(user.id)}</p>
          <p>Coins: ${Number(user.coins || 0)}</p>
          <input type="number" min="1"
            id="coins-${escapeHTML(user.id)}"
            placeholder="Coins amount">
          <button data-add-coins="${escapeHTML(user.id)}">
            Add Coins
          </button>
        </div>
      `).join("");

      list.querySelectorAll("[data-add-coins]").forEach(button => {
        button.addEventListener("click", () =>
          addCoins(button.dataset.addCoins)
        );
      });
    }

    renderUsers();

    el("userSearch")?.addEventListener("input", event => {
      renderUsers(event.target.value);
    });

  } catch (error) {
    console.error(error);
    if (el("usersList")) {
      el("usersList").textContent = "Unable to load users.";
    }
  }
}

// ADD COINS
async function addCoins(userId) {
  if (!currentAdmin) return;

  const amount = Number(el(`coins-${userId}`)?.value);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    alert("Enter a valid coin amount.");
    return;
  }

  try {
    const userRef = db.collection("users").doc(userId);
    const transactionRef = db.collection("transactions").doc();

    await db.runTransaction(async transaction => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) throw new Error("User not found.");

      const newCoins = Number(userDoc.data().coins || 0) + amount;

      if (!Number.isSafeInteger(newCoins)) {
        throw new Error("Invalid coin balance.");
      }

      transaction.update(userRef, { coins: newCoins });

      transaction.set(transactionRef, {
        userId,
        type: "admin_coin_credit",
        amount,
        adminId: currentAdmin.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    alert("Coin transaction completed.");
    await loadUsers();

  } catch (error) {
    alert("Coin update failed: " + error.message);
  }
}

// ==========================================
// FRAME STORE - DIRECT UPLOAD SYSTEM
// ==========================================

async function loadFrames() {
  if (!currentAdmin) return;

  currentPage = "frames";

  pageContent.innerHTML = `
    <h2>Frame Store Management</h2>
    <p>Upload transparent PNG and animated video frames.</p>

    <div class="dashboard-card frame-upload-card">

      <label>Frame Name</label>
      <input id="frameName" type="text"
        placeholder="Enter frame name">

      <label>Frame Price</label>
      <input id="framePrice" type="number"
        min="0" step="1" placeholder="Coins">

      <label>Frame File Upload</label>
      <input id="frameFile" type="file"
        accept=".png,.webm,.mp4,image/png,video/webm,video/mp4">

      <small>
        PNG: Maximum 10 MB.
        Video: Maximum 50 MB.
        Transparent WebM with alpha is recommended.
      </small>

      <div id="framePreview" class="frame-preview">
        Select a PNG or video to preview.
      </div>

      <progress id="frameProgress"
        value="0" max="100" hidden></progress>

      <p id="frameUploadStatus" role="status"></p>

      <button id="saveFrame" class="gold-btn" type="button">
        UPLOAD FRAME
      </button>

    </div>

    <h3>Uploaded Frames</h3>
    <div id="framesList">Loading frames...</div>
  `;

  el("frameFile").addEventListener("change", handleFrameSelection);
  el("saveFrame").addEventListener("click", saveFrame);

  await renderFramesList();
}

// FILE SELECTION AND PREVIEW
function handleFrameSelection(event) {
  const file = event.target.files?.[0];

  selectedFrameFile = null;

  if (framePreviewUrl) {
    URL.revokeObjectURL(framePreviewUrl);
    framePreviewUrl = null;
  }

  const preview = el("framePreview");
  const status = el("frameUploadStatus");

  if (!file) return;

  const isPng = file.type === "image/png";
  const isWebM = file.type === "video/webm";
  const isMp4 = file.type === "video/mp4";
  const isVideo = isWebM || isMp4;

  if (!isPng && !isVideo) {
    event.target.value = "";
    status.textContent = "Only PNG, WebM or MP4 files are allowed.";
    preview.textContent = "No preview available.";
    return;
  }

  const maxSize = isPng
    ? 10 * 1024 * 1024
    : 50 * 1024 * 1024;

  if (file.size > maxSize) {
    event.target.value = "";
    status.textContent = "File size limit exceeded.";
    preview.textContent = "No preview available.";
    return;
  }

  selectedFrameFile = file;
  framePreviewUrl = URL.createObjectURL(file);

  preview.innerHTML = "";

  if (isPng) {
    const img = document.createElement("img");
    img.src = framePreviewUrl;
    img.alt = "Transparent PNG preview";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "240px";
    img.style.objectFit = "contain";
    preview.appendChild(img);
  } else {
    const video = document.createElement("video");
    video.src = framePreviewUrl;
    video.controls = true;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.maxWidth = "100%";
    video.style.maxHeight = "240px";
    preview.appendChild(video);
  }

  status.textContent = file.name + " selected successfully.";
}

// UPLOAD TO FIREBASE STORAGE
async function saveFrame() {
  if (!currentAdmin) return;

  const name = el("frameName")?.value.trim();
  const price = Number(el("framePrice")?.value);
  const file = selectedFrameFile;

  if (!name || !Number.isSafeInteger(price) || price < 0 || !file) {
    alert("Enter frame name, valid price and select a file.");
    return;
  }

  const isPng = file.type === "image/png";
  const mediaType = isPng ? "image" : "video";

  const button = el("saveFrame");
  const progress = el("frameProgress");
  const status = el("frameUploadStatus");

  button.disabled = true;
  progress.hidden = false;
  progress.value = 0;

  status.textContent = "Connecting to Firebase Storage...";

  let uploadedRef = null;

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath =
      `frames/${currentAdmin.uid}/${Date.now()}_${safeName}`;

    uploadedRef = storage.ref().child(filePath);

    const uploadTask = uploadedRef.put(file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: currentAdmin.uid,
        originalName: file.name
      }
    });

    const downloadUrl = await new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",

        snapshot => {
          const percent = Math.round(
            snapshot.bytesTransferred /
            snapshot.totalBytes * 100
          );

          progress.value = percent;
          status.textContent = `Uploading: ${percent}%`;
        },

        error => reject(error),

        async () => {
          try {
            const url = await uploadTask.snapshot.ref.getDownloadURL();
            resolve(url);
          } catch (error) {
            reject(error);
          }
        }
      );
    });

    const frameData = {
      name,
      price,

      // Compatibility with older app field
      image: downloadUrl,

      imageUrl: isPng ? downloadUrl : "",
      videoUrl: isPng ? "" : downloadUrl,

      storagePath: filePath,
      mediaType,
      contentType: file.type,

      // New uploads stay hidden until manually published
      active: false,

      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentAdmin.uid
    };

    await db.collection("frames").add(frameData);

    selectedFrameFile = null;

    if (framePreviewUrl) {
      URL.revokeObjectURL(framePreviewUrl);
      framePreviewUrl = null;
    }

    status.textContent =
      "Upload successful! Frame saved as UNPUBLISHED.";

    await renderFramesList();

  } catch (error) {
    console.error("Frame upload error:", error);

    // Remove orphaned upload if Firestore save failed
    if (uploadedRef) {
      try {
        await uploadedRef.delete();
      } catch (cleanupError) {
        console.warn("Storage cleanup failed:", cleanupError);
      }
    }

    status.textContent = "Upload failed: " + error.message;

  } finally {
    button.disabled = false;
  }
}

// LOAD FRAME LIST
async function renderFramesList() {
  const list = el("framesList");
  if (!list || !currentAdmin) return;

  try {
    const snapshot = await db.collection("frames").get();

    if (snapshot.empty) {
      list.textContent = "No frames uploaded yet.";
      return;
    }

    list.innerHTML = snapshot.docs.map(doc => {
      const frame = doc.data();

      const media = frame.mediaType === "video"
        ? `
          <video
            src="${escapeHTML(frame.videoUrl || frame.image || "")}"
            controls muted loop playsinline
            style="max-width:180px;max-height:130px">
          </video>
        `
        : `
          <img
            src="${escapeHTML(frame.imageUrl || frame.image || "")}"
            alt="Frame preview"
            style="max-width:180px;max-height:130px;object-fit:contain">
        `;

      const active = frame.active !== false;

      return `
        <div class="dashboard-card">
          ${media}
          <h3>${escapeHTML(frame.name || "Frame")}</h3>
          <p>Price: ${Number(frame.price || 0)} Coins</p>
          <p>Type: ${frame.mediaType === "video" ? "Video" : "PNG"}</p>
          <p>Status: ${active ? "Published" : "Unpublished"}</p>

          <button
            class="outline-btn"
            type="button"
            data-frame-toggle="${escapeHTML(doc.id)}"
            data-active="${active}">
            ${active ? "UNPUBLISH" : "PUBLISH"}
          </button>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-frame-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        toggleFramePublish(
          button.dataset.frameToggle,
          button.dataset.active === "true"
        );
      });
    });

  } catch (error) {
    console.error(error);
    list.textContent = "Unable to load frames: " + error.message;
  }
}

// PUBLISH / UNPUBLISH
async function toggleFramePublish(frameId, currentlyActive) {
  if (!currentAdmin) return;

  try {
    await db.collection("frames").doc(frameId).update({
      active: !currentlyActive,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentAdmin.uid
    });

    await renderFramesList();

  } catch (error) {
    alert("Publish update failed: " + error.message);
  }
}

// GIFTS MANAGEMENT
async function loadGifts() {
  if (!currentAdmin) return;

  currentPage = "gifts";

  pageContent.innerHTML = `
    <h2>Gift Management</h2>

    <input id="giftName" placeholder="Gift Name">
    <input id="giftPrice" type="number" min="0"
      placeholder="Gift Price">
    <input id="giftImage" placeholder="Gift Image URL">

    <button id="saveGift">Add Gift</button>

    <div id="giftsList">Loading...</div>
  `;

  el("saveGift").addEventListener("click", saveGift);

  try {
    const snapshot = await db.collection("gifts").get();

    el("giftsList").innerHTML = snapshot.docs.map(doc => {
      const gift = doc.data();

      return `
        <div class="dashboard-card">
          <h3>${escapeHTML(gift.name || "Gift")}</h3>
          <p>Price: ${Number(gift.price || 0)} Coins</p>
          <p>ID: ${escapeHTML(doc.id)}</p>
        </div>
      `;
    }).join("");

  } catch (error) {
    el("giftsList").textContent = "Unable to load gifts.";
  }
}

async function saveGift() {
  if (!currentAdmin) return;

  const name = el("giftName").value.trim();
  const price = Number(el("giftPrice").value);
  const image = el("giftImage").value.trim();

  if (!name || !Number.isSafeInteger(price) || price < 0) {
    alert("Enter valid gift information.");
    return;
  }

  try {
    await db.collection("gifts").add({
      name,
      price,
      image,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentAdmin.uid
    });

    alert("Gift added successfully.");
    await loadGifts();

  } catch (error) {
    alert("Gift save failed: " + error.message);
  }
}

// SIDEBAR NAVIGATION
document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    if (!currentAdmin) return;

    document.querySelectorAll("[data-page]").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    const page = button.dataset.page;

    switch (page) {
      case "dashboard":
        loadDashboard();
        break;

      case "users":
        loadUsers();
        break;

      case "frames":
        loadFrames();
        break;

      case "gifts":
        loadGifts();
        break;

      default:
        currentPage = page;
        pageContent.innerHTML = `
          <h2>${escapeHTML(page)}</h2>
          <p>This module is not implemented yet.</p>
        `;
    }
  });
});

// REFRESH
el("refreshBtn")?.addEventListener("click", () => {
  if (!currentAdmin) return;

  switch (currentPage) {
    case "users":
      loadUsers();
      break;

    case "frames":
      loadFrames();
      break;

    case "gifts":
      loadGifts();
      break;

    default:
      loadDashboard();
  }
});

// SEARCH MENUS
el("menuSearch")?.addEventListener("input", event => {
  const search = event.target.value.toLowerCase();

  document.querySelectorAll("[data-page]").forEach(button => {
    button.style.display = button.textContent.toLowerCase()
      .includes(search) ? "block" : "none";
  });
});

// SAVE STATUS
function updateSaveStatus(message) {
  const status = el("saveStatus");
  if (status) status.textContent = message;
}

// DISCARD / SAVE PLACEHOLDERS
el("saveBtn")?.addEventListener("click", () => {
  updateSaveStatus("No pending general settings changes.");
});

el("discardBtn")?.addEventListener("click", () => {
  updateSaveStatus("No pending changes.");
});

// MODAL
el("closeModal")?.addEv
