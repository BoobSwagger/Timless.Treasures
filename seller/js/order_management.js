// ==================== CONFIGURATION ====================
const ORDER_API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// Get seller ID from auth
function getSellerId() {
    if (window.Auth && window.Auth.getSellerId) {
        return window.Auth.getSellerId();
    }
    // Fallback: try to get from localStorage directly
    const user = localStorage.getItem('user');
    if (user) {
        const userData = JSON.parse(user);
        return userData.seller_id || localStorage.getItem('seller_id');
    }
    return null;
}

const SELLER_ID = getSellerId();

// ==================== STATE MANAGEMENT ====================
let allOrders = [];
let currentFilter = 'all';

// ==================== DOM ELEMENTS ====================
const ordersGrid = document.querySelector('.orders-grid');
const filterTabs = document.querySelectorAll('.filter-tab');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (window.Auth && !window.Auth.requireSeller()) {
        return; // Auth will handle redirect
    }
    
    // Verify we have a seller ID
    if (!SELLER_ID) {
        showError('Seller ID not found. Please sign in again.');
        setTimeout(() => {
            if (window.Auth) {
                window.Auth.signOut();
            }
        }, 2000);
        return;
    }
    
    loadOrders();
    setupEventListeners();
});

function setupEventListeners() {
    // Filter tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter || 'all';
            handleFilterChange(filter, e.target);
        });
    });
}

// ==================== LOAD ORDERS ====================
async function loadOrders(status = null) {
    try {
        showLoadingState();
        
        if (!SELLER_ID) {
            throw new Error('Seller ID not found');
        }
        
        let url = `${ORDER_API_BASE_URL}/seller/orders?seller_id=${SELLER_ID}&limit=100`;
        if (status && status !== 'all') {
            url += `&status=${status.toUpperCase()}`;
        }
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            throw new Error('Session expired. Please sign in again.');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        allOrders = data.orders || [];
        
        renderOrders(allOrders);
        
    } catch (error) {
        console.error('Error loading orders:', error);
        showError(error.message || 'Failed to load orders. Please refresh the page.');
        
        if (error.message.includes('Session expired') && window.Auth) {
            setTimeout(() => window.Auth.signOut(), 2000);
        }
    }
}

// ==================== RENDER ORDERS ====================
function renderOrders(orders) {
    if (!ordersGrid) return;
    
    if (orders.length === 0) {
        ordersGrid.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #999;">
                <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 20px; display: block;"></i>
                <h3 style="font-size: 1.3rem; margin-bottom: 10px;">No orders found</h3>
                <p>Orders will appear here when customers make purchases.</p>
            </div>
        `;
        return;
    }
    
    ordersGrid.innerHTML = orders.map(order => createOrderCard(order)).join('');
    
    // Attach event listeners to status selects
    document.querySelectorAll('.action-select').forEach(select => {
        select.addEventListener('change', handleStatusChange);
    });
}

function createOrderCard(order) {
    const statusBadge = getStatusBadge(order.status);
    const formattedDate = formatDate(order.created_at);
    const statusLower = order.status.toLowerCase();
    
    // Determine if order is completed/delivered
    const isCompleted = order.status === 'DELIVERED' || order.status === 'COMPLETED';
    
    return `
        <div class="order-card" data-status="${statusLower}" data-order-id="${order.id}">
            <div class="order-header">
                <div>
                    <div class="order-id">#${escapeHtml(order.order_number)}</div>
                    <div class="order-date">${formattedDate}</div>
                </div>
                ${statusBadge}
            </div>

            <div class="customer-info">
                <div><i class="fas fa-user"></i> ${escapeHtml(order.customer_name || 'N/A')}</div>
                <div><i class="fas fa-phone"></i> ${escapeHtml(order.customer_phone || 'N/A')}</div>
                <div><i class="fas fa-map-marker-alt"></i> ${escapeHtml(order.shipping_address || 'N/A')}</div>
                ${order.notes ? `<div><i class="fas fa-sticky-note"></i> ${escapeHtml(order.notes)}</div>` : ''}
            </div>

            <div class="order-items">
                ${renderOrderItems(order.items)}
            </div>

            <div class="order-footer">
                <div class="order-total">Total: ₱${formatNumber(order.total_amount)}</div>
                ${isCompleted ? 
                    `<span style="color: #0f5132; font-weight: 600;"><i class="fas fa-check-circle"></i> ${order.status === 'DELIVERED' ? 'Delivered' : 'Completed'}</span>` :
                    `<select class="action-select" data-order-id="${order.id}" data-current-status="${order.status}">
                        <option value="">Update Status</option>
                        ${getStatusOptions(order.status)}
                    </select>`
                }
            </div>
        </div>
    `;
}

function renderOrderItems(items) {
    if (!items || items.length === 0) {
        return '<div class="order-item">No items</div>';
    }
    
    // If items is an array of strings (from backend join)
    if (typeof items[0] === 'string') {
        return items.map(item => `
            <div class="order-item">
                ${escapeHtml(item)}
            </div>
        `).join('');
    }
    
    // If items is an array of objects
    return items.map(item => `
        <div class="order-item">
            <strong>${escapeHtml(item.product_name || item.name)}</strong> x${item.quantity} - ₱${formatNumber(item.price * item.quantity)}
        </div>
    `).join('');
}

function getStatusBadge(status) {
    const statusMap = {
        'PENDING': { class: 'badge-pending', label: 'Pending' },
        'PROCESSING': { class: 'badge-processing', label: 'Processing' },
        'SHIPPED': { class: 'badge-processing', label: 'Shipped' },
        'DELIVERED': { class: 'badge-completed', label: 'Delivered' },
        'COMPLETED': { class: 'badge-completed', label: 'Completed' },
        'CANCELLED': { class: 'badge-cancelled', label: 'Cancelled' }
    };
    
    const statusInfo = statusMap[status] || { class: 'badge-pending', label: status };
    return `<span class="badge ${statusInfo.class}">${statusInfo.label}</span>`;
}

function getStatusOptions(currentStatus) {
    const allStatuses = [
        { value: 'PENDING', label: 'Pending' },
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'SHIPPED', label: 'Shipped' },
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'CANCELLED', label: 'Cancelled' }
    ];
    
    // Filter out current status and show logical next steps
    return allStatuses
        .filter(s => s.value !== currentStatus)
        .map(s => `<option value="${s.value}">${s.label}</option>`)
        .join('');
}

// ==================== FILTER ORDERS ====================
function handleFilterChange(filter, tabElement) {
    currentFilter = filter;
    
    // Update active tab
    filterTabs.forEach(tab => tab.classList.remove('active'));
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Filter orders
    const orderCards = document.querySelectorAll('.order-card');
    orderCards.forEach(card => {
        const cardStatus = card.dataset.status;
        if (filter === 'all') {
            card.style.display = 'block';
        } else {
            card.style.display = cardStatus === filter ? 'block' : 'none';
        }
    });
}

// Make filter function global for inline onclick handlers
window.filterOrders = function(status) {
    const tabElement = Array.from(filterTabs).find(tab => 
        tab.textContent.toLowerCase().includes(status) || 
        (status === 'all' && tab.textContent.includes('All'))
    );
    handleFilterChange(status, tabElement);
};

// ==================== UPDATE ORDER STATUS ====================
async function handleStatusChange(event) {
    const select = event.target;
    const orderId = select.dataset.orderId;
    const newStatus = select.value;
    const currentStatus = select.dataset.currentStatus;
    
    if (!newStatus) return;
    
    const statusLabel = select.options[select.selectedIndex].text;
    const confirmed = confirm(`Update order status to "${statusLabel}"?`);
    
    if (!confirmed) {
        select.value = '';
        return;
    }
    
    try {
        // Disable select while updating
        select.disabled = true;
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        const response = await fetch(
            `${ORDER_API_BASE_URL}/seller/orders/${orderId}/status?seller_id=${SELLER_ID}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            }
        );
        
        if (response.status === 401) {
            throw new Error('Session expired. Please sign in again.');
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update order status');
        }
        
        showSuccess('Order status updated successfully!');
        
        // Reload orders to reflect changes
        await loadOrders();
        
        // Re-apply current filter
        if (currentFilter !== 'all') {
            handleFilterChange(currentFilter);
        }
        
    } catch (error) {
        console.error('Error updating order status:', error);
        showError(error.message || 'Failed to update order status');
        
        if (error.message.includes('Session expired') && window.Auth) {
            setTimeout(() => window.Auth.signOut(), 2000);
        }
        
        // Re-enable select
        select.disabled = false;
        select.value = '';
    }
}

// Make update function global for inline onchange handlers
window.updateOrderStatus = function(select, orderNumber) {
    // Find the order by order_number
    const order = allOrders.find(o => o.order_number.includes(orderNumber));
    if (order) {
        select.dataset.orderId = order.id;
        select.dataset.currentStatus = order.status;
        handleStatusChange({ target: select });
    }
};

// ==================== UI HELPERS ====================
function showLoadingState() {
    if (ordersGrid) {
        ordersGrid.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #666;"></i>
                <p style="margin-top: 20px; color: #666; font-size: 1.1rem;">Loading orders...</p>
            </div>
        `;
    }
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ==================== UTILITY FUNCTIONS ====================
function formatNumber(num) {
    return new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== STYLES FOR NOTIFICATIONS ====================
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 2000;
        transform: translateX(400px);
        transition: transform 0.3s;
        min-width: 300px;
        max-width: 500px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        background: #d1e7dd;
        color: #0f5132;
        border-left: 4px solid #0f5132;
    }
    
    .notification-error {
        background: #f8d7da;
        color: #842029;
        border-left: 4px solid #842029;
    }
    
    .notification-info {
        background: #cfe2ff;
        color: #084298;
        border-left: 4px solid #084298;
    }
    
    .notification i {
        font-size: 1.2rem;
    }
    
    @media (max-width: 768px) {
        .notification {
            right: 10px;
            left: 10px;
            min-width: auto;
        }
    }
`;
document.head.appendChild(style);   