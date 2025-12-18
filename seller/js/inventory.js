// ==================== CONFIGURATION ====================
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

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
let products = [];
let currentEditProduct = null;

// ==================== DOM ELEMENTS ====================
const searchInput = document.getElementById('searchInput');
const tableBody = document.querySelector('tbody');

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
    
    loadProducts();
    setupEventListeners();
});

function setupEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Search button
    const searchBtn = document.querySelector('.search-controls button');
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }
}

// ==================== LOAD PRODUCTS ====================
async function loadProducts(searchTerm = '', category = '') {
    try {
        showLoadingState();
        
        if (!SELLER_ID) {
            throw new Error('Seller ID not found');
        }
        
        let url = `${API_BASE_URL}/seller/products?seller_id=${SELLER_ID}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;
        
        const token = window.Auth ? window.Auth.getAuthToken() : localStorage.getItem('authToken');
        
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
        products = data.products || [];
        
        renderProducts(products);
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError(error.message || 'Failed to load products. Please refresh the page.');
        
        if (error.message.includes('Session expired') && window.Auth) {
            setTimeout(() => window.Auth.signOut(), 2000);
        }
    }
}

// ==================== RENDER PRODUCTS ====================
function renderProducts(productList) {
    if (!tableBody) return;
    
    if (productList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
                    <p>No products found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = productList.map(product => `
        <tr data-product-id="${product.id}">
            <td>
                <div class="product-cell">
                    <img src="${product.image_url || 'https://via.placeholder.com/50'}" 
                         class="product-img" 
                         alt="${product.name}"
                         onerror="this.src='https://via.placeholder.com/50?text=No+Image'">
                    <span>${escapeHtml(product.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(product.category || 'Uncategorized')}</td>
            <td>₱${formatNumber(product.price)}</td>
            <td>${product.stock}</td>
            <td>${renderStockBadge(product.stock, product.stock_status)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="editProduct(${product.id})" title="Edit Product">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteProduct(${product.id})" title="Delete Product">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderStockBadge(stock, stockStatus) {
    let badgeClass = 'stock-high';
    let badgeText = 'In Stock';
    
    if (stock === 0) {
        badgeClass = 'stock-out';
        badgeText = 'Out of Stock';
    } else if (stock <= 5) {
        badgeClass = 'stock-low';
        badgeText = 'Low Stock';
    }
    
    return `<span class="stock-badge ${badgeClass}">${badgeText}</span>`;
}

// ==================== SEARCH FUNCTIONALITY ====================
function handleSearch() {
    const searchTerm = searchInput.value.trim();
    loadProducts(searchTerm);
}

// ==================== EDIT PRODUCT ====================
window.editProduct = async function(productId) {
    try {
        const product = products.find(p => p.id === productId);
        if (!product) {
            showError('Product not found');
            return;
        }
        
        currentEditProduct = product;
        
        // Create modal
        const modal = createEditModal(product);
        document.body.appendChild(modal);
        
        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
        
    } catch (error) {
        console.error('Error editing product:', error);
        showError('Failed to open edit form');
    }
};

function createEditModal(product) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Product</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="editProductForm" class="modal-form">
                <div class="form-group">
                    <label>Product Name *</label>
                    <input type="text" name="name" value="${escapeHtml(product.name)}" required>
                </div>
                
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="3">${escapeHtml(product.description || '')}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Price (₱) *</label>
                        <input type="number" name="price" value="${product.price}" step="0.01" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Stock *</label>
                        <input type="number" name="stock" value="${product.stock}" min="0" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Category</label>
                        <select name="category">
                            <option value="">Select Category</option>
                            <option value="Watches" ${product.category === 'Watches' ? 'selected' : ''}>Watches</option>
                            <option value="Jewelry" ${product.category === 'Jewelry' ? 'selected' : ''}>Jewelry</option>
                            <option value="Accessories" ${product.category === 'Accessories' ? 'selected' : ''}>Accessories</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Material</label>
                        <input type="text" name="material" value="${escapeHtml(product.material || '')}">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Case Size</label>
                        <input type="text" name="case_size" value="${escapeHtml(product.case_size || '')}">
                    </div>
                    
                    <div class="form-group">
                        <label>Reference Number</label>
                        <input type="text" name="reference_number" value="${escapeHtml(product.reference_number || '')}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Product Image</label>
                    <input type="file" name="image" accept="image/*" id="editImageInput">
                    ${product.image_url ? `<img src="${product.image_url}" style="max-width: 200px; margin-top: 10px; border: 1px solid #ddd;">` : ''}
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Add form submit handler
    const form = modal.querySelector('#editProductForm');
    form.addEventListener('submit', handleEditSubmit);
    
    return modal;
}

async function handleEditSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    formData.append('seller_id', SELLER_ID);
    
    try {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        const token = window.Auth ? window.Auth.getAuthToken() : localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE_URL}/seller/products/${currentEditProduct.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (response.status === 401) {
            throw new Error('Session expired. Please sign in again.');
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update product');
        }
        
        showSuccess('Product updated successfully!');
        closeModal();
        await loadProducts();
        
    } catch (error) {
        console.error('Error updating product:', error);
        showError(error.message || 'Failed to update product');
        
        if (error.message.includes('Session expired') && window.Auth) {
            setTimeout(() => window.Auth.signOut(), 2000);
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

// ==================== DELETE PRODUCT ====================
window.deleteProduct = async function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const confirmed = confirm(`Are you sure you want to delete "${product.name}"?\n\nThis action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
        const token = window.Auth ? window.Auth.getAuthToken() : localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE_URL}/seller/products/${productId}?seller_id=${SELLER_ID}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            throw new Error('Session expired. Please sign in again.');
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete product');
        }
        
        showSuccess('Product deleted successfully!');
        await loadProducts();
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showError(error.message || 'Failed to delete product');
        
        if (error.message.includes('Session expired') && window.Auth) {
            setTimeout(() => window.Auth.signOut(), 2000);
        }
    }
};

// ==================== MODAL MANAGEMENT ====================
window.closeModal = function() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
    currentEditProduct = null;
};

// ==================== UI HELPERS ====================
function showLoadingState() {
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #666;"></i>
                    <p style="margin-top: 10px; color: #666;">Loading products...</p>
                </td>
            </tr>
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
    }, 3000);
}

// ==================== UTILITY FUNCTIONS ====================
function formatNumber(num) {
    return new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

// ==================== STYLES FOR MODAL & NOTIFICATIONS ====================
const style = document.createElement('style');
style.textContent = `
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
    }
    
    .modal-overlay.show {
        opacity: 1;
    }
    
    .modal-content {
        background: #fff;
        border-radius: 8px;
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 30px;
        border-bottom: 1px solid #eee;
    }
    
    .modal-header h2 {
        font-size: 1.5rem;
        margin: 0;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .modal-close:hover {
        color: #333;
    }
    
    .modal-form {
        padding: 30px;
    }
    
    .form-group {
        margin-bottom: 20px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #333;
    }
    
    .form-group input,
    .form-group textarea,
    .form-group select {
        width: 100%;
        padding: 10px 15px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.95rem;
        font-family: 'Lato', sans-serif;
    }
    
    .form-group textarea {
        resize: vertical;
    }
    
    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    }
    
    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eee;
    }
    
    .btn-primary,
    .btn-secondary {
        padding: 12px 25px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.95rem;
        font-weight: 600;
        transition: all 0.3s;
    }
    
    .btn-primary {
        background: #000;
        color: #fff;
    }
    
    .btn-primary:hover:not(:disabled) {
        background: #333;
    }
    
    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .btn-secondary {
        background: #fff;
        color: #333;
        border: 1px solid #ddd;
    }
    
    .btn-secondary:hover {
        background: #f5f5f5;
    }
    
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
    
    .notification i {
        font-size: 1.2rem;
    }
    
    @media (max-width: 768px) {
        .modal-content {
            width: 95%;
            max-height: 95vh;
        }
        
        .form-row {
            grid-template-columns: 1fr;
        }
        
        .notification {
            right: 10px;
            left: 10px;
            min-width: auto;
        }
    }
`;
document.head.appendChild(style);