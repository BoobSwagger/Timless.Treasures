// =====================================================
// product_details.js - Product Detail Page Handler - FIXED
// =====================================================

let currentProduct = null;
let selectedQuantity = 1;
let currentImageIndex = 0;
let productImages = [];
let relatedProducts = [];
let isInWishlist = false;

// =====================================================
// Get Product ID from URL - FIXED
// =====================================================
function getProductIdFromUrl() {
    // First try query parameter: ?id=3
    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id');
    
    if (productId) {
        console.log('Product ID from query param:', productId);
        return parseInt(productId);
    }
    
    // Then try path: /product/3
    const pathParts = window.location.pathname.split('/');
    const productIndex = pathParts.indexOf('product');
    
    if (productIndex !== -1 && pathParts[productIndex + 1]) {
        productId = pathParts[productIndex + 1];
        console.log('Product ID from path:', productId);
        return parseInt(productId);
    }
    
    console.error('No product ID found in URL');
    return null;
}

// =====================================================
// Load Product Data
// =====================================================
async function loadProductDetails() {
    const productId = getProductIdFromUrl();
    
    if (!productId) {
        showError('Invalid product ID. Please return to the shop.');
        return;
    }

    try {
        console.log('Loading product ID:', productId);
        showLoading();
        
        // Check if RolexStore is available
        if (!window.RolexStore || !window.RolexStore.fetchProductById) {
            console.error('RolexStore not available');
            showError('Store functionality not loaded. Please refresh the page.');
            return;
        }
        
        // Fetch product details
        currentProduct = await window.RolexStore.fetchProductById(productId);
        
        if (!currentProduct) {
            showError('Product not found');
            return;
        }
        
        console.log('Product loaded:', currentProduct);

        // Setup product images
        setupProductImages();
        
        // Render product details
        renderProductDetails();
        
        // Load related products
        await loadRelatedProducts();
        
        // Check if in wishlist
        await checkWishlistStatus();
        
    } catch (error) {
        console.error('Error loading product:', error);
        showError('Failed to load product. The product may not exist or the server is unavailable.');
    }
}

// =====================================================
// Setup Product Images
// =====================================================
function setupProductImages() {
    productImages = [];
    
    // Add main product image
    if (currentProduct.image_url) {
        productImages.push(currentProduct.image_url);
    } else {
        productImages.push('https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?auto=format&fit=crop&q=80&w=600');
    }
    
    // Add additional placeholder images
    if (productImages.length < 3) {
        productImages.push('https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=600');
        productImages.push('https://images.unsplash.com/photo-1620625515032-608130563bee?auto=format&fit=crop&q=80&w=600');
    }
}

// =====================================================
// Render Product Details
// =====================================================
function renderProductDetails() {
    // Update page title
    document.title = `${currentProduct.name} - Timeless Treasures`;
    
    // Update breadcrumbs
    updateBreadcrumbs();
    
    // Build the complete product HTML
    const productHTML = `
        <div class="product-thumbnails">
            ${productImages.map((imgUrl, index) => `
                <div class="thumb-box ${index === currentImageIndex ? 'active' : ''}" 
                     data-index="${index}">
                    <img src="${imgUrl}" alt="Product thumbnail ${index + 1}">
                </div>
            `).join('')}
        </div>

        <div class="product-image">
            <img src="${productImages[currentImageIndex]}" 
                 alt="${currentProduct.name}"
                 id="main-product-image">
        </div>

        <div class="product-details">
            <h2>${currentProduct.name}</h2>
            
            <div class="rating">
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star-half-alt"></i>
                <span>4.8/5</span>
            </div>

            ${renderStockBadge()}

            <div class="product-price">
                <span style="font-size: 1.8rem; font-weight: bold; color: #000;">
                    ${window.RolexStore.formatPrice(currentProduct.price)}
                </span>
            </div>

            <div class="product-desc">
                <p>${currentProduct.description || 'No description available.'}</p>
            </div>

            ${renderVariationsHTML()}

            <div class="variations">
                <p>Quantity:</p>
                <div class="qty-selector">
                    <button id="qty-minus">−</button>
                    <span id="qty-display">${selectedQuantity}</span>
                    <button id="qty-plus">+</button>
                </div>
            </div>

            <button class="btn-add-cart" id="add-to-cart-btn">
                <i class="fas fa-shopping-cart"></i> Add to Cart
            </button>
        </div>
    `;
    
    // Update the product-main container
    const mainContainer = document.querySelector('.product-main');
    if (mainContainer) {
        mainContainer.innerHTML = productHTML;
    }
    
    // Add thumbnail click style
    addThumbnailStyles();
    
    // Setup event listeners after rendering
    setupEventListeners();
}

// =====================================================
// Render Stock Badge
// =====================================================
function renderStockBadge() {
    const stockStatus = currentProduct.stock_status || 'in_stock';
    const stockConfig = {
        in_stock: { text: 'In Stock', color: '#28a745' },
        low_stock: { text: 'Low Stock', color: '#ffc107' },
        out_of_stock: { text: 'Out of Stock', color: '#dc3545' },
        pre_order: { text: 'Pre-Order', color: '#17a2b8' }
    };
    
    const config = stockConfig[stockStatus] || stockConfig.in_stock;
    
    return `
        <span style="
            display: inline-block;
            padding: 5px 15px;
            background: ${config.color};
            color: white;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: bold;
            margin-bottom: 15px;
        ">
            ${config.text}
        </span>
    `;
}

// =====================================================
// Render Variations HTML
// =====================================================
function renderVariationsHTML() {
    let html = '';
    
    if (currentProduct.material || currentProduct.case_size || currentProduct.reference_number) {
        html += '<div class="variations" style="margin-bottom: 20px;">';
        html += '<p style="font-weight: bold; margin-bottom: 10px;">Product Details</p>';
        
        if (currentProduct.material) {
            html += `<div style="margin-bottom: 8px;"><strong>Material:</strong> ${currentProduct.material}</div>`;
        }
        
        if (currentProduct.case_size) {
            html += `<div style="margin-bottom: 8px;"><strong>Case Size:</strong> ${currentProduct.case_size}</div>`;
        }
        
        if (currentProduct.reference_number) {
            html += `<div style="margin-bottom: 8px;"><strong>Reference:</strong> ${currentProduct.reference_number}</div>`;
        }
        
        html += '</div>';
    }
    
    return html;
}

// =====================================================
// Add Thumbnail Styles
// =====================================================
function addThumbnailStyles() {
    if (!document.querySelector('style[data-thumb-style]')) {
        const style = document.createElement('style');
        style.setAttribute('data-thumb-style', 'true');
        style.textContent = `
            .thumb-box.active {
                border: 2px solid #000 !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
        `;
        document.head.appendChild(style);
    }
}

// =====================================================
// Update Breadcrumbs
// =====================================================
function updateBreadcrumbs() {
    const breadcrumbsEl = document.querySelector('.breadcrumbs');
    if (breadcrumbsEl && currentProduct) {
        const category = currentProduct.category || 'Products';
        breadcrumbsEl.innerHTML = `
            Home <span>&gt;</span> 
            <a href="/">Shop</a> <span>&gt;</span> 
            ${category} <span>&gt;</span>
            <span style="color: #333;">${currentProduct.name}</span>
        `;
    }
}

// =====================================================
// Setup Event Listeners
// =====================================================
function setupEventListeners() {
    // Thumbnail clicks
    document.querySelectorAll('.thumb-box').forEach((thumb, index) => {
        thumb.addEventListener('click', () => selectImage(index));
    });
    
    // Quantity buttons
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');
    
    if (qtyMinus) {
        qtyMinus.addEventListener('click', () => {
            if (selectedQuantity > 1) {
                selectedQuantity--;
                updateQuantityDisplay();
            }
        });
    }
    
    if (qtyPlus) {
        qtyPlus.addEventListener('click', () => {
            if (selectedQuantity < 99) {
                selectedQuantity++;
                updateQuantityDisplay();
            }
        });
    }
    
    // Add to cart button
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', handleAddToCart);
    }
}

// =====================================================
// Update Quantity Display
// =====================================================
function updateQuantityDisplay() {
    const qtyDisplay = document.getElementById('qty-display');
    if (qtyDisplay) {
        qtyDisplay.textContent = selectedQuantity;
    }
}

// =====================================================
// Select Image
// =====================================================
function selectImage(index) {
    currentImageIndex = index;
    
    // Update main image
    const mainImg = document.getElementById('main-product-image');
    if (mainImg) {
        mainImg.src = productImages[index];
    }
    
    // Update thumbnail active state
    document.querySelectorAll('.thumb-box').forEach((thumb, i) => {
        if (i === index) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

// =====================================================
// Handle Add to Cart
// =====================================================
async function handleAddToCart() {
    if (!currentProduct) return;
    
    const stockStatus = currentProduct.stock_status || 'in_stock';
    if (stockStatus === 'out_of_stock') {
        window.RolexStore.showNotification('This product is out of stock', 'warning');
        return;
    }
    
    try {
        await window.RolexStore.addToCart(currentProduct.id, selectedQuantity);
        
        // Visual feedback
        const button = document.getElementById('add-to-cart-btn');
        if (button) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Added to Cart!';
            button.style.background = '#28a745';
            button.disabled = true;
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.background = '#000';
                button.disabled = false;
            }, 2000);
        }
        
        // Reset quantity
        selectedQuantity = 1;
        updateQuantityDisplay();
        
    } catch (error) {
        console.error('Error adding to cart:', error);
    }
}

// =====================================================
// Check Wishlist Status
// =====================================================
async function checkWishlistStatus() {
    try {
        const wishlistData = JSON.parse(localStorage.getItem('guestWishlist') || '{"items":[]}');
        isInWishlist = wishlistData.items.some(item => item.product_id === currentProduct.id);
        updateWishlistIcon();
    } catch (error) {
        console.error('Error checking wishlist:', error);
    }
}

// =====================================================
// Update Wishlist Icon
// =====================================================
function updateWishlistIcon() {
    const wishlistIcon = document.querySelector('.fa-heart');
    if (!wishlistIcon) return;
    
    if (isInWishlist) {
        wishlistIcon.classList.remove('far');
        wishlistIcon.classList.add('fas');
        wishlistIcon.style.color = '#ff4444';
    } else {
        wishlistIcon.classList.remove('fas');
        wishlistIcon.classList.add('far');
        wishlistIcon.style.color = '#555';
    }
}

// =====================================================
// Load Related Products - FIXED URL
// =====================================================
async function loadRelatedProducts() {
    try {
        const filters = {};
        if (currentProduct.category) {
            filters.category = currentProduct.category;
        }
        filters.limit = 3;
        
        const products = await window.RolexStore.fetchProducts(filters);
        
        // Filter out current product
        relatedProducts = products.filter(p => p.id !== currentProduct.id).slice(0, 3);
        
        renderRelatedProducts();
    } catch (error) {
        console.error('Error loading related products:', error);
    }
}

// =====================================================
// Render Related Products - FIXED URL
// =====================================================
function renderRelatedProducts() {
    const recGrid = document.querySelector('.rec-grid');
    if (!recGrid || relatedProducts.length === 0) {
        if (recGrid) {
            recGrid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1/-1;">No related products available</p>';
        }
        return;
    }
    
    recGrid.innerHTML = relatedProducts.map(product => `
        <div class="rec-card" onclick="window.location.href='product_details.html?id=${product.id}'">
            <img src="${product.image_url || 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&q=80&w=300'}" 
                 alt="${product.name}">
            <h4>${product.name}</h4>
            <p class="rec-desc">${(product.description || '').substring(0, 80)}${product.description && product.description.length > 80 ? '...' : ''}</p>
            <div style="font-weight: bold; margin-top: 10px; color: #000;">
                ${window.RolexStore.formatPrice(product.price)}
            </div>
        </div>
    `).join('');
}

// =====================================================
// Loading & Error States
// =====================================================
function showLoading() {
    const mainContainer = document.querySelector('.product-main');
    if (mainContainer) {
        mainContainer.innerHTML = `
            <div class="loading" style="text-align: center; padding: 60px; width: 100%; font-size: 1.2rem; color: #666;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 20px;"></i>
                <p>Loading product details...</p>
            </div>
        `;
    }
}

function showError(message) {
    const mainContainer = document.querySelector('.product-main');
    if (mainContainer) {
        mainContainer.innerHTML = `
            <div style="text-align: center; padding: 60px; width: 100%;">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;"></i>
                <h2 style="color: #333; margin-bottom: 10px;">Oops!</h2>
                <p style="color: #666; margin-bottom: 20px;">${message}</p>
                <a href="/" style="
                    display: inline-block;
                    padding: 12px 30px;
                    background: #000;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-weight: bold;
                ">Back to Shop</a>
            </div>
        `;
    }
}

// =====================================================
// Initialize on Page Load
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Product Details Page Initialized ===');
    console.log('Current URL:', window.location.href);
    
    // Small delay to ensure dashboard.js is loaded
    setTimeout(() => {
        loadProductDetails();
    }, 100);
});