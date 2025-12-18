// API Configuration - FIXED: Added /api prefix
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// Authentication Helper - FIXED: Check both token keys
function getAuthToken() {
    // Check both possible token storage keys
    const token = localStorage.getItem('authToken') || localStorage.getItem('access_token');
    console.log('Getting auth token:', token ? 'Found' : 'Not found');
    return token;
}

function isAuthenticated() {
    const authenticated = !!getAuthToken();
    console.log('Is authenticated:', authenticated);
    return authenticated;
}

function redirectToLogin() {
    console.log('Redirecting to login...');
    window.location.href = '/login.html';
}

// API Request Helper
async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
    };

    console.log(`API Request: ${options.method || 'GET'} ${API_BASE_URL}${endpoint}`);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        console.log(`API Response: ${response.status} ${response.statusText}`);
        
        // Handle unauthorized
        if (response.status === 401) {
            console.error('Unauthorized - clearing tokens');
            localStorage.removeItem('access_token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('refresh_token');
            redirectToLogin();
            return null;
        }

        if (!response.ok) {
            const error = await response.json();
            console.error('API Error:', error);
            throw new Error(error.detail || 'Request failed');
        }

        const data = await response.json();
        console.log('API Response data:', data);
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Cart State
let cartData = {
    items: [],
    total: 0,
    item_count: 0
};

// Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0
    }).format(amount);
}

// Load Cart from API
async function loadCart() {
    console.log('=== Loading Cart ===');
    
    if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to login');
        redirectToLogin();
        return;
    }

    try {
        showLoading();
        console.log('Fetching cart data...');
        const data = await apiRequest('/cart');
        
        if (!data) {
            console.error('No cart data received');
            return;
        }
        
        console.log('Cart data received:', data);
        
        // Handle the response format from your API
        cartData = {
            items: data.items || [],
            total: data.total || 0,
            item_count: data.item_count || 0
        };
        
        console.log('Cart state updated:', cartData);
        
        renderCart();
        updateCartCount();
    } catch (error) {
        console.error('Error loading cart:', error);
        showError('Failed to load cart. Please try again.');
    } finally {
        hideLoading();
    }
}

// Render Cart Items
function renderCart() {
    console.log('Rendering cart with', cartData.items.length, 'items');
    const cartItemsContainer = document.querySelector('.cart-items');
    
    // Only render if we're on the cart page
    if (!cartItemsContainer) {
        console.log('Not on cart page, skipping render');
        return;
    }
    
    if (!cartData.items || cartData.items.length === 0) {
        console.log('Cart is empty, showing empty state');
        cartItemsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 4rem; color: #ddd; margin-bottom: 20px;"></i>
                <h3 style="font-family: 'Playfair Display', serif; margin-bottom: 10px;">Your cart is empty</h3>
                <p style="color: #888; margin-bottom: 20px;">Add some luxury timepieces to get started</p>
                <a href="/" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; border-radius: 25px; text-decoration: none;">
                    Continue Shopping
                </a>
            </div>
        `;
        updateOrderSummary();
        return;
    }

    console.log('Rendering', cartData.items.length, 'cart items');
    cartItemsContainer.innerHTML = cartData.items.map(item => {
        const subtotal = item.product.price * item.quantity;
        return `
            <div class="cart-item" data-cart-item-id="${item.id}">
                <div class="item-image">
                    <img src="${item.product.image_url || 'https://via.placeholder.com/100'}" 
                         alt="${item.product.name}"
                         onerror="this.src='https://via.placeholder.com/100'">
                </div>
                <div class="item-details">
                    <div class="item-name">${item.product.name}</div>
                    <div class="item-meta">Reference: ${item.product.reference_number || 'N/A'}</div>
                    <div class="item-meta">Material: ${item.product.material || 'N/A'}</div>
                    <div class="item-meta">Size: ${item.product.case_size || 'N/A'}</div>
                    <div class="item-price">${formatCurrency(subtotal)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="removeFromCart(${item.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <div class="qty-selector">
                        <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateOrderSummary();
}

// Update Order Summary
function updateOrderSummary() {
    // Only update if summary elements exist (cart page)
    const summaryElements = document.querySelectorAll('.summary-row');
    if (!summaryElements || summaryElements.length === 0) {
        console.log('No summary elements found, skipping update');
        return;
    }
    
    const subtotal = cartData.total || 0;
    const discount = subtotal * 0.05; // 5% discount
    const deliveryFee = 0; // Free delivery
    const total = subtotal - discount + deliveryFee;

    console.log('Updating order summary:', { subtotal, discount, deliveryFee, total });

    const subtotalEl = document.querySelector('.summary-row:nth-child(1) span:last-child');
    const discountEl = document.querySelector('.summary-row.discount span:last-child');
    const deliveryEl = document.querySelector('.summary-row:nth-child(3) span:last-child');
    const totalEl = document.querySelector('.summary-row.total span:last-child');
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (discountEl) discountEl.textContent = `- ${formatCurrency(discount)}`;
    if (deliveryEl) deliveryEl.textContent = deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee);
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

// Update Cart Count in Header
function updateCartCount() {
    console.log('Updating cart count badge:', cartData.item_count);
    const cartIcons = document.querySelectorAll('.fa-shopping-cart');
    cartIcons.forEach(icon => {
        // Remove existing badge
        const existingBadge = icon.parentElement.querySelector('.cart-count');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add new badge if items exist
        if (cartData.item_count > 0) {
            const badge = document.createElement('span');
            badge.className = 'cart-count';
            badge.textContent = cartData.item_count;
            badge.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: #d9534f;
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                font-weight: bold;
            `;
            icon.parentElement.style.position = 'relative';
            icon.parentElement.appendChild(badge);
            console.log('Cart badge added');
        }
    });
}

// Update Quantity
async function updateQuantity(cartItemId, newQuantity) {
    console.log(`Updating quantity: cartItemId=${cartItemId}, newQuantity=${newQuantity}`);
    
    if (newQuantity < 1) {
        if (confirm('Remove this item from cart?')) {
            await removeFromCart(cartItemId);
        }
        return;
    }

    if (newQuantity > 10) {
        alert('Maximum quantity is 10 items per product');
        return;
    }

    try {
        showLoading();
        await apiRequest(`/cart/${cartItemId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: newQuantity })
        });
        
        // Reload cart after update
        await loadCart();
        showSuccess('Cart updated successfully');
    } catch (error) {
        console.error('Error updating quantity:', error);
        showError('Failed to update quantity');
    } finally {
        hideLoading();
    }
}

// Remove from Cart
async function removeFromCart(cartItemId) {
    console.log(`Removing from cart: cartItemId=${cartItemId}`);
    
    try {
        showLoading();
        await apiRequest(`/cart/${cartItemId}`, {
            method: 'DELETE'
        });
        
        // Reload cart after removal
        await loadCart();
        showSuccess('Item removed from cart');
    } catch (error) {
        console.error('Error removing item:', error);
        showError('Failed to remove item');
    } finally {
        hideLoading();
    }
}

// Clear Cart
async function clearCart() {
    if (!confirm('Are you sure you want to clear your entire cart?')) {
        return;
    }

    console.log('Clearing cart...');

    try {
        showLoading();
        await apiRequest('/cart', {
            method: 'DELETE'
        });
        
        // Reload cart after clearing
        await loadCart();
        showSuccess('Cart cleared successfully');
    } catch (error) {
        console.error('Error clearing cart:', error);
        showError('Failed to clear cart');
    } finally {
        hideLoading();
    }
}

// Apply Promo Code
async function applyPromoCode() {
    const promoInput = document.querySelector('.promo-code input');
    if (!promoInput) return;
    
    const promoCode = promoInput.value.trim();

    if (!promoCode) {
        alert('Please enter a promo code');
        return;
    }

    // This is a placeholder - implement actual promo code logic in backend
    alert('Promo code functionality coming soon!');
}

// Checkout
function goToCheckout() {
    if (!cartData.items || cartData.items.length === 0) {
        alert('Your cart is empty');
        return;
    }

    // Store cart data for checkout page
    localStorage.setItem('checkout_data', JSON.stringify(cartData));
    window.location.href = '../transactions/checkout.html';
}

// UI Helper Functions
function showLoading() {
    // Remove existing loader
    const existingLoader = document.getElementById('loader');
    if (existingLoader) existingLoader.remove();
    
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.innerHTML = '<div class="spinner"></div>';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    
    const spinner = loader.querySelector('.spinner');
    spinner.style.cssText = `
        border: 4px solid #f3f3f3;
        border-top: 4px solid #333;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
    `;
    
    // Add animation if not exists
    if (!document.querySelector('#spinner-animation')) {
        const style = document.createElement('style');
        style.id = 'spinner-animation';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.remove();
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Check if we're on the cart page
function isCartPage() {
    return window.location.pathname.includes('cart.html') || 
           document.querySelector('.cart-items') !== null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Cart.js Initialized ===');
    console.log('Current URL:', window.location.href);
    console.log('Is cart page:', isCartPage());
    
    // Only load cart if we're on the cart page
    if (isCartPage()) {
        console.log('On cart page, loading cart data...');
        loadCart();

        // Checkout button
        const checkoutBtn = document.querySelector('.btn-checkout');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', goToCheckout);
        }

        // Apply promo code button
        const applyBtn = document.querySelector('.btn-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyPromoCode);
        }
    } else {
        console.log('Not on cart page, skipping cart load');
    }

    // Cart icon in header - redirect to cart page
    const cartIcons = document.querySelectorAll('.fa-shopping-cart');
    cartIcons.forEach(icon => {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/cart.html';
        });
    });

    // User icon - redirect to profile or login
    const userIcons = document.querySelectorAll('.fa-user');
    userIcons.forEach(icon => {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', () => {
            if (isAuthenticated()) {
                window.location.href = '/profile.html';
            } else {
                redirectToLogin();
            }
        });
    });
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('=== Cart.js Loaded ===');
