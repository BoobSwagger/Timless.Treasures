// auth.js - Compact Authentication with OTP
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// Auth Helpers
const getAuthToken = () => localStorage.getItem('authToken') || localStorage.getItem('access_token');
const storeAuthToken = (token) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('access_token', token);
};

function storeUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
    user.seller_id ? localStorage.setItem('seller_id', user.seller_id) : localStorage.removeItem('seller_id');
    user.customer_id ? localStorage.setItem('customer_id', user.customer_id) : localStorage.removeItem('customer_id');
}

const getUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

const getUserRole = () => getUser()?.role || 'customer';
const getSellerId = () => getUser()?.seller_id || localStorage.getItem('seller_id') || null;
const getCustomerId = () => getUser()?.customer_id || localStorage.getItem('customer_id') || null;
const isSeller = () => getUserRole().toLowerCase() === 'seller';
const isCustomer = () => getUserRole().toLowerCase() === 'customer';
const isAuthenticated = () => getAuthToken() !== null;

function clearAuth() {
    ['authToken', 'access_token', 'refresh_token', 'user', 'seller_id', 'customer_id', 'guestCart', 'guestWishlist']
        .forEach(key => localStorage.removeItem(key));
}

const getRoleBasedRedirectUrl = () => {
    const role = getUserRole().toLowerCase();
    if (role === 'seller') return '/seller/seller_dashboard.html';
    return '/customer/product_listing.html';
};

// API Request
async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = getAuthToken();
    const config = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    if (data) config.body = JSON.stringify(data);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        if (response.status === 401) {
            clearAuth();
            if (!['signin', 'signup', 'login'].some(p => window.location.pathname.includes(p))) {
                window.location.href = '/signin.html';
            }
            throw new Error('Session expired. Please sign in again.');
        }
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.detail || responseData.message || 'An error occurred');
        return responseData;
    } catch (error) {
        throw error;
    }
}

// OTP Modal
let otpCallback = null, resendTimer = null, resendCountdown = 60;

function createOTPModal() {
    if (document.getElementById('otp-modal')) return document.getElementById('otp-modal');

    const styles = `<style id="otp-modal-styles">
.otp-modal{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.otp-modal-overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);backdrop-filter:blur(5px)}
.otp-modal-content{position:relative;background:#fff;border-radius:20px;padding:40px;max-width:450px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:slideUp .3s}
@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.otp-modal-close{position:absolute;top:15px;right:15px;background:0 0;border:0;font-size:28px;color:#999;cursor:pointer;width:35px;height:35px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:all .2s}
.otp-modal-close:hover{background:#f0f0f0;color:#333}
.otp-modal-header{text-align:center;margin-bottom:30px}
.otp-modal-header i{font-size:48px;color:#4CAF50;margin-bottom:15px}
.otp-modal-header h2{font-family:'Playfair Display',serif;font-size:24px;margin-bottom:10px;color:#333}
.otp-modal-header p{color:#666;font-size:14px;line-height:1.6}
.otp-modal-header strong{color:#333;font-weight:600}
.otp-input-container{display:flex;gap:10px;justify-content:center;margin-bottom:20px}
.otp-input{width:50px;height:55px;text-align:center;font-size:24px;font-weight:700;border:2px solid #ddd;border-radius:10px;transition:all .2s;outline:0}
.otp-input:focus{border-color:#4CAF50;box-shadow:0 0 0 3px rgba(76,175,80,.1)}
.otp-input.error{border-color:#f44336;animation:shake .3s}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.otp-message{padding:12px;border-radius:8px;margin-bottom:15px;font-size:14px;text-align:center;display:none}
.otp-error{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.otp-success{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
.otp-verify-btn{width:100%;background:#000;color:#fff;border:0;padding:15px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;transition:all .3s;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:10px}
.otp-verify-btn:hover:not(:disabled){background:#333;transform:translateY(-2px);box-shadow:0 5px 15px rgba(0,0,0,.2)}
.otp-verify-btn:disabled{opacity:.6;cursor:not-allowed}
.otp-resend-container{text-align:center}
.otp-resend-container p{font-size:14px;color:#666;margin-bottom:10px}
.otp-resend-btn{background:0 0;border:0;color:#4CAF50;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;text-decoration:underline}
.otp-resend-btn:hover:not(:disabled){color:#45a049}
.otp-resend-btn:disabled{color:#999;cursor:not-allowed;text-decoration:none}
@media (max-width:500px){.otp-modal-content{padding:30px 20px}.otp-input{width:45px;height:50px;font-size:20px}.otp-input-container{gap:8px}}
</style>`;

    const html = `<div id="otp-modal" class="otp-modal" style="display:none">
<div class="otp-modal-overlay"></div>
<div class="otp-modal-content">
<button class="otp-modal-close" onclick="window.Auth.closeOTPModal()">&times;</button>
<div class="otp-modal-header">
<i class="fas fa-envelope-open-text"></i>
<h2>Verify Your Email</h2>
<p>We've sent a 6-digit code to <strong id="otp-email"></strong></p>
</div>
<div class="otp-input-container">
${[0,1,2,3,4,5].map(i => `<input type="text" maxlength="1" class="otp-input" data-index="${i}"/>`).join('')}
</div>
<div id="otp-error" class="otp-message otp-error"></div>
<div id="otp-success" class="otp-message otp-success"></div>
<button id="otp-verify-btn" class="otp-verify-btn">
<span class="btn-text">Verify Code</span>
<span class="btn-spinner" style="display:none"><i class="fas fa-spinner fa-spin"></i></span>
</button>
<div class="otp-resend-container">
<p id="otp-resend-text">Didn't receive the code?</p>
<button id="otp-resend-btn" class="otp-resend-btn" disabled>Resend Code (<span id="otp-countdown">60</span>s)</button>
</div>
</div>
</div>`;

    if (!document.getElementById('otp-modal-styles')) document.head.insertAdjacentHTML('beforeend', styles);
    document.body.insertAdjacentHTML('beforeend', html);
    initOTPInputs();
    return document.getElementById('otp-modal');
}

function initOTPInputs() {
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            if (!/^\d*$/.test(e.target.value)) { e.target.value = ''; return; }
            if (e.target.value.length === 1 && idx < inputs.length - 1) inputs[idx + 1].focus();
            if (Array.from(inputs).every(inp => inp.value.length === 1)) document.getElementById('otp-verify-btn').focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) inputs[idx - 1].focus();
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData.getData('text').trim();
            if (/^\d{6}$/.test(data)) {
                data.split('').forEach((char, i) => { if (inputs[i]) inputs[i].value = char; });
                inputs[5].focus();
            }
        });
    });
}

function showOTPModal(email, purpose = 'verification') {
    const modal = createOTPModal();
    document.getElementById('otp-email').textContent = email;
    modal.style.display = 'flex';
    document.querySelectorAll('.otp-input').forEach(input => { input.value = ''; input.classList.remove('error'); });
    hideOTPMsg();
    setTimeout(() => document.querySelector('.otp-input').focus(), 300);
    startResendCountdown();

    const verifyBtn = document.getElementById('otp-verify-btn');
    const newVerifyBtn = verifyBtn.cloneNode(true);
    verifyBtn.parentNode.replaceChild(newVerifyBtn, verifyBtn);
    newVerifyBtn.addEventListener('click', () => verifyOTP(email, purpose));

    const resendBtn = document.getElementById('otp-resend-btn');
    const newResendBtn = resendBtn.cloneNode(true);
    resendBtn.parentNode.replaceChild(newResendBtn, resendBtn);
    newResendBtn.addEventListener('click', () => resendOTP(email, purpose));

    return new Promise(resolve => { otpCallback = resolve; });
}

function closeOTPModal() {
    const modal = document.getElementById('otp-modal');
    if (modal) modal.style.display = 'none';
    if (resendTimer) clearInterval(resendTimer);
    if (otpCallback) { otpCallback({ success: false, cancelled: true }); otpCallback = null; }
}

const getOTPCode = () => Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');

function showOTPError(msg) {
    hideOTPMsg();
    const el = document.getElementById('otp-error');
    el.textContent = msg;
    el.style.display = 'block';
    document.querySelectorAll('.otp-input').forEach(i => { i.classList.add('error'); setTimeout(() => i.classList.remove('error'), 300); });
}

function showOTPSuccess(msg) {
    hideOTPMsg();
    const el = document.getElementById('otp-success');
    el.textContent = msg;
    el.style.display = 'block';
}

const hideOTPMsg = () => {
    document.getElementById('otp-error').style.display = 'none';
    document.getElementById('otp-success').style.display = 'none';
};

function setOTPLoading(loading) {
    const btn = document.getElementById('otp-verify-btn');
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    text.style.display = loading ? 'none' : 'inline';
    spinner.style.display = loading ? 'inline' : 'none';
}

function startResendCountdown() {
    const btn = document.getElementById('otp-resend-btn');
    const countdown = document.getElementById('otp-countdown');
    resendCountdown = 60;
    btn.disabled = true;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        resendCountdown--;
        countdown.textContent = resendCountdown;
        if (resendCountdown <= 0) {
            clearInterval(resendTimer);
            btn.disabled = false;
            btn.innerHTML = 'Resend Code';
        }
    }, 1000);
}

// OTP API
async function sendOTP(email, purpose = 'verification') {
    try {
        const res = await apiRequest('/otp/send', 'POST', { email, purpose });
        return { success: true, data: res };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function verifyOTP(email, purpose) {
    const code = getOTPCode();
    if (code.length !== 6) { showOTPError('Please enter all 6 digits'); return; }
    setOTPLoading(true);
    hideOTPMsg();
    try {
        const res = await apiRequest('/otp/verify', 'POST', { email, otp: code, purpose });
        if (res.success) {
            showOTPSuccess('✓ Email verified successfully!');
            setTimeout(() => {
                const modal = document.getElementById('otp-modal');
                if (modal) modal.style.display = 'none';
                if (resendTimer) clearInterval(resendTimer);
                if (otpCallback) { 
                    otpCallback({ success: true, data: res }); 
                    otpCallback = null; 
                }
            }, 1500);
        } else {
            showOTPError(res.message || 'Invalid OTP code');
            setOTPLoading(false);
        }
    } catch (error) {
        showOTPError(error.message || 'Verification failed');
        setOTPLoading(false);
    }
}

async function resendOTP(email, purpose) {
    const btn = document.getElementById('otp-resend-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    const res = await sendOTP(email, purpose);
    if (res.success) {
        showOTPSuccess('New code sent to your email!');
        startResendCountdown();
        document.querySelectorAll('.otp-input').forEach(i => i.value = '');
        document.querySelector('.otp-input').focus();
    } else {
        showOTPError(res.message || 'Failed to resend code');
        btn.disabled = false;
        btn.innerHTML = 'Resend Code';
    }
}

// Auth Functions
async function signUp(username, email, password, fullName = null, role = 'customer') {
    try {
        const data = await apiRequest('/auth/register', 'POST', { username, email, password, full_name: fullName, role });
        const otpRes = await sendOTP(email, 'verification');
        if (!otpRes.success) return { success: false, message: 'Account created but failed to send verification email. Please try logging in.' };
        
        const verifyRes = await showOTPModal(email, 'verification');
        if (!verifyRes.success) return { success: false, message: verifyRes.cancelled ? 'Email verification cancelled' : 'Email verification failed' };

        storeAuthToken(data.access_token);
        const userData = { ...data.user, role: data.user.role || role, email_verified: true };
        storeUser(userData);
        if (window.RolexStore) window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userData }));

        return { success: true, user: userData, message: 'Account created and verified successfully!', redirectUrl: getRoleBasedRedirectUrl() };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function signIn(username, password) {
    try {
        const data = await apiRequest('/auth/login', 'POST', { username, password });
        const otpRes = await sendOTP(data.user.email, 'login');
        if (!otpRes.success) return { success: false, message: 'Login successful but failed to send verification code' };

        const verifyRes = await showOTPModal(data.user.email, 'login');
        if (!verifyRes.success) return { success: false, message: verifyRes.cancelled ? 'Login verification cancelled' : 'Login verification failed' };

        storeAuthToken(data.access_token);
        const userData = { ...data.user, role: data.user.role || 'customer' };
        storeUser(userData);
        if (window.RolexStore) window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userData }));

        return { success: true, user: userData, message: 'Signed in successfully!', redirectUrl: getRoleBasedRedirectUrl() };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

function signOut() {
    clearAuth();
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
    window.location.href = '/';
}

async function getCurrentUser() {
    try {
        const data = await apiRequest('/auth/me', 'GET');
        const userData = { ...data, role: data.role || 'customer' };
        storeUser(userData);
        return userData;
    } catch (error) {
        clearAuth();
        throw error;
    }
}

// Page Protection
function requireAuth() {
    if (!isAuthenticated()) { window.location.href = '/signin.html'; return false; }
    return true;
}

function requireSeller() {
    if (!requireAuth()) return false;
    if (!isSeller()) { alert('Access denied. Seller account required.'); window.location.href = '/'; return false; }
    return true;
}

function requireCustomer() {
    if (!requireAuth()) return false;
    if (!isCustomer()) { window.location.href = '/seller-dashboard.html'; return false; }
    return true;
}

function redirectIfAuthenticated() {
    if (isAuthenticated()) { window.location.href = getRoleBasedRedirectUrl(); return true; }
    return false;
}

// UI Helpers
function showError(msg, elId = 'error-message') {
    const el = document.getElementById(elId);
    if (el) {
        el.textContent = msg;
        el.style.cssText = 'display:block;background:#dc3545;color:#fff;padding:12px 20px;border-radius:5px;margin-bottom:15px;text-align:center';
        setTimeout(() => el.style.display = 'none', 5000);
    } else alert('Error: ' + msg);
}

function showSuccess(msg, elId = 'success-message') {
    const el = document.getElementById(elId);
    if (el) {
        el.textContent = msg;
        el.style.cssText = 'display:block;background:#28a745;color:#fff;padding:12px 20px;border-radius:5px;margin-bottom:15px;text-align:center';
        setTimeout(() => el.style.display = 'none', 3000);
    }
}

function setButtonLoading(btnId, loading = true) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Please wait...';
        btn.disabled = true;
        btn.style.cssText = 'opacity:0.7;cursor:not-allowed';
    } else {
        btn.textContent = btn.dataset.originalText || btn.textContent;
        btn.disabled = false;
        btn.style.cssText = 'opacity:1;cursor:pointer';
    }
}

// Form Handlers
async function handleSignIn(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.querySelector('input[name="username"]').value.trim();
    const password = form.querySelector('input[name="password"]').value;
    const btn = form.querySelector('button[type="submit"]');
    
    if (!username || !password) { showError('Please fill in all fields'); return; }
    setButtonLoading(btn.id, true);
    const res = await signIn(username, password);
    setButtonLoading(btn.id, false);
    
    if (res.success) {
        showSuccess(res.message);
        setTimeout(() => window.location.href = res.redirectUrl, 1000);
    } else showError(res.message);
}

async function handleSignUp(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.querySelector('input[name="username"]').value.trim();
    const email = form.querySelector('input[name="email"]').value.trim();
    const password = form.querySelector('input[name="password"]').value;
    const confirmPassword = form.querySelector('input[name="confirm-password"]')?.value;
    const fullName = form.querySelector('input[name="full-name"]')?.value.trim();
    const roleRadio = form.querySelector('input[name="role"]:checked');
    const roleSelect = form.querySelector('select[name="role"]');
    const role = roleRadio?.value || roleSelect?.value || 'customer';
    const btn = form.querySelector('button[type="submit"]');
    
    if (!username || !email || !password) { showError('Please fill in all required fields'); return; }
    if (confirmPassword && password !== confirmPassword) { showError('Passwords do not match'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters long'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Please enter a valid email address'); return; }
    
    setButtonLoading(btn.id, true);
    const res = await signUp(username, email, password, fullName, role);
    setButtonLoading(btn.id, false);
    
    if (res.success) {
        showSuccess(res.message);
        setTimeout(() => window.location.href = res.redirectUrl, 1000);
    } else showError(res.message);
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = ['signin', 'login', 'signup'].some(p => window.location.pathname.includes(p));
    if (isLoginPage) redirectIfAuthenticated();
    
    const signInForm = document.querySelector('form[data-form="signin"]') || document.querySelector('#signin-form') || document.querySelector('#signinForm');
    if (signInForm) signInForm.addEventListener('submit', handleSignIn);
    
    const signUpForm = document.querySelector('form[data-form="signup"]') || document.querySelector('#signup-form') || document.querySelector('#signupForm');
    if (signUpForm) signUpForm.addEventListener('submit', handleSignUp);
    
    document.querySelectorAll('[data-action="signout"], .sign-out-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); if (confirm('Are you sure you want to sign out?')) signOut(); });
    });
});

// Export
window.Auth = {
    signUp, signIn, signOut, getCurrentUser, isAuthenticated, getUser, getUserRole,
    getSellerId, getCustomerId, isSeller, isCustomer, requireAuth, requireSeller,
    requireCustomer, redirectIfAuthenticated, showError, showSuccess, clearAuth,
    getRoleBasedRedirectUrl, sendOTP, showOTPModal, closeOTPModal, resendOTP
};