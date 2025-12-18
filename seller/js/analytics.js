// Analytics JavaScript - Timeless Treasures
const API_URL = 'https://relo-24j8.onrender.com/api';

// State management
let currentPeriod = 'month';
let sellerId = null;
let revenueChart = null;
let categoryChart = null;
let statusChart = null;
let serverStatus = 'unknown';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Get seller ID from localStorage
    sellerId = localStorage.getItem('seller_id');
    
    if (!sellerId) {
        showError('Please log in first', true);
        setTimeout(() => {
            window.location.href = 'seller_login.html';
        }, 2000);
        return;
    }

    // Check if server is running
    const isServerRunning = await checkServerStatus();
    if (!isServerRunning) {
        showServerError();
        return;
    }

    // Load all analytics data
    await loadAnalytics();
    
    // Set up period selector event listeners
    setupPeriodSelector();
});

// Set up period selector
function setupPeriodSelector() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const period = e.target.textContent.toLowerCase();
            setPeriod(period);
        });
    });
}

// Check if server is running
async function checkServerStatus() {
    try {
        showLoader('Connecting to server...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for Render
        
        // Check using a valid endpoint that doesn't require /api prefix
        const response = await fetch(`https://relo-24j8.onrender.com/`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        serverStatus = response.ok ? 'online' : 'offline';
        return response.ok;
    } catch (error) {
        console.error('Server check failed:', error);
        serverStatus = 'offline';
        return false;
    }
}

// Show server error message
function showServerError() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 100px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #ff9800; margin-bottom: 20px;"></i>
                <h2 style="font-family: 'Playfair Display', serif; margin-bottom: 15px;">Unable to Connect to Server</h2>
                <p style="color: #666; margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">
                    Cannot connect to the backend server at <strong>relo-24j8.onrender.com</strong>. 
                    The server might be starting up or temporarily unavailable.
                </p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; text-align: left;">
                    <h3 style="font-family: 'Playfair Display', serif; margin-bottom: 10px;">Possible reasons:</h3>
                    <ul style="margin-left: 20px; color: #333; line-height: 1.8;">
                        <li>Server is waking up from sleep (Render free tier)</li>
                        <li>Server is deploying a new version</li>
                        <li>Temporary network issue</li>
                        <li>CORS configuration needed</li>
                    </ul>
                    <p style="margin-top: 15px; color: #666; font-size: 0.9rem;">
                        <strong>Tip:</strong> Render's free tier servers sleep after inactivity. 
                        First request may take 30-60 seconds to wake up the server.
                    </p>
                </div>
                <button onclick="location.reload()" style="margin-top: 30px; padding: 12px 30px; background: #000; color: #fff; border: none; cursor: pointer; font-family: 'Playfair Display', serif; font-size: 1rem;">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Change time period
async function setPeriod(period) {
    currentPeriod = period;
    
    // Update active button
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) {
            btn.classList.add('active');
        }
    });
    
    // Reload revenue chart with new period
    await loadRevenueAnalytics();
}

// Load all analytics data
async function loadAnalytics() {
    try {
        showLoader();
        
        // Load all data in parallel
        await Promise.all([
            loadStats(),
            loadRevenueAnalytics(),
            loadTopProducts(),
            loadCategoryDistribution(),
            loadOrderStatus()
        ]);
        
        hideLoader();
    } catch (error) {
        console.error('Error loading analytics:', error);
        hideLoader();
        showError('Failed to load analytics data');
    }
}

// Load dashboard stats
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/seller/stats?seller_id=${sellerId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Calculate average order value
        const avgOrder = data.total_orders > 0 
            ? data.revenue / data.total_orders 
            : 0;
        
        // Update stat cards
        updateStatCard(0, formatCurrency(data.revenue), '12.5% from last month');
        updateStatCard(1, data.total_orders.toString(), '8.3% from last month');
        updateStatCard(2, formatCurrency(avgOrder), '2.1% from last month');
        updateStatCard(3, data.pending_orders.toString(), '15.7% from last month');
        
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show placeholder data instead of breaking
        updateStatCard(0, '₱0', 'Unable to load');
        updateStatCard(1, '0', 'Unable to load');
        updateStatCard(2, '₱0', 'Unable to load');
        updateStatCard(3, '0', 'Unable to load');
    }
}

// Update stat card
function updateStatCard(index, value, change) {
    const cards = document.querySelectorAll('.stat-card');
    if (cards[index]) {
        const valueEl = cards[index].querySelector('.stat-value');
        if (valueEl) valueEl.textContent = value;
    }
}

// Load revenue analytics
async function loadRevenueAnalytics() {
    try {
        const response = await fetch(
            `${API_URL}/seller/analytics/revenue?seller_id=${sellerId}&period=${currentPeriod}`
        );
        if (!response.ok) throw new Error('Failed to fetch revenue analytics');
        
        const result = await response.json();
        const data = result.data || [];
        
        // Prepare chart data
        const labels = data.map(item => formatDate(item.date)).reverse();
        const revenues = data.map(item => item.revenue).reverse();
        const orders = data.map(item => item.order_count).reverse();
        
        // Create or update chart
        createRevenueChart(labels, revenues, orders);
        
    } catch (error) {
        console.error('Error loading revenue analytics:', error);
    }
}

// Create revenue chart
function createRevenueChart(labels, revenues, orders) {
    const chartContainer = document.querySelector('.chart-section .chart-placeholder');
    
    if (!chartContainer) return;
    
    // Replace placeholder with canvas
    chartContainer.innerHTML = '<canvas id="revenueChart"></canvas>';
    const canvas = document.getElementById('revenueChart');
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if exists
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    // Create simple line chart
    drawLineChart(ctx, canvas, labels, revenues, 'Revenue (₱)', '#4caf50');
}

// Draw simple line chart
function drawLineChart(ctx, canvas, labels, data, label, color) {
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 300;
    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Find min and max
    const maxValue = Math.max(...data, 0);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;
    
    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw grid lines and Y-axis labels
    ctx.fillStyle = '#888';
    ctx.font = '12px Lato';
    ctx.textAlign = 'right';
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding + (chartHeight / gridLines) * i;
        const value = maxValue - (range / gridLines) * i;
        
        // Grid line
        ctx.strokeStyle = '#f0f0f0';
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        // Label
        ctx.fillText(formatCompactNumber(value), padding - 10, y + 4);
    }
    
    // Draw X-axis labels
    ctx.textAlign = 'center';
    const labelStep = Math.ceil(labels.length / 8);
    labels.forEach((label, i) => {
        if (i % labelStep === 0 || i === labels.length - 1) {
            const x = padding + (chartWidth / (labels.length - 1)) * i;
            ctx.fillText(label, x, height - padding + 20);
        }
    });
    
    // Draw line
    if (data.length > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        data.forEach((value, i) => {
            const x = padding + (chartWidth / (data.length - 1)) * i;
            const y = height - padding - ((value - minValue) / range) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = color;
        data.forEach((value, i) => {
            const x = padding + (chartWidth / (data.length - 1)) * i;
            const y = height - padding - ((value - minValue) / range) * chartHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Lato';
    ctx.textAlign = 'left';
    ctx.fillText(label, padding, padding - 20);
}

// Load top products
async function loadTopProducts() {
    try {
        const response = await fetch(
            `${API_URL}/seller/analytics/top-products?seller_id=${sellerId}&limit=5`
        );
        if (!response.ok) throw new Error('Failed to fetch top products');
        
        const result = await response.json();
        const products = result.products || [];
        
        // Update top products list
        const container = document.querySelector('.top-products');
        if (!container) return;
        
        // Keep the header
        const header = container.querySelector('.chart-header');
        container.innerHTML = '';
        if (header) container.appendChild(header);
        
        if (products.length === 0) {
            container.innerHTML += '<div style="padding: 40px; text-align: center; color: #888;">No sales data available yet</div>';
            return;
        }
        
        // Add product rows
        products.forEach((product, index) => {
            const rankColors = ['#000', '#666', '#999', '#aaa', '#bbb'];
            const row = document.createElement('div');
            row.className = 'product-row';
            row.innerHTML = `
                <div class="product-info">
                    <div class="product-rank" style="background: ${rankColors[index]};">${index + 1}</div>
                    <div>
                        <div class="product-name">${escapeHtml(product.name)}</div>
                        <div class="product-category">${escapeHtml(product.category || 'Uncategorized')} • ${product.total_sold} sold</div>
                    </div>
                </div>
                <div class="product-sales">${formatCurrency(product.total_revenue)}</div>
            `;
            container.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading top products:', error);
    }
}

// Load category distribution
async function loadCategoryDistribution() {
    try {
        // Get products to calculate category distribution
        const response = await fetch(`${API_URL}/seller/products?seller_id=${sellerId}`);
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const result = await response.json();
        const products = result.products || [];
        
        // Count by category
        const categoryCount = {};
        products.forEach(product => {
            const category = product.category || 'Uncategorized';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        // Create pie chart
        const canvas = document.querySelector('.charts-row .chart-section:first-child .chart-placeholder');
        if (canvas) {
            canvas.innerHTML = '<canvas id="categoryChart"></canvas>';
            const ctx = document.getElementById('categoryChart').getContext('2d');
            drawPieChart(ctx, categoryCount);
        }
        
    } catch (error) {
        console.error('Error loading category distribution:', error);
    }
}

// Draw pie chart
function drawPieChart(ctx, data) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 250;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    
    ctx.clearRect(0, 0, width, height);
    
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px Lato';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', centerX, centerY);
        return;
    }
    
    const colors = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#00bcd4'];
    let startAngle = -Math.PI / 2;
    
    Object.entries(data).forEach(([category, count], index) => {
        const sliceAngle = (count / total) * 2 * Math.PI;
        
        // Draw slice
        ctx.fillStyle = colors[index % colors.length];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();
        
        // Draw label
        const labelAngle = startAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius + 25);
        const labelY = centerY + Math.sin(labelAngle) * (radius + 25);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px Lato';
        ctx.textAlign = labelX > centerX ? 'left' : 'right';
        ctx.fillText(`${category} (${count})`, labelX, labelY);
        
        startAngle += sliceAngle;
    });
}

// Load order status distribution
async function loadOrderStatus() {
    try {
        const response = await fetch(`${API_URL}/seller/orders?seller_id=${sellerId}&limit=1000`);
        if (!response.ok) throw new Error('Failed to fetch orders');
        
        const result = await response.json();
        const orders = result.orders || [];
        
        // Count by status
        const statusCount = {};
        orders.forEach(order => {
            const status = order.status || 'UNKNOWN';
            statusCount[status] = (statusCount[status] || 0) + 1;
        });
        
        // Create bar chart
        const canvas = document.querySelector('.charts-row .chart-section:last-child .chart-placeholder');
        if (canvas) {
            canvas.innerHTML = '<canvas id="statusChart"></canvas>';
            const ctx = document.getElementById('statusChart').getContext('2d');
            drawBarChart(ctx, statusCount);
        }
        
    } catch (error) {
        console.error('Error loading order status:', error);
    }
}

// Draw bar chart
function drawBarChart(ctx, data) {
    const canvas = ctx.canvas;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 250;
    const padding = 40;
    const chartHeight = height - padding * 2;
    
    ctx.clearRect(0, 0, width, height);
    
    const entries = Object.entries(data);
    if (entries.length === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px Lato';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }
    
    const maxValue = Math.max(...Object.values(data));
    const barWidth = (width - padding * 2) / entries.length - 20;
    const colors = {
        'PENDING': '#ff9800',
        'PROCESSING': '#2196f3',
        'SHIPPED': '#9c27b0',
        'DELIVERED': '#4caf50',
        'CANCELLED': '#f44336'
    };
    
    entries.forEach(([status, count], index) => {
        const barHeight = (count / maxValue) * chartHeight;
        const x = padding + index * (barWidth + 20);
        const y = height - padding - barHeight;
        
        // Draw bar
        ctx.fillStyle = colors[status] || '#666';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw value on top
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Lato';
        ctx.textAlign = 'center';
        ctx.fillText(count, x + barWidth / 2, y - 5);
        
        // Draw label
        ctx.font = '11px Lato';
        ctx.fillText(status, x + barWidth / 2, height - padding + 20);
    });
}

// Utility Functions
function formatCurrency(amount) {
    return '₱' + parseFloat(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function formatCompactNumber(num) {
    if (num >= 1000000) {
        return '₱' + (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return '₱' + (num / 1000).toFixed(1) + 'K';
    }
    return '₱' + num.toFixed(0);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoader(message = 'Loading...') {
    let loader = document.getElementById('loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-size: 1.2rem;
            color: #333;
            gap: 15px;
        `;
        document.body.appendChild(loader);
    }
    loader.innerHTML = `
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
        <div style="font-family: 'Playfair Display', serif;">${message}</div>
    `;
    loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function showError(message, persistent = false) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Lato', sans-serif;
        max-width: 400px;
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> ${message}
    `;
    document.body.appendChild(errorDiv);
    
    if (!persistent) {
        setTimeout(() => {
            errorDiv.style.opacity = '0';
            errorDiv.style.transition = 'opacity 0.3s';
            setTimeout(() => errorDiv.remove(), 300);
        }, 4000);
    }
}