// =====================================================
// Configuration
// =====================================================
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// FIXED: Get auth token from correct storage keys
function getAuthToken() {
    return localStorage.getItem('authToken') || 
           localStorage.getItem('access_token') || 
           localStorage.getItem('token') || 
           null;
}

let authToken = getAuthToken();
let currentUser = null;
let cart = { items: [], total: 0, item_count: 0 };
let wishlist = { items: [], count: 0 };

// =====================================================
// Authentication Functions
// =====================================================
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }
        
        const data = await response.json();
        authToken = data.access_token;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('access_token', authToken); // Backup key
        currentUser = data.user;
        
        // Migrate guest cart/wishlist to database
        await migrateGuestData();
        
        await fetchCart();
        await fetchWishlist();
        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

async function register(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }
        
        const data = await response.json();
        authToken = data.access_token;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('access_token', authToken); // Backup key
        currentUser = data.user;
        
        // Migrate guest cart/wishlist to database
        await migrateGuestData();
        
        return data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

async function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    cart = { items: [], total: 0, item_count: 0 };
    wishlist = { items: [], count: 0 };
    updateCartUI();
    updateWishlistUI();
    window.location.href = '/';
}

async function fetchCurrentUser() {
    if (!authToken) return null;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('Token expired, logging out...');
                await logout();
            }
            throw new Error('Failed to fetch user');
        }
        
        currentUser = await response.json();
        return currentUser;
    } catch (error) {
        console.error('Fetch user error:', error);
        return null;
    }
}

// FIXED: Migrate guest cart and wishlist to database after login
async function migrateGuestData() {
    if (!authToken) return;
    
    // Migrate guest cart
    const guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
    if (guestCart.items && guestCart.items.length > 0) {
        console.log('Migrating guest cart to database:', guestCart.items.length, 'items');
        for (const item of guestCart.items) {
            try {
                await fetch(`${API_BASE_URL}/cart`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        product_id: item.product_id,
                        quantity: item.quantity
                    })
                });
            } catch (error) {
                console.error('Error migrating cart item:', error);
            }
        }
        localStorage.removeItem('guestCart');
        console.log('✅ Guest cart migrated and cleared');
    }
    
    // Migrate guest wishlist
    const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '{"items":[]}');
    if (guestWishlist.items && guestWishlist.items.length > 0) {
        console.log('Migrating guest wishlist to database:', guestWishlist.items.length, 'items');
        for (const item of guestWishlist.items) {
            try {
                await fetch(`${API_BASE_URL}/wishlist`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        product_id: item.product_id
                    })
                });
            } catch (error) {
                console.error('Error migrating wishlist item:', error);
            }
        }
        localStorage.removeItem('guestWishlist');
        console.log('✅ Guest wishlist migrated and cleared');
    }
}

// =====================================================
// Product Functions
// =====================================================
async function fetchProducts(filters = {}) {
    try {
        const params = new URLSearchParams();
        
        if (filters.category) params.append('category', filters.category);
        if (filters.featured !== undefined) params.append('featured', filters.featured);
        if (filters.search) params.append('search', filters.search);
        if (filters.min_price) params.append('min_price', filters.min_price);
        if (filters.max_price) params.append('max_price', filters.max_price);
        if (filters.sort_by) params.append('sort_by', filters.sort_by);
        if (filters.skip) params.append('skip', filters.skip);
        if (filters.limit) params.append('limit', filters.limit);
        
        const url = `${API_BASE_URL}/products${params.toString() ? '?' + params.toString() : ''}`;
        console.log('Fetching products from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Products fetch error:', errorText);
            throw new Error(`Failed to fetch products: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Products fetched:', data.length);
        return data;
    } catch (error) {
        console.error('Fetch products error:', error);
        showNotification('Failed to load products. Please try again.', 'error');
        return [];
    }
}

async function fetchProductById(productId) {
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        
        if (!response.ok) {
            throw new Error('Product not found');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Fetch product error:', error);
        throw error;
    }
}

async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch categories');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Fetch categories error:', error);
        return [];
    }
}

// =====================================================
// Cart Functions - FIXED TO WORK WITH AUTH
// =====================================================
async function fetchCart() {
    // Update token on every fetch
    authToken = getAuthToken();
    
    if (!authToken) {
        console.log('📦 No auth token - loading guest cart');
        cart = JSON.parse(localStorage.getItem('guestCart')) || { items: [], total: 0, item_count: 0 };
        updateCartUI();
        return cart;
    }
    
    try {
        console.log('📦 Fetching cart from database (authenticated)');
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('❌ Unauthorized - token expired');
                await logout();
                return cart;
            }
            console.error('Cart fetch failed:', response.status);
            throw new Error('Failed to fetch cart');
        }
        
        const data = await response.json();
        console.log('✅ Cart data received from database:', data);
        
        // Backend returns { items: [...], total_items: N, total_amount: X }
        cart = {
            items: data.items || [],
            total: data.total_amount || 0,
            item_count: data.total_items || 0
        };
        
        updateCartUI();
        return cart;
    } catch (error) {
        console.error('Fetch cart error:', error);
        return cart;
    }
}

async function addToCart(productId, quantity = 1) {
    console.log(`📦 Adding to cart: productId=${productId}, quantity=${quantity}`);
    
    // Update token
    authToken = getAuthToken();
    
    if (!authToken) {
        console.log('❌ No auth token - using GUEST cart');
        try {
            const product = await fetchProductById(productId);
            let guestCart = JSON.parse(localStorage.getItem('guestCart')) || { items: [], total: 0, item_count: 0 };
            
            const existingItem = guestCart.items.find(item => item.product_id === productId);
            
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                guestCart.items.push({
                    id: Date.now(),
                    product_id: productId,
                    product: product,
                    quantity: quantity
                });
            }
            
            guestCart.total = guestCart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
            guestCart.item_count = guestCart.items.reduce((sum, item) => sum + item.quantity, 0);
            
            localStorage.setItem('guestCart', JSON.stringify(guestCart));
            cart = guestCart;
            updateCartUI();
            showNotification('Added to cart!', 'success');
            return;
        } catch (error) {
            console.error('Guest cart error:', error);
            showNotification('Failed to add to cart', 'error');
            throw error;
        }
    }
    
    // Authenticated user - save to DATABASE
    try {
        console.log('✅ Auth token found - saving to DATABASE');
        console.log('Sending POST to:', `${API_BASE_URL}/cart`);
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ product_id: productId, quantity })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('❌ Token expired - falling back to guest cart');
                await logout();
                // Retry as guest
                return addToCart(productId, quantity);
            }
            const error = await response.json();
            console.error('Add to cart failed:', error);
            throw new Error(error.detail || 'Failed to add to cart');
        }
        
        const data = await response.json();
        console.log('✅ Successfully added to DATABASE cart:', data);
        
        // Backend returns { message: "...", cart: { items: [...], total_items: N, total_amount: X } }
        if (data.cart) {
            cart = {
                items: data.cart.items || [],
                total: data.cart.total_amount || 0,
                item_count: data.cart.total_items || 0
            };
            updateCartUI();
        }
        
        showNotification(data.message || 'Added to cart!', 'success');
    } catch (error) {
        console.error('Add to cart error:', error);
        showNotification(error.message || 'Failed to add to cart', 'error');
        throw error;
    }
}

async function updateCartItem(cartItemId, quantity) {
    authToken = getAuthToken();
    
    if (!authToken) {
        let guestCart = JSON.parse(localStorage.getItem('guestCart')) || { items: [], total: 0, item_count: 0 };
        const item = guestCart.items.find(i => i.id === cartItemId);
        if (item) {
            item.quantity = quantity;
            guestCart.total = guestCart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
            guestCart.item_count = guestCart.items.reduce((sum, item) => sum + item.quantity, 0);
            localStorage.setItem('guestCart', JSON.stringify(guestCart));
            cart = guestCart;
            updateCartUI();
        }
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart/${cartItemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ quantity })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update cart');
        }
        
        const data = await response.json();
        
        if (data.cart) {
            cart = {
                items: data.cart.items || [],
                total: data.cart.total_amount || 0,
                item_count: data.cart.total_items || 0
            };
            updateCartUI();
        }
        
        showNotification(data.message || 'Cart updated', 'success');
    } catch (error) {
        console.error('Update cart error:', error);
        showNotification('Failed to update cart', 'error');
    }
}

async function removeFromCart(cartItemId) {
    authToken = getAuthToken();
    
    if (!authToken) {
        let guestCart = JSON.parse(localStorage.getItem('guestCart')) || { items: [], total: 0, item_count: 0 };
        guestCart.items = guestCart.items.filter(item => item.id !== cartItemId);
        guestCart.total = guestCart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        guestCart.item_count = guestCart.items.reduce((sum, item) => sum + item.quantity, 0);
        localStorage.setItem('guestCart', JSON.stringify(guestCart));
        cart = guestCart;
        updateCartUI();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart/${cartItemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove from cart');
        }
        
        const data = await response.json();
        
        if (data.cart) {
            cart = {
                items: data.cart.items || [],
                total: data.cart.total_amount || 0,
                item_count: data.cart.total_items || 0
            };
            updateCartUI();
        }
        
        showNotification(data.message || 'Removed from cart', 'success');
    } catch (error) {
        console.error('Remove from cart error:', error);
        showNotification('Failed to remove from cart', 'error');
    }
}

async function clearCart() {
    authToken = getAuthToken();
    
    if (!authToken) {
        cart = { items: [], total: 0, item_count: 0 };
        localStorage.removeItem('guestCart');
        updateCartUI();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to clear cart');
        }
        
        const data = await response.json();
        
        if (data.cart) {
            cart = {
                items: data.cart.items || [],
                total: data.cart.total_amount || 0,
                item_count: data.cart.total_items || 0
            };
            updateCartUI();
        }
        
        showNotification(data.message || 'Cart cleared', 'success');
    } catch (error) {
        console.error('Clear cart error:', error);
    }
}

// =====================================================
// Wishlist Functions - FIXED TO WORK WITH AUTH
// =====================================================
async function fetchWishlist() {
    authToken = getAuthToken();
    
    if (!authToken) {
        console.log('💝 No auth token - loading guest wishlist');
        wishlist = JSON.parse(localStorage.getItem('guestWishlist')) || { items: [], count: 0 };
        updateWishlistUI();
        return wishlist;
    }
    
    try {
        console.log('💝 Fetching wishlist from database (authenticated)');
        const response = await fetch(`${API_BASE_URL}/wishlist`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch wishlist');
        }
        
        wishlist = await response.json();
        console.log('✅ Wishlist data received from database:', wishlist);
        updateWishlistUI();
        return wishlist;
    } catch (error) {
        console.error('Fetch wishlist error:', error);
        return wishlist;
    }
}

async function addToWishlist(productId) {
    console.log(`💝 Adding to wishlist: productId=${productId}`);
    
    authToken = getAuthToken();
    
    if (!authToken) {
        console.log('❌ No auth token - using GUEST wishlist');
        try {
            const product = await fetchProductById(productId);
            let guestWishlist = JSON.parse(localStorage.getItem('guestWishlist')) || { items: [], count: 0 };
            
            const exists = guestWishlist.items.find(item => item.product_id === productId);
            
            if (exists) {
                showNotification('Already in wishlist', 'info');
                return;
            }
            
            guestWishlist.items.push({ id: Date.now(), product_id: productId, product: product });
            guestWishlist.count = guestWishlist.items.length;
            localStorage.setItem('guestWishlist', JSON.stringify(guestWishlist));
            wishlist = guestWishlist;
            updateWishlistUI();
            showNotification('Added to wishlist!', 'success');
        } catch (error) {
            console.error('Guest wishlist error:', error);
            showNotification('Failed to add to wishlist', 'error');
        }
        return;
    }
    
    try {
        console.log('✅ Auth token found - saving to DATABASE');
        const response = await fetch(`${API_BASE_URL}/wishlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ product_id: productId })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('❌ Token expired - falling back to guest wishlist');
                await logout();
                return addToWishlist(productId);
            }
            const error = await response.json();
            throw new Error(error.detail || 'Failed to add to wishlist');
        }
        
        console.log('✅ Successfully added to DATABASE wishlist');
        await fetchWishlist();
        showNotification('Added to wishlist!', 'success');
    } catch (error) {
        console.error('Add to wishlist error:', error);
        showNotification(error.message || 'Failed to add to wishlist', 'error');
    }
}

async function removeFromWishlist(productId) {
    authToken = getAuthToken();
    
    if (!authToken) {
        let guestWishlist = JSON.parse(localStorage.getItem('guestWishlist')) || { items: [], count: 0 };
        guestWishlist.items = guestWishlist.items.filter(item => item.product_id !== productId);
        guestWishlist.count = guestWishlist.items.length;
        localStorage.setItem('guestWishlist', JSON.stringify(guestWishlist));
        wishlist = guestWishlist;
        updateWishlistUI();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/wishlist/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove from wishlist');
        }
        
        await fetchWishlist();
        showNotification('Removed from wishlist', 'success');
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        showNotification('Failed to remove from wishlist', 'error');
    }
}

// =====================================================
// Order Functions
// =====================================================
async function createOrder(orderData) {
    authToken = getAuthToken();
    
    if (!authToken) {
        showNotification('Please login to place an order', 'error');
        return null;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create order');
        }
        
        const result = await response.json();
        await fetchCart();
        showNotification('Order placed successfully!', 'success');
        return result;
    } catch (error) {
        console.error('Create order error:', error);
        showNotification(error.message || 'Failed to place order', 'error');
        return null;
    }
}

async function fetchOrders() {
    authToken = getAuthToken();
    
    if (!authToken) return [];
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        return data.orders || [];
    } catch (error) {
        console.error('Fetch orders error:', error);
        return [];
    }
}

async function fetchOrderById(orderId) {
    authToken = getAuthToken();
    
    if (!authToken) return null;
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Order not found');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Fetch order error:', error);
        return null;
    }
}

// =====================================================
// UI Update Functions
// =====================================================
function updateCartUI() {
    console.log('🎨 Updating cart UI, item_count:', cart.item_count);
    const cartIcon = document.querySelector('.fa-shopping-cart');
    if (!cartIcon) {
        console.log('Cart icon not found');
        return;
    }
    
    // Remove existing badge
    const existingBadge = cartIcon.parentElement.querySelector('.cart-badge');
    if (existingBadge) existingBadge.remove();
    
    if (cart.item_count > 0) {
        const badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.textContent = cart.item_count;
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            background: #dc3545;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            pointer-events: none;
        `;
        cartIcon.parentElement.style.position = 'relative';
        cartIcon.parentElement.appendChild(badge);
        console.log('✅ Cart badge added with count:', cart.item_count);
    }
}

function updateWishlistUI() {
    const wishlistIcon = document.querySelector('.fa-heart');
    if (!wishlistIcon) return;
    
    // Remove existing badge
    const existingBadge = wishlistIcon.parentElement.querySelector('.wishlist-badge');
    if (existingBadge) existingBadge.remove();
    
    if (wishlist.count > 0) {
        const badge = document.createElement('span');
        badge.className = 'wishlist-badge';
        badge.textContent = wishlist.count;
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            background: #dc3545;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            pointer-events: none;
        `;
        wishlistIcon.parentElement.style.position = 'relative';
        wishlistIcon.parentElement.appendChild(badge);
    }
}

function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8',
        warning: '#ffc107'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 25px;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        max-width: 350px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// =====================================================
// Utility Functions
// =====================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatPrice(price) {
    return `PHP ${Number(price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// =====================================================
// Initialization
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== 🚀 Initializing Rolex Store ===');
    
    // Get fresh token
    authToken = getAuthToken();
    
    if (authToken) {
        console.log('✅ Auth token found, fetching user...');
        await fetchCurrentUser();
        console.log('Current user:', currentUser);
    } else {
        console.log('❌ No auth token found - running as guest');
    }
    
    console.log('Loading cart and wishlist...');
    await fetchCart();
    await fetchWishlist();
    
    console.log('=== ✅ Initialization complete ===');
    console.log('Auth status:', authToken ? 'AUTHENTICATED 🔐' : 'GUEST 👤');
    console.log('Cart state:', cart);
    console.log('Wishlist state:', wishlist);
});

// Listen for login events from auth.js
window.addEventListener('userLoggedIn', async function(event) {
    console.log('🔔 User logged in event received:', event.detail);
    authToken = getAuthToken();
    await migrateGuestData();
    await fetchCart();
    await fetchWishlist();
});

window.addEventListener('userLoggedOut', function() {
    console.log('🔔 User logged out event received');
    authToken = null;
    cart = { items: [], total: 0, item_count: 0 };
    wishlist = { items: [], count: 0 };
    updateCartUI();
    updateWishlistUI();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
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
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Export functions for global use
window.RolexStore = {
    login,
    register,
    logout,
    fetchProducts,
    fetchProductById,
    fetchCategories,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    addToWishlist,
    removeFromWishlist,
    createOrder,
    fetchOrders,
    fetchOrderById,
    showNotification,
    formatPrice,
    formatDate,
    getAuthToken // Export for debugging
};

console.log('=== ✅ RolexStore exported to window ===');