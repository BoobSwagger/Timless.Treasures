// =====================================================
// seller_dashboard.js - Seller Dashboard Logic
// =====================================================

// Try both with and without /api prefix
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';
const API_BASE_URL_ALT = 'https://relo-24j8.onrender.com';

let useAltUrl = false;

// =====================================================
// Authentication & Token Management
// =====================================================

function getAuthToken() {
    return localStorage.getItem('access_token');
}

function isAuthenticated() {
    return !!getAuthToken();
}

function redirectToLogin() {
    localStorage.clear();
    window.location.href = '../logIns/signIn.html';
}

async function checkAuth() {
    if (!isAuthenticated()) {
        redirectToLogin();
        return false;
    }
    return true;
}

// =====================================================
// API Request Helper
// =====================================================

async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    const baseUrl = useAltUrl ? API_BASE_URL_ALT : API_BASE_URL;
    const fullUrl = `${baseUrl}${endpoint}`;
    console.log('API Request:', fullUrl);

    try {
        const response = await fetch(fullUrl, config);
        
        // If 404 and haven't tried alt URL yet, try it
        if (response.status === 404 && !useAltUrl) {
            console.log('404 with /api prefix, trying without /api...');
            useAltUrl = true;
            return apiRequest(endpoint, options);
        }
        
        if (response.status === 401) {
            redirectToLogin();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error(`API Error (${response.status}):`, error);
            throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// =====================================================
// Dashboard Data Fetching
// =====================================================

async function fetchDashboardStats() {
    try {
        // Fetch products for seller
        const products = await apiRequest('/products');
        
        // Fetch orders (you'll need to add seller-specific endpoint)
        const orders = await apiRequest('/orders');
        
        // Calculate stats
        const stats = {
            totalProducts: products.length,
            totalOrders: orders.orders ? orders.orders.length : 0,
            revenue: calculateRevenue(orders.orders || []),
            pendingOrders: countPendingOrders(orders.orders || [])
        };

        updateStatsCards(stats);
        return stats;
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        showError('Failed to load dashboard statistics');
    }
}

async function fetchRecentOrders() {
    try {
        const response = await apiRequest('/orders?limit=5');
        const orders = response.orders || [];
        
        displayRecentOrders(orders);
        return orders;
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        showError('Failed to load recent orders');
        return [];
    }
}

// =====================================================
// Data Calculation Functions
// =====================================================

function calculateRevenue(orders) {
    return orders.reduce((total, order) => {
        if (order.status !== 'cancelled') {
            return total + (order.total_amount || 0);
        }
        return total;
    }, 0);
}

function countPendingOrders(orders) {
    return orders.filter(order => order.status === 'pending').length;
}

// =====================================================
// UI Update Functions
// =====================================================

function updateStatsCards(stats) {
    // Update Total Products
    const totalProductsEl = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (totalProductsEl) {
        totalProductsEl.textContent = stats.totalProducts;
    }

    // Update Total Orders
    const totalOrdersEl = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (totalOrdersEl) {
        totalOrdersEl.textContent = stats.totalOrders;
    }

    // Update Revenue
    const revenueEl = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(stats.revenue);
    }

    // Update Pending Orders
    const pendingEl = document.querySelector('.stat-card:nth-child(4) .stat-value');
    if (pendingEl) {
        pendingEl.textContent = stats.pendingOrders;
    }
}

function displayRecentOrders(orders) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    No orders yet
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const firstItem = order.order_items && order.order_items[0];
        const productName = firstItem ? firstItem.product.name : 'N/A';
        const itemCount = order.order_items ? order.order_items.length : 0;
        
        return `
            <tr>
                <td>${order.order_number}</td>
                <td>Customer</td>
                <td>${productName}${itemCount > 1 ? ` (+${itemCount - 1} more)` : ''}</td>
                <td>${formatCurrency(order.total_amount)}</td>
                <td>${getStatusBadge(order.status)}</td>
                <td>${formatDate(order.created_at)}</td>
            </tr>
        `;
    }).join('');
}

// =====================================================
// Utility Functions
// =====================================================

function formatCurrency(amount) {
    if (typeof amount !== 'number') return '₱0.00';
    
    // For thousands (K)
    if (amount >= 1000) {
        return `₱${(amount / 1000).toFixed(1)}K`;
    }
    
    return `₱${amount.toFixed(2)}`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function getStatusBadge(status) {
    const statusClasses = {
        'pending': 'badge-pending',
        'processing': 'badge-processing',
        'completed': 'badge-completed',
        'cancelled': 'badge-cancelled'
    };

    const statusText = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    const badgeClass = statusClasses[status] || 'badge-pending';

    return `<span class="badge ${badgeClass}">${statusText}</span>`;
}

function showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 400px;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 400px;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// =====================================================
// Search Functionality
// =====================================================

function setupSearch() {
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    try {
                        const products = await apiRequest(`/products?search=${encodeURIComponent(query)}`);
                        console.log('Search results:', products);
                        // You can add logic to display search results
                    } catch (error) {
                        showError('Search failed');
                    }
                }
            }
        });
    }
}

// =====================================================
// Logout Function
// =====================================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        window.location.href = '../logIns/signIn.html';
    }
}

// =====================================================
// Page Load Handler
// =====================================================

async function initializeDashboard() {
    // Check authentication
    const isAuth = await checkAuth();
    if (!isAuth) return;

    // Show loading state
    console.log('Loading dashboard...');

    try {
        // Fetch all dashboard data
        await Promise.all([
            fetchDashboardStats(),
            fetchRecentOrders()
        ]);

        // Setup search
        setupSearch();

        console.log('Dashboard loaded successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError('Failed to load dashboard. Please refresh the page.');
    }
}

// =====================================================
// Initialize on DOM Load
// =====================================================

document.addEventListener('DOMContentLoaded', initializeDashboard);

// =====================================================
// Export functions for use in other scripts
// =====================================================

window.dashboardAPI = {
    fetchDashboardStats,
    fetchRecentOrders,
    logout,
    apiRequest
};

// =====================================================
// HTML Integration Instructions
// =====================================================

/* 
TO INTEGRATE THIS SCRIPT INTO YOUR HTML:

1. Add this script tag before closing </body> tag:
   <script src="seller_dashboard.js"></script>

2. REMOVE or UPDATE these mock data sections in your HTML:
   
   a) Remove hardcoded stats values (127, 842, ₱124.5K, 23)
      - Keep the HTML structure
      - The script will populate with real data
   
   b) Remove the entire <tbody> section with mock orders
      - Keep just: <tbody></tbody>
      - The script will populate with real orders
   
   c) Update the logout() function call:
      - Change: onclick="logout()"
      - The function is now in seller_dashboard.js

3. Your updated HTML sections should look like:

   Stats (keep structure, values will be updated):
   <div class="stat-value">0</div>

   Orders table (remove all <tr> elements):
   <tbody></tbody>

The JavaScript will automatically fetch and display real data from the API!
*/