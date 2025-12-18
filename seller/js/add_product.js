// add_product.js - Product creation functionality

const API_BASE_URL = 'https://relo-24j8.onrender.com/api';

// Get seller ID from session/localStorage
function getSellerId() {
    return localStorage.getItem('seller_id') || sessionStorage.getItem('seller_id');
}

// Image preview functionality
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            event.target.value = '';
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image file');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            const preview = document.getElementById('imagePreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Handle form submission
async function handleProductSubmit(event) {
    event.preventDefault();

    const sellerId = getSellerId();
    if (!sellerId) {
        alert('Please login as a seller first');
        window.location.href = 'login.html';
        return;
    }

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    try {
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Product...';

        // Create FormData object
        const formData = new FormData();
        formData.append('seller_id', sellerId);
        formData.append('name', form.productName.value.trim());
        formData.append('category', form.category.value);
        formData.append('price', parseFloat(form.price.value));
        formData.append('stock', parseInt(form.stock.value));
        formData.append('description', form.description.value.trim());

        // Add image if selected
        const imageInput = document.getElementById('imageInput');
        if (imageInput.files.length > 0) {
            formData.append('image', imageInput.files[0]);
        }

        // Optional fields (if you add them to the form)
        if (form.material) {
            formData.append('material', form.material.value.trim());
        }
        if (form.caseSize) {
            formData.append('case_size', form.caseSize.value.trim());
        }
        if (form.referenceNumber) {
            formData.append('reference_number', form.referenceNumber.value.trim());
        }

        // Send request to API
        const response = await fetch(`${API_BASE_URL}/seller/products`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to add product');
        }

        // Success
        alert('Product added successfully!');
        form.reset();
        document.getElementById('imagePreview').style.display = 'none';

        // Redirect to inventory page
        setTimeout(() => {
            window.location.href = 'inventory.html';
        }, 1000);

    } catch (error) {
        console.error('Error adding product:', error);
        alert('Error: ' + error.message);
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Handle form reset
function handleFormReset() {
    document.getElementById('imagePreview').style.display = 'none';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('productForm');
    const imageInput = document.getElementById('imageInput');

    if (form) {
        form.addEventListener('submit', handleProductSubmit);
        form.addEventListener('reset', handleFormReset);
    }

    if (imageInput) {
        imageInput.addEventListener('change', previewImage);
    }

    // Check if seller is logged in
    const sellerId = getSellerId();
    if (!sellerId) {
        console.warn('No seller ID found. User may need to login.');
    }
});

// Export functions for use in HTML
window.previewImage = previewImage;