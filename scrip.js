const CONFIG = {
  EMAIL: "taonakha2018@gmail.com",
  SHEETS_URL: "https://script.google.com/macros/s/AKfycbxv9UYw0OI4_R17e0dErmKqQUcghse0mjF91cJigQ0MDtj3z_8oJRPtNOdCMLpXgJp3KQ/exec",
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
  try {
    localStorage.setItem("skydev_rate", JSON.stringify(data));
  } catch {}
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

const form = document.getElementById("contactForm");
const btn = document.getElementById("submitBtn");
const feedback = document.getElementById("feedback");
const cooldownMsg = document.getElementById("cooldown-msg");
const rateLabel = document.getElementById("rate-label");
const dots = [0, 1, 2].map(i => document.getElementById(`dot-${i}`));
const menuToggle = document.getElementById("menuToggle");
const navLinksList = document.getElementById("navLinks");

if (menuToggle && navLinksList) {
  menuToggle.addEventListener("click", () => {
    navLinksList.classList.toggle("active");
    menuToggle.querySelector("i").classList.toggle("fa-bars");
    menuToggle.querySelector("i").classList.toggle("fa-times");
  });

  navLinksList.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinksList.classList.remove("active");
      menuToggle.querySelector("i").classList.add("fa-bars");
      menuToggle.querySelector("i").classList.remove("fa-times");
    });
  });
}

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
    btn.textContent = "Quota exceeded for this hour.";
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
    if (cooldownMsg) cooldownMsg.textContent = `Wait ${remaining} seconds before sending again.`;
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

const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-links a");

document.querySelectorAll('.nav-links a, .hero-actions a, .btn[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');
    if (targetId && targetId.startsWith('#')) {
      e.preventDefault();
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

const observerOptions = {
  rootMargin: "-40% 0px -55% 0px"
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(a => {
        a.classList.toggle("active", a.getAttribute("href") === `#${entry.target.id}`);
      });
    }
  });
}, observerOptions);

sections.forEach(s => observer.observe(s));

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const { allowed, cooldownLeft } = canSend();

    if (!allowed) {
      if (cooldownLeft > 0) {
        if (feedback) {
          feedback.style.color = "#fbbf24";
          feedback.textContent = "Please wait before sending again.";
        }
      } else {
        if (feedback) {
          feedback.style.color = "#f87171";
          feedback.textContent = "Quota exceeded for this hour.";
        }
      }
      return;
    }

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    if (!name || !email || !message) {
      if (feedback) {
        feedback.style.color = "#f87171";
        feedback.textContent = "Please fill in all fields.";
      }
      return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = "Sending...";
    btn.disabled = true;

    const payload = {
      name,
      email,
      message,
      origin: window.location.href
    };

    try {
      const emailRes = await fetch(`https://formsubmit.co/ajax/${CONFIG.EMAIL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          _subject: `Portfolio Contact from ${name}`,
          _replyto: email
        })
      });

      const sheetsRes = await fetch(CONFIG.SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const sheetsData = await sheetsRes.json();
      console.log("Sheets response:", sheetsData);

      if (sheetsData.status !== "success") {
        throw new Error(sheetsData.message || "Sheets submission failed");
      }

      if (emailRes.ok) {
        recordSend();
        if (feedback) {
          feedback.style.color = "#4ade80";
          feedback.textContent = "Message sent successfully!";
        }
        form.reset();
      } else {
        throw new Error("Submission failed");
      }
    } catch (err) {
      console.error("Submit error:", err);
      if (feedback) {
        feedback.style.color = "#f87171";
        feedback.textContent = "Error! Please try again.";
      }
    } finally {
      btn.innerHTML = originalText;
      updateRateUI();
    }
  });
}

window.addEventListener("load", updateRateUI);