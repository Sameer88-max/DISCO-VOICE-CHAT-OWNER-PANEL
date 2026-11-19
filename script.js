
/* DISCO VOICE CHAT - OWNER PANEL
   Firebase project: disco-voice-chat
*/

const firebaseConfig = {
  apiKey: "PASTE_YOUR_FIREBASE_API_KEY",
  authDomain: "disco-voice-chat.firebaseapp.com",
  projectId: "disco-voice-chat",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_FIREBASE_APP_ID"
};

const $ = id => document.getElementById(id);

const COLLECTIONS = {
  users: "users",
  rooms: "rooms",
  gifts: "gifts",
  frames: "frames",
  staff: "staff",
  agencies: "agencies",
  payouts: "payouts",
  transactions: "transactions",
  recharge: "recharge_packages",
  events: "events",
  reports: "reports",
  audit: "audit_logs",
  settings: "app_config"
};

let auth = null;
let db = null;
let currentUser = null;
let currentPage = "dashboard";
let pendingChanges = {};
let cache = {};

const pages = {
  dashboard: ["Dashboard", "Platform overview and live statistics"],
  analytics: ["Analytics", "Platform performance and statistics"],
  activity: ["Activity Log", "Recent administrative activities"],
  users: ["User Management", "Manage registered users"],
  rooms: ["Live Room Control", "Manage voice rooms"],
  staff: ["Admin & Staff", "Staff management"],
  agencies: ["Agencies & BD", "Agency and business developer management"],
  roles: ["Roles & Permissions", "Administrative role settings"],
  coins: ["Coins Management", "User coin balance management"],
  recharge: ["Recharge Packages", "Coin recharge packages"],
  wallet: ["Wallet & Diamonds", "Wallet and diamond records"],
  gifts: ["Gift Management", "Virtual gift store"],
  frames: ["Frame Store", "Profile frames and cosmetics"],
  vip: ["VIP / SVIP Control", "Membership levels and benefits"],
  payouts: ["Withdrawals & Payouts", "Withdrawal requests"],
  commission: ["Commission Rules", "Revenue and commission settings"],
  app: ["App Settings", "Application configuration"],
  security: ["Security Control", "Security settings"],
  moderation: ["Moderation", "Content and account moderation"],
  events: ["Events & Rewards", "Events and reward management"],
  notifications: ["Notifications", "Notification settings"],
  broadcasts: ["Broadcast Messages", "Platform announcements"],
  reports: ["Reports", "User reports"],
  integrations: ["Integrations", "Connected services"],
  backup: ["Backup & Export", "Database export tools"],
  settings: ["System Settings", "General settings"]
};

function showError(message) {
  $("loginError").textContent = message;
}

function setConnection(message, good = false) {
  $("connectionStatus").textContent = message;
  $("connectionStatus").style.color = good ? "#56d99b" : "#eab85c";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  }[c]));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function notify(message) {
  $("saveStatus").textContent = message;
}

function initFirebase() {
  if (firebaseConfig.apiKey.startsWith("PASTE_")) {
    setConnection("Firebase configuration required");
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    auth.onAuthStateChanged(async user => {
      if (!user) {
        currentUser = null;
        $("app").classList.add("hidden");
        $("loginScreen").classList.remove("hidden");
        return;
      }

      try {
        // Only explicitly authorized owner accounts can enter.
        const adminDoc = await db.collection("admins").doc(user.uid).get();

        if (!adminDoc.exists ||
            !["owner", "super_admin"].includes(
              adminDoc.data().role
            ) ||
            adminDoc.data().active === false) {
          await auth.signOut();
          showError("Access denied. Owner authorization required.");
          return;
        }

        currentUser = user;
        $("adminEmail").textContent = user.email || "Owner";
        $("loginScreen").classList.add("hidden");
        $("app").classList.remove("hidden");
        setConnection("● Firebase Connected • Owner Authorized", true);
        await loadDashboard();
      } catch (error) {
        console.error(error);
        showError("Owner authorization failed: " + error.message);
        await auth.signOut();
      }
    });
  } catch (error) {
    setConnection("Firebase error: " + error.message);
  }
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!auth) {
    showError("Please add your Firebase configuration first.");
    return;
  }

  try {
    showError("Checking secure login...");
    await auth.signInWithEmailAndPassword(
      $("email").value.trim(),
      $("password").value
    );
    showError("");
  } catch (error) {
    showError(error.message);
  }
});

$("logoutBtn").onclick = async () => {
  if (auth) await auth.signOut();
};

async function getCollection(name, limit = 100) {
  const snapshot = await db.collection(name).limit(limit).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function countCollection(name) {
  try {
    const result = await db.collection(name).count().get();
    return result.data().count || 0;
  } catch {
    const data = await getCollection(name, 500);
    return data.length;
  }
}

async function loadDashboard() {
  try {
    const [users, rooms, transactions, payouts] = await Promise.all([
      countCollection(COLLECTIONS.users),
      countCollection(COLLECTIONS.rooms),
      getCollection(COLLECTIONS.transactions, 200),
      getCollection(COLLECTIONS.payouts, 200)
    ]);

    cache.transactions = transactions;
    cache.payouts = payouts;

    const revenue = transactions.reduce((sum, item) => {
      if (item.status === "completed") {
        return sum + Number(item.amount || 0);
      }
      return sum;
    }, 0);

    const pending = payouts.filter(x =>
      ["pending", "requested"].includes(String(x.status || "").toLowerCase())
    );

    $("pageContent").innerHTML = `
      <h1 class="page-title">Owner Dashboard</h1>
      <p class="page-subtitle">DISCO VOICE CHAT • Super Admin Control Center</p>

      <div class="stats-grid">
        ${stat("♙","Total Users",formatNumber(users),"Registered accounts")}
        ${stat("▣","Live Rooms",formatNumber(rooms),"Room records")}
        ${stat("◉","Revenue Records",formatNumber(revenue),"Completed transaction amount")}
        ${stat("⇧","Pending Payouts",formatNumber(pending.length),"Requests awaiting review")}
      </div>

      <div class="panel-grid">
        ${dashboardPanel("App Control","Application behaviour",[
          ["maintenance","Maintenance Mode","Disable normal app access"],
          ["signup_enabled","New Signup Enabled","Allow new registrations"],
          ["force_update","Force Update","Require application update"],
          ["push_notifications","Push Notifications","Enable notifications"]
        ])}
        ${dashboardPanel("Finance Control","Coins and payments",[
          ["coin_rate","Coin Rate","Set coin pricing"],
          ["commission","Commission Percentage","Platform commission"],
          ["withdrawal_fee","Withdrawal Fee","Withdrawal charges"],
          ["payout_threshold","Payout Threshold","Minimum payout"]
        ])}
        ${dashboardPanel("Live Control","User and room limits",[
          ["max_accounts","Max Accounts per Device","Account limit"],
          ["email_verification","Email Verification","Verification policy"],
          ["kyc_gifts","KYC Required for Gifts","Gift verification"]
        ])}
        ${dashboardPanel("Gift & VIP Control","Membership and store",[
          ["vip_enabled","VIP Enabled","Membership switch"],
          ["svip_enabled","SVIP Enabled","Premium membership"],
          ["gift_enabled","Gifts Enabled","Gift system"]
        ])}
        ${dashboardPanel("Security Control","Security and risk settings",[
          ["two_factor","2FA Required for Admins","Admin protection"],
          ["fraud_detection","Fraud Detection","Fraud monitoring"],
          ["vpn_block","Block VPN Users","Access policy"]
        ])}
        ${dashboardPanel("Event Control","Events and rewards",[
          ["events_enabled","Events Enabled","Event system"],
          ["double_coins","Double Coins Event","Bonus coins"],
          ["rewards_enabled","Rewards Enabled","Reward system"]
        ])}
      </div>
    `;
  } catch (error) {
    console.error(error);
    $("pageContent").innerHTML =
      `<div class="panel">Dashboard data error: ${escapeHTML(error.message)}</div>`;
  }
}

function stat(icon, label, value, subtitle) {
  return `
    <div class="stat-card">
      <span class="stat-icon">${icon}</span>
      <small>${label}</small>
      <h2>${value}</h2>
      <span class="positive">${subtitle}</span>
    </div>`;
}

function dashboardPanel(title, subtitle, items) {
  return `
    <section class="panel">
      <h3>${title}</h3>
      <p>${subtitle}</p>
      ${items.map(item => `
        <div class="control-row">
          <div><b>${item[1]}</b><small>${item[2]}</small></div>
          <button class="outline-btn" onclick="editSetting('${item[0]}')">Configure</button>
        </div>
      `).join("")}
    </section>`;
}

function openPage(page) {
  if (!pages[page]) return;
  currentPage = page;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("breadcrumb").textContent = "Owner Panel / " + pages[page][0];

  if (page === "dashboard") return loadDashboard();
  if (page === "analytics") return showAnalytics();
  if (page === "activity") return showTable("audit");
  if (page === "users") return showTable("users");
  if (page === "rooms") return showTable("rooms");
  if (page === "staff") return showTable("staff");
  if (page === "agencies") return showTable("agencies");
  if (page === "payouts") return showTable("payouts");
  if (page === "gifts") return showTable("gifts");
  if (page === "frames") return showTable("frames");
  if (page === "recharge") return showTable("recharge");
  if (page === "events") return showTable("events");
  if (page === "reports") return showTable("reports");

  if (page === "coins") return showCoins();
  if (page === "wallet") return showWallet();
  if (page === "vip") return showVIP();
  if (page === "commission") return showFinance();
  if (page === "app" || page === "settings") return showSettings();
  if (page === "security") return showSecurity();

  showGeneric(page);
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});

async function showTable(type) {
  const name = COLLECTIONS[type];
  const title = pages[currentPage][0];

  $("pageContent").innerHTML = `
    <h1 class="page-title">${title}</h1>
    <p class="page-subtitle">${pages[currentPage][1]}</p>
    <section class="panel">
      <div class="control-row">
        <b>Database Records</b>
        ${["gifts","frames","recharge","events","staff","agencies"].includes(type)
          ? `<button class="gold-btn" onclick="createRecord('${type}')">＋ Add New</button>` : ""}
      </div>
      <input class="table-search" id="recordSearch" placeholder="Search records...">
      <div class="table-wrap" id="tableContent"><div class="empty">Loading records...</div></div>
    </section>
  `;

  try {
    const records = await getCollection(name, 200);
    cache[type] = records;
    renderTable(type, records);

    $("recordSearch").addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      renderTable(type, records.filter(record =>
        JSON.stringify(record).toLowerCase().includes(q)
      ));
    });
  } catch (error) {
    $("tableContent").innerHTML =
      `<div class="empty">Database access error: ${escapeHTML(error.message)}</div>`;
  }
}

function renderTable(type, records) {
  const target = $("tableContent");
  if (!target) return;

  if (!records.length) {
    target.innerHTML = '<div class="empty">No records found.</div>';
    return;
  }

  const keys = [...new Set(records.flatMap(x => Object.keys(x)))].filter(
    key => key !== "id"
  ).slice(0, 5);

  target.innerHTML = `
    <table>
      <thead><tr>
        <th>Document ID</th>
        ${keys.map(k => `<th>${escapeHTML(k)}</th>`).join("")}
        <th>Action</th>
      </tr></thead>
      <tbody>
        ${records.map(record => `
          <tr>
            <td>${escapeHTML(record.id)}</td>
            ${keys.map(k => `<td>${escapeHTML(
              typeof record[k] === "object"
                ? JSON.stringify(record[k])
                : record[k]
            )}</td>`).join("")}
            <td>
              ${type === "payouts" ?
                `<button class="outline-btn" onclick="reviewPayout('${escapeHTML(record.id)}')">Review</button>` :
                `<button class="outline-btn" onclick="viewRecord('${type}','${escapeHTML(record.id)}')">View</button>`
              }
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function showCoins() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">Coins Management</h1>
    <p class="page-subtitle">User coin adjustment and transaction history</p>
    <div class="panel">
      <h3>Adjust User Coins</h3>
      <p>Use a verified user document ID.</p>
      <input class="control-input" id="coinUid" placeholder="User Document ID">
      <input class="control-input" id="coinAmount" type="number" min="1" placeholder="Coin Amount">
      <select class="control-input" id="coinAction">
        <option value="add">Add Coins</option>
        <option value="subtract">Subtract Coins</option>
      </select>
      <input class="control-input" id="coinReason" placeholder="Reason for adjustment">
      <button class="gold-btn" onclick="adjustCoins()">Confirm Coin Adjustment</button>
    </div>
  `;
}

async function adjustCoins() {
  const uid = $("coinUid").value.trim();
  const amount = Number($("coinAmount").value);
  const action = $("coinAction").value;
  const reason = $("coinReason").value.trim();

  if (!uid || !Number.isSafeInteger(amount) || amount <= 0 || !reason) {
    return alert("Enter a valid user ID, coin amount and reason.");
  }

  if (!confirm(`Confirm ${action} ${amount} coins for ${uid}?`)) return;

  try {
    const ref = db.collection(COLLECTIONS.users).doc(uid);
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error("User not found.");

      const data = snap.data();
      const oldCoins = Number(data.coins ?? data.balance ?? 0);
      const next = action === "add" ? oldCoins + amount : oldCoins - amount;

      if (next < 0) throw new Error("Insufficient user coins.");

      const field = data.coins !== undefined ? "coins" : "balance";
      transaction.update(ref, { [field]: next });
    });

    await db.collection(COLLECTIONS.audit).add({
      action: "coin_adjustment",
      userId: uid,
      amount,
      operation: action,
      reason,
      adminUid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    notify("Coin adjustment submitted.");
    alert("Coin adjustment completed.");
  } catch (error) {
    alert("Adjustment failed: " + error.message);
  }
}

function showWallet() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">Wallet & Diamonds</h1>
    <p class="page-subtitle">Wallet records and diamond transactions</p>
    <div class="panel">
      <h3>Wallet Management</h3>
      <p>Review wallet and transaction records.</p>
      <button class="gold-btn" onclick="openPage('users')">View Users</button>
      <button class="outline-btn" onclick="openPage('payouts')">View Payouts</button>
    </div>`;
}

function showVIP() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">VIP / SVIP Control</h1>
    <p class="page-subtitle">Membership configuration</p>
    <div class="panel-grid">
      ${membershipPanel("VIP",10)}
      ${membershipPanel("SVIP",10)}
    </div>`;
}

function membershipPanel(name, levels) {
  return `
    <section class="panel">
      <h3>${name} Membership</h3>
      <p>Configure membership levels and prices.</p>
      <div class="control-row"><b>Enable ${name}</b>
        <input type="checkbox" class="toggle" id="${name}Enabled">
      </div>
      <label>Monthly Price</label>
      <input class="control-input" id="${name}Price" type="number" min="0" placeholder="Price">
      <label>Available Levels</label>
      <select class="control-input" id="${name}Levels">
        ${Array.from({length:levels},(_,i)=>`<option>${i+1}</option>`).join("")}
      </select>
      <button class="gold-btn" onclick="saveMembership('${name}')">Save ${name}</button>
    </section>`;
}

async function saveMembership(name) {
  const data = {
    enabled: $(name+"Enabled").checked,
    monthlyPrice: Number($(name+"Price").value || 0),
    levels: Number($(name+"Levels").value)
  };
  await saveConfig(name.toLowerCase(), data);
}

function showFinance() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">Commission Rules</h1>
    <p class="page-subtitle">Platform financial settings</p>
    <div class="panel">
      <label>Coin Rate (USD per 1000 coins)</label>
      <input class="control-input" id="coinRate" type="number" step="0.01">
      <label>Commission Percentage</label>
      <input class="control-input" id="commissionRate" type="number" min="0" max="100">
      <label>Withdrawal Fee</label>
      <input class="control-input" id="withdrawFee" type="number" min="0">
      <label>Auto Payout Threshold</label>
      <input class="control-input" id="payoutLimit" type="number" min="0">
      <button class="gold-btn" onclick="saveFinance()">Save Finance Settings</button>
    </div>`;
  loadFinance();
}

async function loadFinance() {
  const data = await getConfig("finance");
  if (!data) return;
  $("coinRate").value = data.coinRate ?? "";
  $("commissionRate").value = data.commission ?? "";
  $("withdrawFee").value = data.withdrawalFee ?? "";
  $("payoutLimit").value = data.payoutThreshold ?? "";
}

async function saveFinance() {
  await saveConfig("finance", {
    coinRate: Number($("coinRate").value),
    commission: Number($("commissionRate").value),
    withdrawalFee: Number($("withdrawFee").value),
    payoutThreshold: Number($("payoutLimit").value)
  });
}

async function getConfig(id) {
  const snap = await db.collection(COLLECTIONS.settings).doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function saveConfig(id, data) {
  try {
    await db.collection(COLLECTIONS.settings).doc(id).set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.uid
    }, { merge: true });

    await db.collection(COLLECTIONS.audit).add({
      action: "settings_update",
      setting: id,
      adminUid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    notify("Settings saved successfully.");
    alert("Settings saved.");
  } catch (error) {
    alert("Save failed: " + error.message);
  }
}

async function editSetting(key) {
  const current = await getConfig("general") || {};
  const value = current[key] ?? "";
  const isBoolean = typeof value === "boolean";

  $("modalTitle").textContent = "Configure " + key;
  $("modalBody").innerHTML = `
    <label>Setting: ${escapeHTML(key)}</label>
    ${isBoolean
      ? `<select id="settingValue"><option value="true">Enabled</option><option value="false">Disabled</option></select>`
      : `<input id="settingValue" value="${escapeHTML(value)}" placeholder="Enter setting value">`
    }
    <button class="gold-btn" id="modalSave">Save Setting</button>`;

  if (isBoolean) $("settingValue").value = String(value);

  $("modalSave").onclick = async () => {
    const v = $("settingValue").value;
    await saveConfig("general", {
      [key]: isBoolean ? v === "true" : v
    });
    closeModal();
  };

  $("modal").classList.remove("hidden");
}

async function showSettings() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">${pages[currentPage][0]}</h1>
    <p class="page-subtitle">System configuration</p>
    <div class="panel">
      <h3>General Application Settings</h3>
      <p>Settings are stored in Firebase app_config.</p>
      <button class="gold-btn" onclick="editSetting('maintenance')">Maintenance Mode</button>
      <button class="outline-btn" onclick="editSetting('signup_enabled')">Signup Control</button>
      <button class="outline-btn" onclick="editSetting('force_update')">Force Update</button>
    </div>`;
}

function showSecurity() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">Security Control</h1>
    <p class="page-subtitle">Security and administrative access</p>
    <div class="panel">
      <h3>Security Status</h3>
      <div class="control-row"><b>Authenticated Owner</b><span class="positive">Verified</span></div>
      <div class="control-row"><b>Firebase Authentication</b><span class="positive">Connected</span></div>
      <div class="control-row"><b>Admin authorization</b><span class="positive">Required</span></div>
      <p>Manage authorized administrators through the secure Firebase admins collection.</p>
    </div>`;
}

async function showAnalytics() {
  $("pageContent").innerHTML = `
    <h1 class="page-title">Analytics</h1>
    <p class="page-subtitle">Platform database statistics</p>
    <div class="panel-grid">
      ${Object.entries(COLLECTIONS).map(([key,value])=>`
        <div class="panel">
          <h3>${escapeHTML(key)}</h3>
          <p>${escapeHTML(value)}</p>
          <button class="outline-btn" onclick="showTable('${key}')">View Records</button>
        </div>`).join("")}
    </div>`;
}

function showGeneric(page) {
  const title = pages[page][0];
  $("pageContent").innerHTML = `
    <h1 class="page-title">${escapeHTML(title)}</h1>
    <p class="page-subtitle">${escapeHTML(pages[page][1])}</p>
    <div class="panel">
      <h3>${escapeHTML(title)} Configuration</h3>
      <p>Choose the relevant module to manage its Firebase records.</p>
      <button class="gold-btn" onclick="showSettings()">Open System Settings</button>
    </div>`;
}

function showCoinsHistory() {
  showTable("transactions");
}

function showPayouts() {
  showTable("payouts");
}

async function createRecord(type) {
  const name = prompt("Enter record name:");
  if (!name || !name.trim()) return;

  try {
    const ref = await db.collection(COLLECTIONS[type]).add({
      name: name.trim(),
      enabled: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid
    });

    alert("Record created: " + ref.id);
    openPage(type === "recharge" ? "recharge" : type);
  } catch (error) {
    alert("Create failed: " + error.message);
  }
}

async function viewRecord(type, id) {
  const record = (cache[type] || []).find(x => x.id === id);
  if (!record) return alert("Record not found.");

  $("modalTitle").textContent = "Record Details";
  $("modalBody").innerHTML =
    `<pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:#f8f2fa">${escapeHTML(JSON.stringify(record,null,2))}</pre>`;
  $("modal").classList.remove("hidden");
}

async function reviewPayout(id) {
  const action = prompt("Type approve or reject:");
  if (!["approve","reject"].includes(String(action).toLowerCase())) return;

  try {
    await db.collection(COLLECTIONS.payouts).doc(id).update({
      status: action.toLowerCase() === "approve" ? "approved" : "rejected",
      reviewedBy: currentUser.uid,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection(COLLECTIONS.audit).add({
      action: "payout_review",
      payoutId: id,
      decision: action,
      adminUid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Payout review saved.");
    showTable("payouts");
  } catch (error) {
    alert("Review failed: " + error.message);
  }
}

function closeModal() {
  $("modal").classList.add("hidden");
}

$("closeModal").onclick = closeModal;

$("refreshBtn").onclick = () => openPage(currentPage);

$("menuSearch").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll(".nav-item").forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
  });
});

$("globalSearch").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  const match = Object.entries(pages).find(([key,value]) =>
    (key + " " + value.join(" ")).toLowerCase().includes(q)
  );
  if (match && q.length > 1) openPage(match[0]);
});

$("saveBtn").onclick = () => {
  notify("Only individually confirmed settings are saved.");
};

$("discardBtn").onclick = () => {
  if (confirm("Discard unsaved local changes?")) {
    pendingChanges = {};
    notify("Local pending changes cleared.");
    openPage(currentPage);
  }
};

$("emergencyBtn").onclick = async () => {
  const confirmed = confirm(
    "Emergency stop? This changes the global maintenance setting."
  );
  if (!confirmed) return;

  const phrase = prompt("Type EMERGENCY to confirm:");
  if (phrase !== "EMERGENCY") return;

  try {
    await saveConfig("general", {
      maintenance: true,
      emergencyStop: true
    });
    alert("Maintenance flag enabled. Backend enforcement must also be configured.");
  } catch (error) {
    alert(error.message);
  }
};

initFirebase();
