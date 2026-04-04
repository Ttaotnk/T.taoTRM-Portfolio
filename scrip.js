// ==================== CONFIGURATION ====================
const FORM_CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbzHcE3A0HZICOkwKWolRE7FTSrH5rEZc3SK4L3MRwn9uFry0qtqKMeyygBisJSjB9S_ag/exec",
    MAX_SENDS_PER_HOUR: 3,
    COOLDOWN_MS: 60000,
    FORM_TIMEOUT_MS: 30000,
    SESSION_RETRY_MS: 2000,
    ENABLE_DEBUG: true
};

let AUTH_TOKEN = null;
let currentSessionToken = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    initializeRateLimiter();
    initializeMobileMenu();
    initializeSmoothScroll();
    addCSRFProtection();
    
    if (FORM_CONFIG.ENABLE_DEBUG) {
        console.log('Form initialized successfully');
        console.log('🔒 Security: Session Token + Multi-layer Protection');
    }
});

// ==================== SESSION TOKEN MANAGEMENT ====================

async function getSessionToken() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(FORM_CONFIG.API_URL, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Origin': window.location.origin,
                'X-Requested-With': 'XMLHttpRequest'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const token = await response.text();
        
        if (!token || token.length < 10) {
            throw new Error('Invalid token received');
        }
        
        if (FORM_CONFIG.ENABLE_DEBUG) {
            console.log('✅ Session token obtained');
        }
        
        return token;
        
    } catch (error) {
        console.error('Failed to get session token:', error);
        return null;
    }
}

// ==================== MOBILE MENU ====================
function initializeMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
        
        const links = navLinks.querySelectorAll('a');
        links.forEach(function(link) {
            link.addEventListener('click', function() {
                navLinks.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    icon.classList.add('fa-bars');
                    icon.classList.remove('fa-times');
                }
            });
        });
    }
}

// ==================== SMOOTH SCROLL ====================
function initializeSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    if (sections.length > 0) {
        window.addEventListener('scroll', function() {
            let current = '';
            const scrollPosition = window.scrollY + 100;
            
            sections.forEach(function(section) {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                
                if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                    current = section.getAttribute('id');
                }
            });
            
            navLinks.forEach(function(link) {
                link.classList.remove('active');
                const href = link.getAttribute('href').substring(1);
                if (href === current) {
                    link.classList.add('active');
                }
            });
        });
    }
}

// ==================== FORM INITIALIZATION ====================

function initializeForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(function(input) {
        input.addEventListener('input', function() {
            sanitizeInput(input);
            validateField(input);
        });
        
        input.addEventListener('blur', function() {
            validateField(input);
        });
    });
    
    form.addEventListener('submit', handleFormSubmit);
}

function sanitizeInput(input) {
    let value = input.value;
    
    value = value.replace(/<[^>]*>/g, '');
    value = value.replace(/javascript:/gi, '');
    value = value.replace(/on\w+=/gi, '');
    
    const maxLength = input.getAttribute('maxlength');
    if (maxLength && value.length > parseInt(maxLength)) {
        value = value.substring(0, parseInt(maxLength));
    }
    
    if (value !== input.value) {
        input.value = value;
    }
}

function validateField(input) {
    const value = input.value.trim();
    const id = input.id;
    let isValid = true;
    
    switch (id) {
        case 'name':
            if (value.length < 2 || value.length > 50) {
                isValid = false;
            }
            break;
            
        case 'email':
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value)) {
                isValid = false;
            }
            break;
            
        case 'message':
            if (value.length < 10 || value.length > 500) {
                isValid = false;
            }
            break;
    }
    
    input.style.borderColor = isValid ? '#e0e0e0' : '#f87171';
    return isValid;
}

// ==================== RATE LIMITING ====================

class RateLimiter {
    constructor(maxSends, windowMs) {
        this.maxSends = maxSends;
        this.windowMs = windowMs;
        this.sends = [];
        this.lastSent = 0;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const data = localStorage.getItem('form_rate_limit');
            if (data) {
                const parsed = JSON.parse(data);
                this.sends = parsed.sends || [];
                this.lastSent = parsed.lastSent || 0;
                this.cleanExpired();
            }
        } catch (error) {
            console.error('Failed to load rate limit data:', error);
        }
    }
    
    saveToStorage() {
        try {
            localStorage.setItem('form_rate_limit', JSON.stringify({
                sends: this.sends,
                lastSent: this.lastSent
            }));
        } catch (error) {
            console.error('Failed to save rate limit data:', error);
        }
    }
    
    cleanExpired() {
        const now = Date.now();
        this.sends = this.sends.filter(function(timestamp) {
            return now - timestamp < this.windowMs;
        }.bind(this));
    }
    
    canSend() {
        this.cleanExpired();
        const now = Date.now();
        const cooldownRemaining = FORM_CONFIG.COOLDOWN_MS - (now - this.lastSent);
        
        return {
            allowed: this.sends.length < this.maxSends && cooldownRemaining <= 0,
            remaining: this.maxSends - this.sends.length,
            cooldownLeft: Math.max(0, cooldownRemaining)
        };
    }
    
    recordSend() {
        const now = Date.now();
        this.cleanExpired();
        this.sends.push(now);
        this.lastSent = now;
        this.saveToStorage();
    }
}

const rateLimiter = new RateLimiter(
    FORM_CONFIG.MAX_SENDS_PER_HOUR,
    60 * 60 * 1000
);

function initializeRateLimiter() {
    updateRateUI();
    
    setInterval(function() {
        updateRateUI();
    }, 1000);
}

function updateRateUI() {
    const result = rateLimiter.canSend();
    const remaining = result.remaining;
    const cooldownLeft = result.cooldownLeft;
    const used = FORM_CONFIG.MAX_SENDS_PER_HOUR - remaining;
    
    for (let i = 0; i < 3; i++) {
        const dot = document.getElementById('dot-' + i);
        if (dot) {
            dot.className = 'rate-dot ' + (i < used ? 'used' : 'available');
        }
    }
    
    const rateLabel = document.getElementById('rate-label');
    if (rateLabel) {
        rateLabel.textContent = 'Remaining: ' + remaining + ' / ' + FORM_CONFIG.MAX_SENDS_PER_HOUR;
    }
    
    const btn = document.getElementById('submitBtn');
    if (btn) {
        if (remaining <= 0) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-clock"></i> Quota reached for this hour';
        } else if (cooldownLeft > 0) {
            btn.disabled = true;
            const seconds = Math.ceil(cooldownLeft / 1000);
            btn.innerHTML = '<i class="fas fa-hourglass-half"></i> Wait ' + seconds + ' seconds';
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
        }
    }
    
    const cooldownMsg = document.getElementById('cooldown-msg');
    if (cooldownMsg) {
        if (cooldownLeft > 0) {
            const seconds = Math.ceil(cooldownLeft / 1000);
            cooldownMsg.textContent = '⏳ Please wait ' + seconds + ' seconds before sending again';
            cooldownMsg.style.display = 'block';
        } else {
            cooldownMsg.textContent = '';
            cooldownMsg.style.display = 'none';
        }
    }
}

function checkCanSubmit() {
    return rateLimiter.canSend().allowed;
}

// ==================== FORM SUBMISSION ====================

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!checkCanSubmit()) {
        showRateLimitWarning();
        return;
    }
    
    // Get session token first
    showFeedback('🔄 Getting session token...', 'info');
    const sessionToken = await getSessionToken();
    
    if (!sessionToken) {
        showFeedback('❌ Unable to establish secure session. Please refresh and try again.', 'error');
        return;
    }
    
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    
    const name = sanitizeString(nameInput.value);
    const email = sanitizeString(emailInput.value);
    const message = sanitizeString(messageInput.value);
    
    if (!validateAllFields({ name, email, message })) {
        return;
    }
    
    const data = {
        name: name,
        email: email,
        message: message,
        sessionToken: sessionToken,  // ใช้ session token แทน hardcoded
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || window.location.href
    };
    
    const submitBtn = document.getElementById('submitBtn');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(function() {
            controller.abort();
        }, FORM_CONFIG.FORM_TIMEOUT_MS);
        
        const response = await fetch(FORM_CONFIG.API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Origin': window.location.origin,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(data),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        let result;
        try {
            result = await response.json();
        } catch (e) {
            result = { status: 'error', message: 'Invalid response from server' };
        }
        
        if (response.ok && result.status === 'success') {
            rateLimiter.recordSend();
            updateRateUI();
            showFeedback('✅ Message sent successfully!', 'success');
            
            nameInput.value = '';
            emailInput.value = '';
            messageInput.value = '';
            
            nameInput.style.borderColor = '#e0e0e0';
            emailInput.style.borderColor = '#e0e0e0';
            messageInput.style.borderColor = '#e0e0e0';
            
        } else {
            throw new Error(result.message || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        
        if (error.name === 'AbortError') {
            showFeedback('⏰ Request timeout. Please try again.', 'error');
        } else if (error.message.includes('429') || error.message.includes('limit')) {
            showFeedback('📊 Too many requests. Please wait a moment.', 'error');
            updateRateUI();
        } else if (error.message.includes('401') || error.message.includes('session')) {
            showFeedback('🔐 Session expired. Please refresh and try again.', 'error');
        } else if (error.message.includes('spam')) {
            showFeedback('🚫 Message appears to be spam. Please check your content.', 'error');
        } else {
            showFeedback('❌ ' + (error.message || 'An error occurred. Please try again.'), 'error');
        }
        
    } finally {
        submitBtn.innerHTML = originalHTML;
        submitBtn.disabled = false;
    }
}

// ==================== VALIDATION HELPERS ====================

function sanitizeString(str) {
    if (!str) return '';
    
    return str
        .toString()
        .trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .substring(0, 500);
}

function validateAllFields(data) {
    const errors = [];
    
    if (!data.name || data.name.length < 2) {
        errors.push('Name must be at least 2 characters');
        document.getElementById('name').style.borderColor = '#f87171';
    } else {
        document.getElementById('name').style.borderColor = '#e0e0e0';
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!data.email || !emailRegex.test(data.email)) {
        errors.push('Please enter a valid email address');
        document.getElementById('email').style.borderColor = '#f87171';
    } else {
        document.getElementById('email').style.borderColor = '#e0e0e0';
    }
    
    if (!data.message || data.message.length < 10) {
        errors.push('Message must be at least 10 characters');
        document.getElementById('message').style.borderColor = '#f87171';
    } else {
        document.getElementById('message').style.borderColor = '#e0e0e0';
    }
    
    if (errors.length > 0) {
        showFeedback('❌ ' + errors.join('. '), 'error');
        return false;
    }
    
    return true;
}

function showRateLimitWarning() {
    const result = rateLimiter.canSend();
    const remaining = result.remaining;
    const cooldownLeft = result.cooldownLeft;
    
    if (remaining <= 0) {
        showFeedback('📊 You have reached the limit of 3 messages per hour. Please try again later.', 'error');
    } else if (cooldownLeft > 0) {
        const seconds = Math.ceil(cooldownLeft / 1000);
        showFeedback('⏳ Please wait ' + seconds + ' seconds before sending another message.', 'warning');
    }
}

// ==================== UI FEEDBACK ====================

function showFeedback(message, type) {
    const feedbackEl = document.getElementById('feedback');
    if (!feedbackEl) return;
    
    feedbackEl.textContent = message;
    feedbackEl.className = 'form-feedback ' + type;
    feedbackEl.style.display = 'block';
    
    setTimeout(function() {
        if (feedbackEl.textContent === message) {
            feedbackEl.style.display = 'none';
        }
    }, 5000);
}

// ==================== SECURITY FEATURES ====================

function addCSRFProtection() {
    const csrfToken = generateCSRFToken();
    
    const forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
        let existing = form.querySelector('input[name="csrf_token"]');
        if (!existing) {
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = 'csrf_token';
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
        }
    });
    
    sessionStorage.setItem('csrf_token', csrfToken);
}

function generateCSRFToken() {
    let random;
    if (window.crypto && window.crypto.randomUUID) {
        random = window.crypto.randomUUID();
    } else {
        random = Math.random().toString(36) + Date.now().toString(36);
    }
    return btoa(random).substring(0, 32);
}

// ==================== DEBUG ====================

if (FORM_CONFIG.ENABLE_DEBUG) {
    window.formDebug = {
        getRateLimit: function() { return rateLimiter.canSend(); },
        clearRateLimit: function() {
            localStorage.removeItem('form_rate_limit');
            location.reload();
        },
        getConfig: function() { return FORM_CONFIG; },
        testSession: async function() {
            const token = await getSessionToken();
            console.log('Session token:', token);
            return token;
        }
    };
    
    console.log('🐛 Debug mode enabled');
    console.log('🔒 Security: Session Token + Origin + Referer + Spam Detection');
    console.log('📊 Commands: formDebug.testSession()');
}