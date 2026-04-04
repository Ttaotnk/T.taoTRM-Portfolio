const PORTFOLIO_SHEETS_URL =
    "https://script.google.com/macros/s/AKfycbzc561qRKmdGnTHb6-8G2lDh1IOBWcYgYmN7bz_HUD1105Avr7KcqpvqmWKYfPjBLGNVg/exec";

// ตั้งค่าหน้า portfolio ที่อนุญาต
const ALLOWED_PORTFOLIO_BASE = "https://ttaotnk.github.io/T.taoTRM-Portfolio";

async function sendContactSheet(payload) {
    // ตรวจสอบ URL ก่อนส่ง
    if (!location.href.startsWith(ALLOWED_PORTFOLIO_BASE)) {
        throw new Error("❌ Page URL not allowed to send contact sheet.");
    }

    const res = await fetch(PORTFOLIO_SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        throw new Error(`❌ Failed to send. Status: ${res.status}`);
    }

    return res.json(); // ถ้า Apps Script ส่ง JSON กลับ
}

const CONFIG = {
    MAX_SENDS: 3,
    WINDOW_MS: 60 * 60 * 1000, // 1 ชั่วโมง
    COOLDOWN_MS: 60 * 1000     // 1 นาที
};

function getRateData() {
    try {
        const raw = localStorage.getItem("skydev_rate");
        if (!raw) return { sends: [], lastSent: 0 };
        return JSON.parse(raw);
    } catch {
        return { sends: [], lastSent: 0 };
    }
}

function saveRateData(data) {
    try { localStorage.setItem("skydev_rate", JSON.stringify(data)); } catch {}
}

function getValidSends(data) {
    const now = Date.now();
    return data.sends.filter(t => now - t < CONFIG.WINDOW_MS);
}

function canSend() {
    const data = getRateData();
    const validSends = getValidSends(data);
    const now = Date.now();
    const cooldownLeft = CONFIG.COOLDOWN_MS - (now - data.lastSent);

    return {
        allowed: validSends.length < CONFIG.MAX_SENDS && cooldownLeft <= 0,
        remaining: CONFIG.MAX_SENDS - validSends.length,
        cooldownLeft: Math.max(0, cooldownLeft),
        validSends
    };
}

function recordSend() {
    const data = getRateData();
    const now = Date.now();
    data.sends = getValidSends(data);
    data.sends.push(now);
    data.lastSent = now;
    saveRateData(data);
}

// --- UI Elements ---
const form = document.getElementById("contactForm");
const btn = document.getElementById("submitBtn");
const feedback = document.getElementById("feedback");
const cooldownMsg = document.getElementById("cooldown-msg");
const rateLabel = document.getElementById("rate-label");
const dots = [0, 1, 2].map(i => document.getElementById(`dot-${i}`));

let cooldownTimer = null;

function updateRateUI() {
    const { remaining, cooldownLeft } = canSend();
    const used = CONFIG.MAX_SENDS - remaining;

    dots.forEach((dot, i) => {
        if (dot) dot.className = "rate-dot " + (i < used ? "used" : "available");
    });

    if (rateLabel) rateLabel.textContent = `remaining ${remaining} / ${CONFIG.MAX_SENDS} times`;

    if (remaining <= 0) {
        btn.disabled = true;
        btn.textContent = "I've submitted the full quota.";
    } else if (cooldownLeft > 0) {
        btn.disabled = true;
        startCooldownCountdown(cooldownLeft);
    } else {
        btn.disabled = false;
        btn.textContent = "Send Message";
        if (cooldownMsg) cooldownMsg.textContent = "";
    }
}

function startCooldownCountdown(ms) {
    if (cooldownTimer) clearInterval(cooldownTimer);
    let remaining = Math.ceil(ms / 1000);

    const tick = () => {
        if (cooldownMsg) cooldownMsg.textContent = `⏳ Wait ${remaining} seconds before sending again.`;
        remaining--;
        if (remaining < 0) {
            clearInterval(cooldownTimer);
            if (cooldownMsg) cooldownMsg.textContent = "";
            updateRateUI();
        }
    };
    tick();
    cooldownTimer = setInterval(tick, 1000);
}

// --- Form submit ---
if (form) {
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const { allowed, cooldownLeft } = canSend();

        if (!allowed) {
            if (cooldownLeft > 0 && feedback) {
                feedback.style.color = "#fbbf24";
                feedback.textContent = "⚠️ Please wait for the cooldown before sending again.";
            } else if (feedback) {
                feedback.style.color = "#f87171";
                feedback.textContent = "❌ I've submitted the full quota of 3 times per hour.";
            }
            return;
        }

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();
        if (!name || !email || !message) {
            if (feedback) feedback.textContent = "❌ Please fill in all fields.";
            return;
        }

        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Sending...";
        btn.disabled = true;

        const payload = { name, email, message, pageUrl: location.href };

        try {
            await sendContactSheet(payload);
            recordSend();
            if (feedback) {
                feedback.style.color = "#4ade80";
                feedback.textContent = "✅ Message sent successfully!";
            }
            form.reset();
        } catch (err) {
            console.error("Submit error:", err);
            if (feedback) {
                feedback.style.color = "#f87171";
                feedback.textContent = err.message || "❌ Error! Please try again.";
            }
        } finally {
            btn.innerHTML = originalText;
            updateRateUI();
        }
    });
}

window.addEventListener("load", updateRateUI);