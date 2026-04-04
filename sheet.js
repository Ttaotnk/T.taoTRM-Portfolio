const PORTFOLIO_SHEETS_URL = "https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec";
const ALLOWED_PORTFOLIO_BASE = "https://ttaotnk.github.io/T.taoTRM-Portfolio/";

const CONFIG = { MAX_SENDS: 3, WINDOW_MS: 60*60*1000, COOLDOWN_MS: 60*1000 };

// ----------------- Rate Limiting -----------------
function getRateData() {
  try { return JSON.parse(localStorage.getItem("skydev_rate")) || { sends: [], lastSent: 0 }; }
  catch { return { sends: [], lastSent: 0 }; }
}

function saveRateData(data) { localStorage.setItem("skydev_rate", JSON.stringify(data)); }

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

// ----------------- Send function -----------------
async function sendContactSheet(payload) {
  if (!location.href.startsWith(ALLOWED_PORTFOLIO_BASE)) {
    throw new Error("❌ Page URL not allowed to send contact sheet.");
  }

  const res = await fetch(PORTFOLIO_SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`❌ Failed to send. Status: ${res.status}`);
  return res.json();
}

// ----------------- UI -----------------
const form = document.getElementById("contactForm");
const btn = document.getElementById("submitBtn");
const feedback = document.getElementById("feedback");
let cooldownTimer = null;

function updateRateUI() {
  const { remaining, cooldownLeft } = canSend();
  if (remaining <= 0) { btn.disabled = true; btn.textContent = "Quota reached"; }
  else if (cooldownLeft > 0) { btn.disabled = true; startCooldown(cooldownLeft); }
  else { btn.disabled = false; btn.textContent = "Send Message"; if(feedback) feedback.textContent=""; }
}

function startCooldown(ms) {
  if (cooldownTimer) clearInterval(cooldownTimer);
  let remaining = Math.ceil(ms/1000);
  cooldownTimer = setInterval(()=>{
    if(feedback) feedback.textContent = `⏳ Wait ${remaining} sec before sending again.`;
    remaining--;
    if(remaining<0){ clearInterval(cooldownTimer); updateRateUI(); }
  },1000);
}

// ----------------- Form submit -----------------
if (form) {
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const { allowed, cooldownLeft } = canSend();
    if(!allowed) { updateRateUI(); return; }

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();
    if(!name || !email || !message){ if(feedback) feedback.textContent="❌ Fill all fields"; return; }

    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Sending..."; btn.disabled = true;

    try {
      await sendContactSheet({ name, email, message, pageUrl: location.href });
      recordSend();
      if(feedback) feedback.style.color="#4ade80"; feedback.textContent="✅ Message sent!";
      form.reset();
    } catch(err){
      console.error(err);
      if(feedback) { feedback.style.color="#f87171"; feedback.textContent = err.message||"❌ Error!"; }
    } finally { btn.innerHTML = originalText; updateRateUI(); }
  });
}

window.addEventListener("load", updateRateUI);