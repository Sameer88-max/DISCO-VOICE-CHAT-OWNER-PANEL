
/* ==========================================
   DISCO VOICE CHAT
   OWNER PANEL - COMPLETE SCRIPT
   Firebase Authentication + Firestore
   PNG / WEBM / MP4 FRAME UPLOAD
   ========================================== */

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyChGhLMnMsGWpmszHnzyvvyLEwemcDOEcY",
  authDomain: "disco-voice-chat.firebaseapp.com",
  projectId: "disco-voice-chat",
  storageBucket: "disco-voice-chat.firebasestorage.app",
  messagingSenderId: "684091788511",
  appId: "1:684091788511:web:2580ebc70e09d79d38ed6a",
  measurementId: "G-NJ9GPLLM4Q"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const OWNER_EMAIL = "tzindahai15@gmail.com";

let currentAdmin = null;
let currentPage = "dashboard";
let selectedFrameFile = null;
let framePreviewUrl = null;
let authReady = false;

const el = id => document.getElementById(id);

// ==========================================
// 2. HTML ELEMENTS
// ==========================================

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

function showError(message) {
  if (loginError) {
    loginError.textContent = message;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function updateSaveStatus(message) {
  const status = el("saveStatus");
  if (status) status.textContent = message;
}

// ==========================================
// 3. FIREBASE CONNECTION
// ==========================================

db.collection("app_config").limit(1).get()
  .then(() => {
    setConnection("connected", "Firebase Connected");
  })
  .catch(error => {
    console.error("Firebase connection:", error);
    setConnection("error", "Firebase Connection / Permission Error");
  });

// ==========================================
// 4. OWNER LOGIN
// ==========================================

if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = el("email")?.value.trim().toLowerCase();
    const password = el("password")?.value;

    if (!email || !password) {
      showError("Enter owner email and password.");
      return;
    }

    if (email !== OWNER_EMAIL) {
      showError("Access denied. Owner email only.");
      return;
    }

    const button = loginForm.querySelector('button[type="submit"]');

    if (button) button.disabled = true;

    showError("Signing in...");

    try {
      await auth.signInWithEmailAndPassword(email, password);
      showError("");

      if (el("password")) {
        el("password").value = "";
      }

    } catch (error) {
      console.error("Login error:", error);

      const messages = {
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/user-not-found": "Owner account not found.",
        "auth/wrong-password": "Incorrect password.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/network-request-failed": "Internet connection failed.",
        "auth/invalid-email": "Invalid email address."
      };

      showError(messages[error.code] || error.message);

    } finally {
      if (button) button.disabled = false;
    }
  });
}

// ==========================================
// 5. OWNER AUTHORIZATION
// ==========================================

auth.onAuthStateChanged(async user => {

  if (!user) {
    currentAdmin = null;

    loginScreen?.classList.remove("hidden");
    appScreen?.classList.add("hidden");

    authReady = true;
    return;
  }

  // Only the fixed owner email is allowed.
  if ((user.email || "").toLowerCase() !== OWNER_EMAIL) {

    await auth.signOut();

    currentAdmin = null;

    loginScreen?.classList.remove("hidden");
    appScreen?.classList.add("hidden");

    showError("Unauthorized email. Owner access only.");

    authReady = true;
    return;
  }

  currentAdmin = user;

  loginScreen?.classList.add("hidden");
  appScreen?.classList.remove("hidden");

  if (el("adminEmail")) {
    el("adminEmail").textContent = OWNER_EMAIL;
  }

  authReady = true;

  setConnection("connected", "Owner Authenticated");

  await loadDashboard();
});

// ==========================================
// 6. LOGOUT
// ==========================================

el("logoutBtn")?.addEventListener("click", async () => {
  try {
    await auth.signOut();

    currentAdmin = null;
    selectedFrameFile = null;

    if (framePreviewUrl) {
      URL.revokeObjectURL(framePreviewUrl);
      framePreviewUrl = null;
    }

    showError("Logged out successfully.");

  } catch (error) {
    alert("Logout failed: " + error.message);
  }
});

// ==========================================
// 7. COLLECTIONS
// ==========================================

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

// ==========================================
// 8. DASHBOARD
// ==========================================

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

      if (el(target)) {
        el(target).textContent = snapshot.size;
      }

    } catch (error) {
      if (el(target)) {
        el(target).textContent = "Unavailable";
      }
    }
  }

  const status = el("collectionStatus");

  if (status) {
    status.innerHTML = collections.map(name =>
      `<div class="collection-item">${escapeHTML(name)}</div>`
    ).join("");
  }
}

// ==========================================
// 9. USER MANAGEMENT
// ==========================================

async function loadUsers() {
  if (!currentAdmin) return;

  currentPage = "users";

  pageContent.innerHTML = `
    <h2>User Management</h2>

    <input id="userSearch"
      placeholder="Search User ID or Name">

    <div id="usersList">Loading users...</div>
  `;

  try {
    const snapshot = await db.collection("users")
      .limit(100)
      .get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    function renderUsers(search = "") {
      const list = el("usersList");
      if (!list) return;

      const filtered = users.filter(user =>
        `${user.id} ${user.name || ""} ${user.email || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );

      list.innerHTML = filtered.map(user => `
        <div class="dashboard-card">

          <h3>${escapeHTML(user.name || "Unknown User")}</h3>

          <p>ID: ${escapeHTML(user.id)}</p>

          <p>Coins: ${Number(user.coins || 0)}</p>

          <input type="number"
            min="1"
            id="coins-${escapeHTML(user.id)}"
            placeholder="Coins amount">

          <button data-add-coins="${escapeHTML(user.id)}">
            Add Coins
          </button>

        </div>
      `).join("");

      list.querySelectorAll("[data-add-coins]")
        .forEach(button => {
          button.addEventListener("click", () => {
            addCoins(button.dataset.addCoins);
          });
        });
    }

    renderUsers();

    el("userSearch")?.addEventListener("input", event => {
      renderUsers(event.target.value);
    });

  } catch (error) {
    console.error(error);

    if (el("usersList")) {
      el("usersList").textContent =
        "Unable to load users: " + error.message;
    }
  }
}

// ==========================================
// 10. ADD COINS
// ==========================================

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

      if (!userDoc.exists) {
        throw new Error("User not found.");
      }

      const newCoins =
        Number(userDoc.data().coins || 0) + amount;

      if (!Number.isSafeInteger(newCoins)) {
        throw new Error("Invalid coin balance.");
      }

      transaction.update(userRef, {
        coins: newCoins
      });

      transaction.set(transactionRef, {
        userId,
        type: "admin_coin_credit",
        amount,
        adminId: currentAdmin.uid,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    alert("Coin transaction completed.");

    await loadUsers();

  } catch (error) {
    alert("Coin update failed: " + error.message);
  }
}

// ==========================================
// 11. FRAME STORE
// ==========================================

async function loadFrames() {
  if (!currentAdmin) return;

  currentPage = "frames";

  pageContent.innerHTML = `
    <h2>Frame Store Management</h2>

    <p>Upload transparent PNG and animated video frames.</p>

    <div class="dashboard-card frame-upload-card">

      <label>Frame Name</label>
      <input id="frameName"
        type="text"
        placeholder="Enter frame name">

      <label>Frame Price</label>
      <input id="framePrice"
        type="number"
        min="0"
        step="1"
        placeholder="Coins">

      <label>Frame File Upload</label>

      <input id="frameFile"
        type="file"
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
        value="0"
        max="100"
        hidden></progress>

      <p id="frameUploadStatus" role="status"></p>

      <button id="saveFrame"
        class="gold-btn"
        type="button">
        UPLOAD FRAME
      </button>

    </div>

    <h3>Uploaded Frames</h3>

    <div id="framesList">Loading frames...</div>
  `;

  el("frameFile").addEventListener(
    "change",
    handleFrameSelection
  );

  el("saveFrame").addEventListener(
    "click",
    saveFrame
  );

  await renderFramesList();
}

// ==========================================
// 12. FRAME FILE PREVIEW
// ==========================================

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

  const extension = file.name.split(".").pop().toLowerCase();

  const isPng =
    file.type === "image/png" || extension === "png";

  const isWebM =
    file.type === "video/webm" || extension === "webm";

  const isMp4 =
    file.type === "video/mp4" || extension === "mp4";

  const isVideo = isWebM || isMp4;

  if (!isPng && !isVideo) {
    event.target.value = "";
    status.textContent = "Only PNG, WebM or MP4 allowed.";
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

  if (!file.type) {
    status.textContent =
      "File type could not be verified by browser.";
    return;
  }

  if (
    (isPng && file.type !== "image/png") ||
    (isWebM && file.type !== "video/webm") ||
    (isMp4 && file.type !== "video/mp4")
  ) {
    status.textContent = "File type does not match extension.";
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

  status.textContent =
    file.name + " selected successfully.";
}

// ==========================================
// 13. UPLOAD FRAME TO FIREBASE
// ==========================================

async function saveFrame() {
  if (!currentAdmin) return;

  const name = el("frameName")?.value.trim();
  const price = Number(el("framePrice")?.value);
  const file = selectedFrameFile;

  if (
    !name ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    !file
  ) {
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
    const safeName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

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
            const url =
              await uploadTask.snapshot.ref.getDownloadURL();

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

      image: downloadUrl,

      imageUrl: isPng ? downloadUrl : "",
      videoUrl: isPng ? "" : downloadUrl,

      storagePath: filePath,
      mediaType,
      contentType: file.type,

      active: false,

      createdAt:
        firebase.firestore.FieldValue.serverTimestamp(),

      createdBy: currentAdmin.uid
    };

    await db.collection("frames").add(frameData);

    selectedFrameFile = null;

    if (framePreviewUrl) {
      URL.revokeObjectURL(framePreviewUrl);
      framePreviewUrl = null;
    }

    el("frameFile").value = "";
    el("frameName").value = "";
    el("framePrice").value = "";

    el("framePreview").textContent =
      "Select a PNG or video to preview.";

    status.textContent =
      "Upload successful! Frame saved as UNPUBLISHED.";

    await renderFramesList();

  } catch (error) {
    console.error("Frame upload error:", error);

    if (uploadedRef) {
      try {
        await uploadedRef.delete();
      } catch (cleanupError) {
        console.warn("Storage cleanup failed:", cleanupError);
      }
    }

    status.textContent =
      "Upload failed: " + error.message;

  } finally {
    button.disabled = false;
  }
}

// ==========================================
// 14. RENDER FRAME LIST
// ==========================================

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
            controls
            muted
            loop
            playsinline
            style="max-width:180px;max-height:130px">
          </video>
        `
        : `
          <img
            src="${escapeHTML(frame.imageUrl || frame.image || "")}"
            alt="Frame preview"
            style="max-width:180px;max-height:130px;object-fit:contain">
        `;

      const active = frame.active === true;

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

    list.querySelectorAll("[data-frame-toggle]")
      .forEach(button => {

        button.addEventListener("click", () => {

          toggleFramePublish(
            button.dataset.frameToggle,
            button.dataset.active === "true"
          );

        });
      });

  } catch (error) {
    console.error(error);

    list.textContent =
      "Unable to load frames: " + error.message;
  }
}

// ==========================================
// 15. PUBLISH / UNPUBLISH FRAME
// ==========================================

async function toggleFramePublish(frameId, currentlyActive) {
  if (!currentAdmin) return;

  try {
    await db.collection("frames")
      .doc(frameId)
      .update({

        active: !currentlyActive,

        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp(),

        updatedBy: currentAdmin.uid
      });

    await renderFramesList();

  } catch (error) {
    alert("Publish update failed: " + error.message);
  }
}

// ==========================================
// 16. GIFT MANAGEMENT
// ==========================================

async function loadGifts() {
  if (!currentAdmin) return;

  currentPage = "gifts";

  pageContent.innerHTML = `
    <h2>Gift Management</h2>

    <input id="giftName" placeholder="Gift Name">

    <input id="giftPrice"
      type="number"
      min="0"
      placeholder="Gift Price">

    <input id="giftImage" placeholder="Gift Image URL">

    <button id="saveGift">Add Gift</button>

    <div id="giftsList">Loading...</div>
  `;

  el("saveGift").addEventListener("click", saveGift);

  try {
    const snapshot = await db.collection("gifts").get();

    el("giftsList").innerHTML =
      snapshot.docs.map(doc => {

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
    el("giftsList").textContent =
      "Unable to load gifts: " + error.message;
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

      createdAt:
        firebase.firestore.FieldValue.serverTimestamp(),

      createdBy: currentAdmin.uid
    });

    alert("Gift added successfully.");

    await loadGifts();

  } catch (error) {
    alert("Gift save failed: " + error.message);
  }
}

// ==========================================
// 17. SIDEBAR NAVIGATION
// ==========================================

document.querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener("click", () => {

      if (!currentAdmin) return;

      document.querySelectorAll("[data-page]")
        .forEach(item => {
          item.classList.remove("active");
        });

      button.classList.add("active");

      const page = button.dataset.page;

      const breadcrumb = el("breadcrumb");

      if (breadcrumb) {
        breadcrumb.textContent =
          "Owner Panel / " + page;
      }

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

// ==========================================
// 18. REFRESH
// ==========================================

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

// ==========================================
// 19. MENU SEARCH
// ==========================================

el("menuSearch")?.addEventListener("input", event => {

  const search = event.target.value.toLowerCase();

  document.querySelectorAll("[data-page]")
    .forEach(button => {

      button.style.display =
        button.textContent.toLowerCase().includes(search)
          ? "block"
          : "none";
    });
});

// ==========================================
// 20. GLOBAL SEARCH
// ==========================================

el("globalSearch")?.addEventListener("input", event => {

  const search = event.target.value.trim().toLowerCase();

  if (!search) return;

  document.querySelectorAll("[data-page]")
    .forEach(button => {

      button.style.display =
        button.textContent.toLowerCase().includes(search)
          ? "block"
          : "none";
    });
});

// ==========================================
// 21. SAVE / DISCARD
// ==========================================

el("saveBtn")?.addEventListener("click", () => {

  if (!currentAdmin) return;

  updateSaveStatus(
    "No pending general settings changes."
  );
});

el("discardBtn")?.addEventListener("click", () => {

  if (!currentAdmin) return;

  updateSaveStatus("No pending changes.");
});

// ==========================================
// 22. MODAL CONTROLS
// ==========================================

el("closeModal")?.addEventListener("click", () => {
  el("modal")?.classList.add("hidden");
});

// ==========================================
// 23. EMERGENCY BUTTON
// ==========================================

el("emergencyBtn")?.addEventListener("click", () => {

  if (!currentAdmin) return;

  alert(
    "Emergency Stop backend action is not configured yet. " +
    "No app services have been stopped."
  );
});

// ==========================================
// END OF DISCO VOICE CHAT OWNER PANEL
// ==========================================
