// ==================== CONFIGURATION ====================
const FORM_CONFIG = {
    // *** IMPORTANT: แก้ไข URL นี้หลังจาก Deploy Google Apps Script ***
    API_URL: "https://script.google.com/macros/s/AKfycbzYCnxhb2kDWDsCV0yQuZtk25Q8hJY8g2DRlF85CP81jK0qVV_vv-3L0rKVBJcCg9T5yw/exec",
    
    MAX_SENDS_PER_HOUR: 3,
    COOLDOWN_MS: 60000, // 60 seconds between sends
    FORM_TIMEOUT_MS: 30000,
    ENABLE_DEBUG: false
};

let AUTH_TOKEN = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeToken();
    initializeForm();
    initializeRateLimiter();
    initializeMobileMenu();
    initializeSmoothScroll();
    addCSRFProtection();
    
    if (FORM_CONFIG.ENABLE_DEBUG) {
        console.log('Form initialized successfully');
    }
});

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
        
        // Close menu when clicking links
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
    
    // Active nav highlight on scroll
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

// ==================== TOKEN MANAGEMENT ====================

async function initializeToken() {
    AUTH_TOKEN = await getSecureToken();
    
    if (!AUTH_TOKEN) {
        // First time setup - prompt for token
        // คุณจะได้ token นี้จาก Google Apps Script console หลังจาก deploy
        AUTH_TOKEN = prompt('🔐 Enter your authentication token (ได้รับจาก Admin):');
        if (AUTH_TOKEN && AUTH_TOKEN.length > 0) {
            await storeSecureToken(AUTH_TOKEN);
            showFeedback('✅ Token saved successfully!', 'success');
        } else {
            console.warn('No token provided, form will not work');
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⚠️ Not Configured';
            }
        }
    }
}

async function getSecureToken() {
    try {
        // Try sessionStorage first (cleared when browser closes)
        let token = sessionStorage.getItem('form_auth_token');
        if (token) return token;
        
        // Try encrypted localStorage as backup
        token = localStorage.getItem('form_auth_token_encrypted');
        if (token) {
            return await decryptToken(token);
        }
        
        return null;
    } catch (error) {
        console.error('Token retrieval error:', error);
        return null;
    }
}

async function storeSecureToken(token) {
    try {
        sessionStorage.setItem('form_auth_token', token);
        const encrypted = await encryptToken(token);
        localStorage.setItem('form_auth_token_encrypted', encrypted);
    } catch (error) {
        console.error('Token storage error:', error);
    }
}

async function encryptToken(token) {
    const salt = btoa((navigator.userAgent || '') + (window.location.hostname || ''));
    let encrypted = '';
    for (let i = 0; i < token.length; i++) {
        encrypted += String.fromCharCode(token.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    return btoa(encrypted);
}

async function decryptToken(encryptedToken) {
    try {
        const decoded = atob(encryptedToken);
        const salt = btoa((navigator.userAgent || '') + (window.location.hostname || ''));
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
        }
        return decrypted;
    } catch (error) {
        console.error('Token decryption error:', error);
        return null;
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
    
    // Remove HTML tags
    value = value.replace(/<[^>]*>/g, '');
    // Remove javascript: protocol
    value = value.replace(/javascript:/gi, '');
    // Remove event handlers
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
    let message = '';
    
    switch (id) {
        case 'name':
            if (value.length < 2) {
                isValid = false;
                message = 'Name must be at least 2 characters';
            } else if (value.length > 50) {
                isValid = false;
                message = 'Name is too long (max 50 characters)';
            }
            break;
            
        case 'email':
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                message = 'Please enter a valid email address';
            }
            break;
            
        case 'message':
            if (value.length < 10) {
                isValid = false;
                message = 'Message must be at least 10 characters';
            } else if (value.length > 500) {
                isValid = false;
                message = 'Message is too long (max 500 characters)';
            }
            break;
    }
    
    // Update visual feedback
    const feedbackEl = document.getElementById('feedback');
    if (!isValid && message) {
        // Don't show every validation error in main feedback, just return
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
    
    // Update UI every second for cooldown timer
    setInterval(function() {
        updateRateUI();
    }, 1000);
}

function updateRateUI() {
    const result = rateLimiter.canSend();
    const remaining = result.remaining;
    const cooldownLeft = result.cooldownLeft;
    const used = FORM_CONFIG.MAX_SENDS_PER_HOUR - remaining;
    
    // Update dots
    for (let i = 0; i < 3; i++) {
        const dot = document.getElementById('dot-' + i);
        if (dot) {
            dot.className = 'rate-dot ' + (i < used ? 'used' : 'available');
        }
    }
    
    // Update label
    const rateLabel = document.getElementById('rate-label');
    if (rateLabel) {
        rateLabel.textContent = 'Remaining: ' + remaining + ' / ' + FORM_CONFIG.MAX_SENDS_PER_HOUR;
    }
    
    // Update button
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
    
    // Update cooldown message
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
    
    if (!AUTH_TOKEN) {
        showFeedback('❌ System not configured. Please contact admin.', 'error');
        return;
    }
    
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    
    const name = sanitizeString(nameInput.value);
    const email = sanitizeString(emailInput.value);
    const message = sanitizeString(messageInput.value);
    
    // Validate fields
    if (!validateAllFields({ name, email, message })) {
        return;
    }
    
    const data = {
        name: name,
        email: email,
        message: message,
        token: AUTH_TOKEN,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || window.location.href,
        sendNotification: true
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
            // Record successful send
            rateLimiter.recordSend();
            updateRateUI();
            
            // Show success message
            showFeedback('✅ Message sent successfully!', 'success');
            
            // Reset form
            nameInput.value = '';
            emailInput.value = '';
            messageInput.value = '';
            
            // Reset border colors
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
            updateRateUI(); // Refresh rate limit display
        } else if (error.message.includes('401') || error.message.includes('auth')) {
            showFeedback('🔐 Authentication failed. Token may be expired.', 'error');
            // Clear invalid token
            localStorage.removeItem('form_auth_token_encrypted');
            sessionStorage.removeItem('form_auth_token');
            AUTH_TOKEN = null;
            initializeToken();
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
    
    // Auto-hide after 5 seconds
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
        // Check if CSRF input already exists
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

// ==================== ANALYTICS & TRACKING ====================

function trackConversion() {
    // Optional: Add your analytics tracking here
    if (typeof gtag !== 'undefined') {
        gtag('event', 'generate_lead', {
            'event_category': 'form',
            'event_label': 'contact_submission'
        });
    }
    
    if (FORM_CONFIG.ENABLE_DEBUG) {
        console.log('Form submission tracked');
    }
}

// ==================== EXPORT FOR DEBUGGING ====================

if (FORM_CONFIG.ENABLE_DEBUG) {
    window.formDebug = {
        getRateLimit: function() { return rateLimiter.canSend(); },
        clearRateLimit: function() {
            localStorage.removeItem('form_rate_limit');
            location.reload();
        },
        clearToken: function() {
            localStorage.removeItem('form_auth_token_encrypted');
            sessionStorage.removeItem('form_auth_token');
            AUTH_TOKEN = null;
            console.log('Token cleared');
        },
        getToken: function() { return AUTH_TOKEN; },
        getConfig: function() { return FORM_CONFIG; }
    };
    
    console.log('🐛 Debug mode enabled. Use window.formDebug to access utilities');
    console.log('Commands: formDebug.getRateLimit(), formDebug.clearRateLimit(), formDebug.clearToken()');
}