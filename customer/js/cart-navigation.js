// =====================================================
// Cart Navigation Handler
// Add this to both HTML files or include as a separate JS file
// =====================================================

(function() {
    'use strict';

    // Initialize cart navigation when DOM is ready
    function initCartNavigation() {
        console.log('Initializing cart navigation...');
        
        // Get all cart icons on the page
        const cartIcons = document.querySelectorAll('#cart-icon, .fa-shopping-cart');
        
        cartIcons.forEach(icon => {
            // Make sure icon is clickable
            icon.style.cursor = 'pointer';
            icon.parentElement.style.cursor = 'pointer';
            
            // Remove any existing click listeners
            const newIcon = icon.cloneNode(true);
            icon.parentNode.replaceChild(newIcon, icon);
            
            // Add click event listener to navigate to cart
            newIcon.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cart icon clicked, navigating to cart.html');
                window.location.href = 'cart.html';
            });

            // Also add to parent element if it exists
            if (newIcon.parentElement && newIcon.parentElement.id !== 'cart-icon') {
                newIcon.parentElement.addEventListener('click', function(e) {
                    if (e.target === newIcon || e.target.classList.contains('cart-badge')) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Cart parent clicked, navigating to cart.html');
                        window.location.href = 'cart.html';
                    }
                });
            }
        });

        console.log(`Cart navigation initialized for ${cartIcons.length} icon(s)`);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCartNavigation);
    } else {
        initCartNavigation();
    }

    // Re-initialize when cart UI is updated (in case badges are added)
    const originalUpdateCartUI = window.RolexStore?.updateCartUI;
    if (originalUpdateCartUI) {
        window.RolexStore.updateCartUI = function() {
            originalUpdateCartUI.call(window.RolexStore);
            // Re-apply cart navigation after UI update
            setTimeout(initCartNavigation, 100);
        };
    }

})();

// =====================================================
// Export for manual initialization if needed
// =====================================================
window.initCartNavigation = function() {
    const cartIcons = document.querySelectorAll('#cart-icon, .fa-shopping-cart');
    cartIcons.forEach(icon => {
        icon.style.cursor = 'pointer';
        icon.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'cart.html';
        };
    });
};