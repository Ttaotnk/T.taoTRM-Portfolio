  const CONFIG = {
        EMAIL: "taonakha2018@gmail.com",
        SHEETS_URL: "https://script.google.com/macros/s/AKfycbzIqAahmlNzzJk6RfZIyjrSmkd_ea7zmoLtcGUNLOZU3cYeoKULYaHpIATUsL-D3iQEDQ/exec",
        MAX_SENDS: 3,               // สูงสุดต่อ window
        WINDOW_MS: 60 * 60 * 1000,   // 1 ชั่วโมง
        COOLDOWN_MS: 60 * 1000       // cooldown 60 วินาที หลังแต่ละครั้ง
    };

    /* ── Rate Limit Store (localStorage) ── */
    function getRateData() {
        try {
            const raw = localStorage.getItem("skydev_rate");
            if (!raw) return { sends: [], lastSent: 0 };
            return JSON.parse(raw);
        } catch { return { sends: [], lastSent: 0 }; }
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

    /* ── UI Elements ── */
    const form = document.getElementById("contactForm");
    const btn = document.getElementById("submitBtn");
    const feedback = document.getElementById("feedback");
    const cooldownMsg = document.getElementById("cooldown-msg");
    const rateLabel = document.getElementById("rate-label");
    const dots = [0, 1, 2].map(i => document.getElementById(`dot-${i}`));
    const menuToggle = document.getElementById("menuToggle");
    const navLinksList = document.getElementById("navLinks");

    /* ── Mobile Menu Logic ── */
    if (menuToggle && navLinksList) {
        menuToggle.addEventListener("click", () => {
            navLinksList.classList.toggle("active");
            menuToggle.querySelector("i").classList.toggle("fa-bars");
            menuToggle.querySelector("i").classList.toggle("fa-times");
        });

        // Close menu when clicking links
        navLinksList.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                navLinksList.classList.remove("active");
                menuToggle.querySelector("i").classList.add("fa-bars");
                menuToggle.querySelector("i").classList.remove("fa-times");
            });
        });
    }

    let cooldownTimer = null;

    /* ── Rate Limit Logic ── */
    function updateRateUI() {
        const { remaining, cooldownLeft } = canSend();
        const used = CONFIG.MAX_SENDS - remaining;

        // Visual indicator (dots)
        dots.forEach((dot, i) => {
            if (dot) dot.className = "rate-dot " + (i < used ? "used" : "available");
        });

        if (rateLabel) rateLabel.textContent = `เหลือ ${remaining} / ${CONFIG.MAX_SENDS} ครั้ง`;

        if (remaining <= 0) {
            btn.disabled = true;
            btn.textContent = "ส่งครบโควต้าแล้ว";
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
            if (cooldownMsg) cooldownMsg.textContent = `⏳ รอ ${remaining} วินาที ก่อนส่งอีกครั้ง`;
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

    /* ── Smooth Navigation (Synced with main.js logic) ── */
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".nav-links a");

    // All-in-one anchor listener for smooth scroll
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

    // IntersectionObserver for High Performance active nav state
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

    /* ── Form Handler (FormSubmit + Google Sheets) ── */
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const { allowed, cooldownLeft } = canSend();

            if (!allowed) {
                if (cooldownLeft > 0) {
                    if (feedback) {
                        feedback.style.color = "#fbbf24";
                        feedback.textContent = "⚠️ กรุณารอ cooldown ก่อนส่งอีกครั้ง";
                    }
                } else {
                    if (feedback) {
                        feedback.style.color = "#f87171";
                        feedback.textContent = "❌ ส่งครบโควต้า 3 ครั้ง/ชั่วโมงแล้ว";
                    }
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

            const payload = { name, email, message };

            try {
                // Endpoint 1: FormSubmit (Email Notification)
                const emailRes = await fetch(`https://formsubmit.co/ajax/${CONFIG.EMAIL}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...payload,
                        _subject: `Portfolio Contact from ${name}`,
                        _replyto: email
                    })
                });

                // Endpoint 2: Google Sheets (Database)
                await fetch(CONFIG.SHEETS_URL, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify(payload)
                });

                if (emailRes.ok) {
                    recordSend();
                    if (feedback) {
                        feedback.style.color = "#4ade80";
                        feedback.textContent = "✅ Message sent successfully!";
                    }
                    form.reset();
                } else {
                    throw new Error("Submission failed");
                }
            } catch (err) {
                console.error("Submit error:", err);
                if (feedback) {
                    feedback.style.color = "#f87171";
                    feedback.textContent = "❌ Error! Please try again.";
                }
            } finally {
                btn.innerHTML = originalText;
                updateRateUI();
            }
        });
    }

    /* ── Initial Load ── */
    window.addEventListener("load", updateRateUI);