
/* ==========================================
   DISCO VOICE CHAT - OWNER PANEL
   Firebase Configuration & Management
   ========================================== */

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyChGhLMnMsGWpmszHnzyvvyLEwemcDOEcY",
  authDomain: "disco-voice-chat.firebaseapp.com",
  projectId: "disco-voice-chat",
  storageBucket: "disco-voice-chat.firebasestorage.app",
  messagingSenderId: "684091788511",
  appId: "1:684091788511:web:2580ebc70e09d79d38ed6a",
  measurementId: "G-NJ9GPLLM4Q"
};

// 2. INITIALIZE FIREBASE
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentAdmin = null;
let currentPage = "dashboard";

// 3. HTML ELEMENTS
const el = id => document.getElementById(id);

const loginScreen = el("loginScreen");
const loginForm = el("loginForm");
const loginError = el("loginError");
const appScreen = el("app");
const pageContent = el("pageContent");
const connectionStatus = el("connectionStatus");

// 4. CONNECTION STATUS
function setConnection(status, message) {
  if (!connectionStatus) return;

  connectionStatus.textContent = message;
  connectionStatus.dataset.status = status;
}

// 5. FIREBASE CONNECTION CHECK
db.collection("app_config").limit(1).get()
  .then(() => setConnection("connected", "Firebase Connected"))
  .catch(error => {
    console.error("Firebase connection:", error);
    setConnection("error", "Firebase Connection Error");
  });

// 6. ADMIN LOGIN
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = el("email")?.value.trim();
    const password = el("password")?.value;

    if (!email || !password) {
      showError("Enter email and password.");
      return;
    }

    try {
      loginError.textContent = "Signing in...";

      await auth.signInWithEmailAndPassword(email, password);

    } catch (error) {
      showError(error.message);
    }
  });
}

function showError(message) {
  if (loginError) loginError.textContent = message;
}

// 7. AUTHENTICATION & OWNER VERIFICATION
auth.onAuthStateChanged(async user => {
  if (!user) {
    currentAdmin = null;
    if (loginScreen) loginScreen.hidden = false;
    if (appScreen) appScreen.hidden = true;
    return;
  }

  try {
    const adminDoc = await db.collection("admins")
      .doc(user.uid).get();

    if (!adminDoc.exists) {
      await auth.signOut();
      showError("Admin account is not authorized.");
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

    if (loginScreen) loginScreen.hidden = true;
    if (appScreen) appScreen.hidden = false;

    if (el("adminEmail")) {
      el("adminEmail").textContent = user.email;
    }

    setConnection("connected", "Firebase Connected");

    await loadDashboard();

  } catch (error) {
    console.error(error);
    showError("Admin verification failed.");
  }
});

// 8. LOGOUT
el("logoutBtn")?.addEventListener("click", async () => {
  await auth.signOut();
});

// 9. FIRESTORE COLLECTIONS
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

// 10. DASHBOARD
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
      const node = el(target);
      if (node) node.textContent = snapshot.size;
    } catch (error) {
      const node = el(target);
      if (node) node.textContent = "Unavailable";
    }
  }

  const status = el("collectionStatus");
  if (status) {
    status.innerHTML = collections.map(name =>
      `<div class="collection-item">${name}</div>`
    ).join("");
  }
}

// 11. USERS MANAGEMENT
async function loadUsers() {
  if (!currentAdmin) return;

  currentPage = "users";

  pageContent.innerHTML = `
    <h2>User Management</h2>
    <input id="userSearch" placeholder="Search User ID or Name">
    <div id="usersList">Loading users...</div>
  `;

  try {
    const snapshot = await db.collection("users")
      .limit(100).get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    function renderUsers(search = "") {
      const list = el("usersList");
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

    el("userSearch").addEventListener("input", event =>
      renderUsers(event.target.value)
    );

  } catch (error) {
    console.error(error);
    el("usersList").textContent = "Unable to load users.";
  }
}

// 12. ADD COINS
async function addCoins(userId) {
  if (!currentAdmin) return;

  const input = el(`coins-${userId}`);
  const amount = Number(input?.value);

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

      const oldCoins = Number(userDoc.data().coins || 0);
      const newCoins = oldCoins + amount;

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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    alert("Coin transaction completed.");
    await loadUsers();

  } catch (error) {
    console.error(error);
    alert("Coin update failed: " + error.message);
  }
}

// 13. FRAME STORE
async function loadFrames() {
  if (!currentAdmin) return;

  currentPage = "frames";

  pageContent.innerHTML = `
    <h2>Frame Store Management</h2>

    <input id="frameName" placeholder="Frame Name">
    <input id="framePrice" type="number"
      min="0" placeholder="Frame Price">
    <input id="frameImage" placeholder="Frame Image URL">

    <button id="saveFrame">Add Frame</button>
    <div id="framesList">Loading...</div>
  `;

  el("saveFrame").addEventListener("click", saveFrame);

  try {
    const snapshot = await db.collection("frames").get();

    el("framesList").innerHTML = snapshot.docs.map(doc => {
      const frame = doc.data();

      return `
        <div class="dashboard-card">
          <h3>${escapeHTML(frame.name || "Frame")}</h3>
          <p>Price: ${Number(frame.price || 0)} Coins</p>
          <p>ID: ${escapeHTML(doc.id)}</p>
        </div>
      `;
    }).join("");

  } catch (error) {
    el("framesList").textContent = "Unable to load frames.";
  }
}

async function saveFrame() {
  if (!currentAdmin) return;

  const name = el("frameName").value.trim();
  const price = Number(el("framePrice").value);
  const image = el("frameImage").value.trim();

  if (!name || !Number.isSafeInteger(price) || price < 0) {
    alert("Enter valid frame information.");
    return;
  }

  try {
    await db.collection("frames").add({
      name,
      price,
      image,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentAdmin.uid
    });

    alert("Frame added successfully.");
    await loadFrames();

  } catch (error) {
    alert("Frame save failed: " + error.message);
  }
}

// 14. GIFTS MANAGEMENT
async function loadGifts() {
  if (!currentAdmin) return;

  currentPage = "gifts";

  pageContent.innerHTML = `
    <h2>Gift Management</h2>

    <input id="giftName" placeholder="Gift Name">
    <input id="giftPrice" type="number"
      min="0" placeholder="Gift Price">
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

// 15. SAFE HTML OUTPUT
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// 16. SIDEBAR NAVIGATION
document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    if (!currentAdmin) return;

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
        pageContent.innerHTML =
          `<h2>${escapeHTML(page)}</h2>
           <p>This module is not implemented yet.</p>`;
    }
  });
});

// 17. REFRESH BUTTON
el("refreshBtn")?.addEventListener("click", () => {
  if (!currentAdmin) return;

  switch (currentPage) {
    case "users": loadUsers(); break;
    case "frames": loadFrames(); break;
    case "gifts": loadGifts(); break;
    default: loadDashboard();
  }
});

// 18. SAVE STATUS
function updateSaveStatus(message) {
  const status = el("saveStatus");
  if (status) status.textContent = message;
}

console.log("DISCO VOICE CHAT Owner Panel initialized.");
  
