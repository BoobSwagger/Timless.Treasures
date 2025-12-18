// =====================================================
// auth.js - UNIFIED Authentication System with Role-Based Routing
// =====================================================

// Configuration
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// =====================================================
// Helper Functions
// =====================================================

// Get auth token (check both possible keys for compatibility)
function getAuthToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('access_token');
}

// Store auth token (use consistent key)
function storeAuthToken(token) {
    localStorage.setItem('authToken', token);
    // Also store in old key for backwards compatibility
    localStorage.setItem('access_token', token);
}

// Store user data
function storeUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
    
    // Store seller_id or customer_id separately for easy access
    if (user.seller_id) {
        localStorage.setItem('seller_id', user.seller_id);
    } else {
        localStorage.removeItem('seller_id');
    }
    
    if (user.customer_id) {
        localStorage.setItem('customer_id', user.customer_id);
    } else {
        localStorage.removeItem('customer_id');
    }
}

// Get stored user
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Get user role
function getUserRole() {
    const user = getUser();
    return user?.role || 'customer'; // Default to customer if no role
}

// Get seller ID
function getSellerId() {
    const user = getUser();
    return user?.seller_id || localStorage.getItem('seller_id') || null;
}

// Get customer ID
function getCustomerId() {
    const user = getUser();
    return user?.customer_id || localStorage.getItem('customer_id') || null;
}

// Check if user is seller
function isSeller() {
    return getUserRole().toLowerCase() === 'seller';
}

// Check if user is customer
function isCustomer() {
    return getUserRole().toLowerCase() === 'customer';
}

// Clear all auth data
function clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('seller_id');
    localStorage.removeItem('customer_id');
    localStorage.removeItem('guestCart');
    localStorage.removeItem('guestWishlist');
}

// Check if user is authenticated
function isAuthenticated() {
    const token = getAuthToken();
    console.log('Checking authentication:', token ? 'Authenticated' : 'Not authenticated');
    return token !== null;
}

// Get redirect URL based on user role
function getRoleBasedRedirectUrl() {
    const role = getUserRole();
    console.log('Getting redirect URL for role:', role);
    
    if (role.toLowerCase() === 'seller') {
        return '/seller-dashboard.html'; // Update this to your seller dashboard path
    } else {
        return '/'; // Customer goes to home/shop page
    }
}

// =====================================================
// API Request Helper
// =====================================================
async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = getAuthToken();
    
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        config.body = JSON.stringify(data);
    }

    console.log(`API Request: ${method} ${API_BASE_URL}${endpoint}`);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        console.log(`API Response: ${response.status} ${response.statusText}`);
        
        // Handle unauthorized
        if (response.status === 401) {
            console.error('Unauthorized - clearing auth');
            clearAuth();
            // Don't redirect immediately if on sign-in page
            if (!window.location.pathname.includes('signin') && 
                !window.location.pathname.includes('signup') &&
                !window.location.pathname.includes('login')) {
                window.location.href = '/signin.html';
            }
            throw new Error('Session expired. Please sign in again.');
        }

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.detail || responseData.message || 'An error occurred');
        }

        return responseData;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// =====================================================
// Authentication Functions
// =====================================================

// Register new account
async function signUp(username, email, password, fullName = null, role = 'customer') {
    try {
        console.log('Attempting sign up:', username, 'as', role);
        
        const data = await apiRequest('/auth/register', 'POST', {
            username: username,
            email: email,
            password: password,
            full_name: fullName,
            role: role // Include role in registration
        });

        console.log('Sign up successful:', data);

        // Store tokens and user data
        storeAuthToken(data.access_token);
        
        // Ensure user object has role
        const userData = {
            ...data.user,
            role: data.user.role || role // Use returned role or fallback to requested role
        };
        storeUser(userData);

        // Notify dashboard.js of login
        if (window.RolexStore) {
            window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userData }));
        }

        return {
            success: true,
            user: userData,
            message: 'Account created successfully!',
            redirectUrl: getRoleBasedRedirectUrl()
        };
    } catch (error) {
        console.error('Sign up error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Sign in existing user
async function signIn(username, password) {
    try {
        console.log('Attempting sign in:', username);
        
        const data = await apiRequest('/auth/login', 'POST', {
            username: username,
            password: password
        });

        console.log('Sign in successful:', data);

        // Store tokens and user data
        storeAuthToken(data.access_token);
        
        // Ensure user object has role
        const userData = {
            ...data.user,
            role: data.user.role || 'customer' // Default to customer if no role
        };
        storeUser(userData);

        // Notify dashboard.js of login
        if (window.RolexStore) {
            window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userData }));
        }

        return {
            success: true,
            user: userData,
            message: 'Signed in successfully!',
            redirectUrl: getRoleBasedRedirectUrl()
        };
    } catch (error) {
        console.error('Sign in error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Sign out user
function signOut() {
    console.log('Signing out...');
    clearAuth();
    
    // Notify dashboard.js of logout
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
    
    // Redirect to home page instead of sign-in to avoid loop
    window.location.href = '/';
}

// Get current user from API
async function getCurrentUser() {
    try {
        const data = await apiRequest('/auth/me', 'GET');
        console.log('Current user:', data);
        
        // Ensure user has role
        const userData = {
            ...data,
            role: data.role || 'customer'
        };
        storeUser(userData);
        return userData;
    } catch (error) {
        console.error('Get current user error:', error);
        clearAuth();
        throw error;
    }
}

// =====================================================
// Page Protection
// =====================================================

// Protect page - redirect if not authenticated
function requireAuth() {
    console.log('Checking auth requirement...');
    if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to sign in');
        window.location.href = '/signin.html';
        return false;
    }
    console.log('User is authenticated');
    return true;
}

// Require seller role
function requireSeller() {
    if (!requireAuth()) return false;
    
    if (!isSeller()) {
        console.log('User is not a seller, redirecting to home');
        alert('Access denied. Seller account required.');
        window.location.href = '/';
        return false;
    }
    return true;
}

// Require customer role
function requireCustomer() {
    if (!requireAuth()) return false;
    
    if (!isCustomer()) {
        console.log('User is not a customer, redirecting to seller dashboard');
        window.location.href = '/seller-dashboard.html';
        return false;
    }
    return true;
}

// Redirect to dashboard if already authenticated (for login/signup pages)
function redirectIfAuthenticated() {
    console.log('Checking if already authenticated...');
    if (isAuthenticated()) {
        console.log('User already authenticated, redirecting based on role');
        const redirectUrl = getRoleBasedRedirectUrl();
        window.location.href = redirectUrl;
        return true;
    }
    return false;
}

// =====================================================
// UI Helper Functions
// =====================================================

// Show error message
function showError(message, elementId = 'error-message') {
    console.error('Error:', message);
    
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.cssText = `
            display: block;
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            margin-bottom: 15px;
            text-align: center;
        `;
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        // Fallback to alert if element not found
        alert('Error: ' + message);
    }
}

// Show success message
function showSuccess(message, elementId = 'success-message') {
    console.log('Success:', message);
    
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        successElement.style.cssText = `
            display: block;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            margin-bottom: 15px;
            text-align: center;
        `;
        
        // Hide success after 3 seconds
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    }
}

// Show loading state on button
function setButtonLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Please wait...';
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
    }
}

// =====================================================
// Form Handlers
// =====================================================

// Handle sign in form submission
async function handleSignInSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const username = form.querySelector('input[name="username"]').value.trim();
    const password = form.querySelector('input[name="password"]').value;
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (!username || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    setButtonLoading(submitButton.id, true);
    
    const result = await signIn(username, password);
    
    setButtonLoading(submitButton.id, false);
    
    if (result.success) {
        showSuccess(result.message);
        console.log('Redirecting to:', result.redirectUrl);
        // Wait a moment then redirect based on role
        setTimeout(() => {
            window.location.href = result.redirectUrl;
        }, 1000);
    } else {
        showError(result.message);
    }
}

// Handle sign up form submission
async function handleSignUpSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const username = form.querySelector('input[name="username"]').value.trim();
    const email = form.querySelector('input[name="email"]').value.trim();
    const password = form.querySelector('input[name="password"]').value;
    const confirmPassword = form.querySelector('input[name="confirm-password"]')?.value;
    const fullName = form.querySelector('input[name="full-name"]')?.value.trim();
    const role = form.querySelector('select[name="role"]')?.value || 'customer';
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Validation
    if (!username || !email || !password) {
        showError('Please fill in all required fields');
        return;
    }
    
    if (confirmPassword && password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    setButtonLoading(submitButton.id, true);
    
    const result = await signUp(username, email, password, fullName, role);
    
    setButtonLoading(submitButton.id, false);
    
    if (result.success) {
        showSuccess(result.message);
        console.log('Redirecting to:', result.redirectUrl);
        // Wait a moment then redirect based on role
        setTimeout(() => {
            window.location.href = result.redirectUrl;
        }, 1000);
    } else {
        showError(result.message);
    }
}

// =====================================================
// Auto-initialize
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Auth.js Initialized ===');
    console.log('Is authenticated:', isAuthenticated());
    console.log('Current user:', getUser());
    console.log('User role:', getUserRole());
    
    // Redirect if already authenticated on login/signup pages
    const isLoginPage = window.location.pathname.includes('signin') || 
                        window.location.pathname.includes('login') ||
                        window.location.pathname.includes('signup');
    
    if (isLoginPage) {
        console.log('On login/signup page');
        redirectIfAuthenticated();
    }
    
    // Attach form handlers
    const signInForm = document.querySelector('form[data-form="signin"]') || 
                       document.querySelector('#signin-form') ||
                       document.querySelector('#signinForm');
    if (signInForm) {
        console.log('Sign in form found, attaching handler');
        signInForm.addEventListener('submit', handleSignInSubmit);
    }
    
    const signUpForm = document.querySelector('form[data-form="signup"]') || 
                       document.querySelector('#signup-form') ||
                       document.querySelector('#signupForm');
    if (signUpForm) {
        console.log('Sign up form found, attaching handler');
        signUpForm.addEventListener('submit', handleSignUpSubmit);
    }
    
    // Attach sign out buttons
    const signOutButtons = document.querySelectorAll('[data-action="signout"], .sign-out-btn');
    signOutButtons.forEach(button => {
        console.log('Sign out button found, attaching handler');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to sign out?')) {
                signOut();
            }
        });
    });
});

// =====================================================
// Export for global use
// =====================================================
window.Auth = {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isAuthenticated,
    getUser,
    getUserRole,
    getSellerId,
    getCustomerId,
    isSeller,
    isCustomer,
    requireAuth,
    requireSeller,
    requireCustomer,
    redirectIfAuthenticated,
    showError,
    showSuccess,
    clearAuth,
    getRoleBasedRedirectUrl
};

console.log('=== Auth exported to window ===');