// API Configuration
const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// Get token from localStorage - FIXED: Check both keys like cart.js
function getAuthToken() {
    // Check both possible token storage keys
    const token = localStorage.getItem('authToken') || localStorage.getItem('access_token');
    console.log('Getting auth token:', token ? 'Found' : 'Not found');
    return token;
}

// Check if user is authenticated
function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        console.error('No auth token found, redirecting to login');
        alert('Please login to proceed with checkout');
        window.location.href = '/login.html';
        return false;
    }
    console.log('Auth check passed');
    return true;
}

// Fetch cart data from backend
async function fetchCart() {
    try {
        const token = getAuthToken();
        
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        console.log('Fetching cart from:', `${API_BASE_URL}/cart`);
        
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Cart fetch response:', response.status, response.statusText);

        if (response.status === 401) {
            console.error('Unauthorized - clearing tokens and redirecting');
            localStorage.removeItem('access_token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('refresh_token');
            alert('Your session has expired. Please login again.');
            window.location.href = '/login.html';
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Cart data received:', data);
        return data;
    } catch (error) {
        console.error('Error fetching cart:', error);
        throw error;
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0
    }).format(amount);
}

// Store checkout data globally
let checkoutData = {
    shippingAddress: 'Dr Jose Rizal St, Oroquieta City, 7207 Misamis Occidental',
    paymentMethod: 'credit_card',
    cardNumber: '**** **** **** 1234',
    cardType: 'Gcash Card'
};

// Render order summary
function renderOrderSummary(cartData) {
    const subtotal = cartData.total_amount || cartData.total || 0;
    const shippingFee = subtotal >= 1000000 ? 0 : 10; // Free shipping over 1M
    const total = subtotal + shippingFee;

    console.log('Rendering order summary:', { subtotal, shippingFee, total });

    // Update amount details
    const amountRows = document.querySelectorAll('.amount-row');
    if (amountRows[0]) {
        amountRows[0].querySelector('span:last-child').textContent = formatCurrency(subtotal);
    }
    if (amountRows[1]) {
        amountRows[1].querySelector('span:last-child').textContent = 
            shippingFee === 0 ? 'Free' : formatCurrency(shippingFee);
    }

    // Update total
    const totalRow = document.querySelector('.total-row span:last-child');
    if (totalRow) {
        totalRow.textContent = formatCurrency(total);
    }

    // Store for order creation
    checkoutData.itemTotal = subtotal;
    checkoutData.deliveryFee = shippingFee;
    checkoutData.total = total;
}

// Change address handler
function changeAddress() {
    const newAddress = prompt('Enter your delivery address:', checkoutData.shippingAddress);
    
    if (newAddress && newAddress.trim().length >= 10) {
        checkoutData.shippingAddress = newAddress.trim();
        
        // Update UI
        const addressText = document.querySelector('.address-text');
        if (addressText) {
            addressText.innerHTML = newAddress.trim().replace(/\n/g, '<br>');
        }
        
        showNotification('Delivery address updated', 'success');
    } else if (newAddress) {
        showNotification('Please enter a valid address (minimum 10 characters)', 'error');
    }
}

// Change payment method handler
function changePaymentMethod() {
    const paymentOptions = `Choose payment method:
1. Credit Card
2. Debit Card
3. GCash
4. PayPal
5. Bank Transfer
6. Cash on Delivery`;

    const choice = prompt(paymentOptions, '1');
    
    const paymentMethods = {
        '1': { method: 'credit_card', display: 'Credit Card' },
        '2': { method: 'debit_card', display: 'Debit Card' },
        '3': { method: 'gcash', display: 'GCash' },
        '4': { method: 'paypal', display: 'PayPal' },
        '5': { method: 'bank_transfer', display: 'Bank Transfer' },
        '6': { method: 'cod', display: 'Cash on Delivery' }
    };

    if (choice && paymentMethods[choice]) {
        const selected = paymentMethods[choice];
        checkoutData.paymentMethod = selected.method;
        checkoutData.cardType = selected.display;
        
        // Update UI
        const cardTypeElement = document.querySelector('.card-type');
        if (cardTypeElement) {
            cardTypeElement.textContent = selected.display;
        }
        
        showNotification(`Payment method changed to ${selected.display}`, 'success');
    }
}

// Place order
async function placeOrder() {
    if (!checkAuth()) return;

    // Validate checkout data
    if (!checkoutData.shippingAddress || checkoutData.shippingAddress.length < 10) {
        showNotification('Please enter a valid shipping address', 'error');
        changeAddress();
        return;
    }

    try {
        showLoading(true);
        const token = getAuthToken();
        
        const orderData = {
            shipping_address: checkoutData.shippingAddress,
            billing_address: checkoutData.shippingAddress,
            payment_method: checkoutData.paymentMethod,
            notes: `Payment via ${checkoutData.cardType}`
        };

        console.log('Creating order with data:', orderData);

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        console.log('Order response:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create order');
        }

        const data = await response.json();
        console.log('Order created successfully:', data);
        showLoading(false);
        
        // Show success message
        showSuccessModal(data.order || data);
        
    } catch (error) {
        showLoading(false);
        console.error('Error creating order:', error);
        showNotification(error.message || 'Failed to create order', 'error');
    }
}

// Show success modal
function showSuccessModal(order) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 40px;
            border-radius: 15px;
            text-align: center;
            max-width: 500px;
            animation: slideUp 0.3s ease;
        ">
            <i class="fas fa-check-circle" style="font-size: 4rem; color: #28a745; margin-bottom: 20px;"></i>
            <h2 style="font-family: 'Playfair Display', serif; margin-bottom: 15px;">Order Placed Successfully!</h2>
            <p style="color: #666; margin-bottom: 10px;">Order Number: <strong>${order.order_number || 'N/A'}</strong></p>
            <p style="color: #666; margin-bottom: 20px;">Total: <strong>${formatCurrency(order.total_amount || order.total || 0)}</strong></p>
            <p style="color: #888; font-size: 0.9rem; margin-bottom: 30px;">
                Your order has been placed successfully. You will receive a confirmation email shortly.
            </p>
            <button onclick="window.location.href='./orders.html'" style="
                background: #2c2c2c;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 0.9rem;
                margin-right: 10px;
            ">View Orders</button>
            <button onclick="window.location.href='/'" style="
                background: #dcdcdc;
                color: #444;
                border: none;
                padding: 12px 30px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 0.9rem;
            ">Continue Shopping</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Show loading state
function showLoading(show) {
    const placeOrderBtn = document.querySelector('.btn-place-order');
    if (!placeOrderBtn) return;
    
    if (show) {
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        placeOrderBtn.style.opacity = '0.6';
    } else {
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = 'Place Order';
        placeOrderBtn.style.opacity = '1';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: 'Lato', sans-serif;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Initialize checkout page
async function initCheckout() {
    console.log('=== Initializing Checkout ===');
    console.log('Current URL:', window.location.href);
    
    if (!checkAuth()) {
        console.error('Auth check failed');
        return;
    }

    try {
        showLoading(true);
        
        // Fetch cart data
        console.log('Fetching cart data...');
        const cartData = await fetchCart();
        
        if (!cartData) {
            console.error('No cart data received');
            showLoading(false);
            return;
        }
        
        // Check if cart is empty
        if (!cartData.items || cartData.items.length === 0) {
            alert('Your cart is empty. Redirecting to shop...');
            window.location.href = '/shop.html';
            return;
        }
        
        console.log('Cart has', cartData.items.length, 'items');
        
        // Render order summary
        renderOrderSummary(cartData);
        
        showLoading(false);
        console.log('Checkout initialized successfully');
    } catch (error) {
        showLoading(false);
        console.error('Error initializing checkout:', error);
        showNotification('Failed to load checkout data: ' + error.message, 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Checkout.js Loaded ===');
    
    // Initialize checkout page
    initCheckout();

    // Place order button
    const placeOrderBtn = document.querySelector('.btn-place-order');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', placeOrder);
        console.log('Place order button listener attached');
    }

    // Change address button
    const changeAddressBtn = document.querySelector('.content-card:nth-child(2) .btn-gray-pill');
    if (changeAddressBtn) {
        changeAddressBtn.addEventListener('click', changeAddress);
        console.log('Change address button listener attached');
    }

    // Change payment method button
    const changePaymentBtn = document.querySelector('.content-card:nth-child(3) .btn-gray-pill');
    if (changePaymentBtn) {
        changePaymentBtn.addEventListener('click', changePaymentMethod);
        console.log('Change payment button listener attached');
    }
});