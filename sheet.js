const PORTFOLIO_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbzKIJkTbmIDkK7b8X1he5An8pzkXV14D5OMFXxXKSnBp5EULyntZ1bIyudXcPmpArmZxA/exec"; 

const CONFIG = {
  MAX_SENDS: 3,
  WINDOW_MS: 60 * 60 * 1000,
  COOLDOWN_MS: 60 * 1000
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

async function sendContactSheet(payload) {
  // ใช้ no-cors เพื่อไม่โดน CORS block
  await fetch(PORTFOLIO_SHEETS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { status: "success" }; // ไม่สามารถอ่าน response จริงได้
}

// --- Form submit ---
const form = document.getElementById("contactForm");
const btn = document.getElementById("submitBtn");
const feedback = document.getElementById("feedback");

if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const { allowed, cooldownLeft } = canSend();

    if (!allowed) {
      if (cooldownLeft > 0 && feedback) {
        feedback.style.color = "#fbbf24";
        feedback.textContent = `⚠️ Please wait ${Math.ceil(cooldownLeft/1000)}s before sending again.`;
      } else if (feedback) {
        feedback.style.color = "#f87171";
        feedback.textContent = "❌ You've submitted the full quota.";
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

    btn.innerHTML = "⏳ Sending...";
    btn.disabled = true;

    try {
      await sendContactSheet({ name, email, message });
      recordSend();
      if (feedback) {
        feedback.style.color = "#4ade80";
        feedback.textContent = "✅ Message sent successfully!";
      }
      form.reset();
    } catch (err) {
      if (feedback) {
        feedback.style.color = "#f87171";
        feedback.textContent = "❌ Error! Please try again.";
      }
      console.error(err);
    } finally {
      btn.innerHTML = "Send Message";
      btn.disabled = false;
    }
  });
}