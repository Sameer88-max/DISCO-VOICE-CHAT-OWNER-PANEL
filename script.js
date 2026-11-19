
/* =====================================
   DISCO VOICE CHAT - OWNER PANEL
   SCRIPT.JS
===================================== */

document.addEventListener("DOMContentLoaded", function () {

    // MOBILE SIDEBAR
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");

    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    // NAVIGATION
    document.querySelectorAll(".sidebar nav a").forEach(link => {
        link.addEventListener("click", function () {
            document.querySelectorAll(".sidebar nav a")
                .forEach(item => item.classList.remove("active"));

            this.classList.add("active");

            if (sidebar) {
                sidebar.classList.remove("open");
            }
        });
    });

    // LOGOUT
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            alert("Secure owner login will be connected with backend.");
        });
    }

    // DASHBOARD DEMO DATA
    updateDashboard();

});

// DEMO DATA ONLY - NOT REAL APP DATABASE
let demoUsers = [];
let demoFrames = [];
let demoGifts = [];
let demoStaff = [];

// DASHBOARD
function updateDashboard() {
    document.getElementById("totalUsers").textContent =
        demoUsers.length;

    document.getElementById("totalCoins").textContent =
        demoUsers.reduce((sum, user) => sum + user.coins, 0);

    document.getElementById("totalGifts").textContent =
        demoGifts.length;

    document.getElementById("vipMembers").textContent =
        demoUsers.filter(user => user.vip).length;
}

// FIND OR CREATE DEMO USER
function findDemoUser(id) {
    return demoUsers.find(user => user.id === id);
}

// USER SEARCH
function searchUser() {
    const id = document.getElementById("searchUserId").value.trim();
    const result = document.getElementById("userResult");

    if (!id) {
        result.textContent = "Please enter User ID.";
        return;
    }

    const user = findDemoUser(id);

    if (user) {
        result.textContent =
            `User ID: ${user.id} | Demo Coins: ${user.coins} | Membership: ${user.vip || "None"}`;
    } else {
        result.textContent =
            "No demo user found. Real user search requires backend connection.";
    }
}

// ADD COINS - DEMO ONLY
function addCoins() {
    const id = document.getElementById("coinUserId").value.trim();
    const amount = Number(document.getElementById("coinAmount").value);
    const message = document.getElementById("coinMessage");

    if (!id || !Number.isSafeInteger(amount) || amount <= 0) {
        message.textContent = "Enter a valid User ID and coin amount.";
        return;
    }

    let user = findDemoUser(id);

    if (!user) {
        user = {
            id: id,
            coins: 0,
            vip: null
        };

        demoUsers.push(user);
    }

    if (!Number.isSafeInteger(user.coins + amount)) {
        message.textContent = "Coin amount is too large.";
        return;
    }

    user.coins += amount;

    message.textContent =
        `${amount} demo coins added to User ID ${id}.`;

    document.getElementById("coinAmount").value = "";

    updateDashboard();
}

// ADD FRAME - DEMO ONLY
function addFrame() {
    const name = document.getElementById("frameName").value.trim();
    const price = Number(document.getElementById("framePrice").value);
    const image = document.getElementById("frameImage").value.trim();
    const list = document.getElementById("frameList");

    if (!name || !Number.isSafeInteger(price) || price < 0) {
        list.textContent = "Enter a valid frame name and price.";
        return;
    }

    demoFrames.push({
        name: name,
        price: price,
        image: image
    });

    renderFrames();

    document.getElementById("frameName").value = "";
    document.getElementById("framePrice").value = "";
    document.getElementById("frameImage").value = "";
}

function renderFrames() {
    const list = document.getElementById("frameList");
    list.replaceChildren();

    demoFrames.forEach(frame => {
        const item = document.createElement("p");
        item.textContent = `${frame.name} — ${frame.price} Coins`;
        list.appendChild(item);
    });
}

// ADD GIFT - DEMO ONLY
function addGift() {
    const name = document.getElementById("giftName").value.trim();
    const price = Number(document.getElementById("giftPrice").value);
    const image = document.getElementById("giftImage").value.trim();
    const list = document.getElementById("giftList");

    if (!name || !Number.isSafeInteger(price) || price < 0) {
        list.textContent = "Enter a valid gift name and price.";
        return;
    }

    demoGifts.push({
        name: name,
        price: price,
        image: image
    });

    renderGifts();

    document.getElementById("giftName").value = "";
    document.getElementById("giftPrice").value = "";
    document.getElementById("giftImage").value = "";
    updateDashboard();
}

function renderGifts() {
    const list = document.getElementById("giftList");
    list.replaceChildren();

    demoGifts.forEach(gift => {
        const item = document.createElement("p");
        item.textContent = `${gift.name} — ${gift.price} Coins`;
        list.appendChild(item);
    });
}

// VIP / SVIP - DEMO ONLY
function assignVip() {
    const id = document.getElementById("vipUserId").value.trim();
    const type = document.getElementById("vipType").value;
    const message = document.getElementById("vipMessage");

    if (!id) {
        message.textContent = "Enter User ID.";
        return;
    }

    const user = findDemoUser(id);

    if (!user) {
        message.textContent =
            "Demo user not found. Real membership requires backend.";
        return;
    }

    user.vip = type;
    message.textContent =
        `${type} demo membership assigned to User ID ${id}.`;

    updateDashboard();
}

// WALLET - DEMO ONLY
function checkWallet() {
    const id = document.getElementById("walletUserId").value.trim();
    const result = document.getElementById("walletResult");

    if (!id) {
        result.textContent = "Enter User ID.";
        return;
    }

    const user = findDemoUser(id);

    result.textContent = user
        ? `User ID: ${id} | Demo Coins: ${user.coins}`
        : "Demo wallet not found. Backend connection required.";
}

// ADD STAFF - DEMO ONLY
function addStaff() {
    const id = document.getElementById("staffId").value.trim();
    const role = document.getElementById("staffRole").value;
    const list = document.getElementById("staffList");

    if (!id) {
        list.textContent = "Enter Staff User ID.";
        return;
    }

    if (demoStaff.some(staff => staff.id === id)) {
        list.textContent = "This demo staff ID already exists.";
        return;
    }

    demoStaff.push({
        id: id,
        role: role
    });

    renderStaff();

    document.getElementById("staffId").value = "";
}

function renderStaff() {
    const list = document.getElementById("staffList");
    list.replaceChildren();

    demoStaff.forEach(staff => {
        const item = document.createElement("p");
        item.textContent = `Staff ID: ${staff.id} | Role: ${staff.role}`;
        list.appendChild(item);
    });
}

