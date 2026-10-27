/**
 * 180 Core WordPress & WooCommerce Integration Bridge
 * CSP-compliant click delegation for Universal 180 Identity and 180 Pay bottom sheet
 */
(function() {
    'use strict';

    document.addEventListener('click', function(e) {
        // Handler 1: 180 Identity SSO Trigger
        var authTrigger = e.target.closest('[data-180-auth-trigger]');
        if (authTrigger && window.OneEighty && window.OneEighty.auth) {
            e.preventDefault();
            var config = window.oneEightyCoreConfig || {};
            var clientId = authTrigger.getAttribute('data-180-client-id') || config.clientId;
            var redirectUri = authTrigger.getAttribute('data-180-redirect-uri') || (window.location.origin + '/?180core_auth=callback');

            window.OneEighty.auth.openBottomSheet({
                clientId: clientId,
                redirectUri: redirectUri,
                uxMode: 'bottom_sheet'
            }).then(function(res) {
                if (res && res.code) {
                    var sep = redirectUri.indexOf('?') !== -1 ? '&' : '?';
                    window.location.href = redirectUri + sep + 'code=' + encodeURIComponent(res.code) + '&state=' + encodeURIComponent(res.state || '');
                }
            }).catch(function(err) {
                console.error('[180 Identity] Authentication cancelled or failed:', err);
            });
            return;
        }

        // Handler 2: 180 Pay Universal Button Trigger (Bookings, Tickets, Donations, Custom Orders)
        var payTrigger = e.target.closest('[data-180-pay-trigger]');
        if (payTrigger && window.OneEighty && window.OneEighty.pay) {
            e.preventDefault();
            var payConfig = window.oneEightyCoreConfig || {};
            var amount = parseFloat(payTrigger.getAttribute('data-180-amount') || '0');
            var currency = payTrigger.getAttribute('data-180-currency') || 'INR';
            var title = payTrigger.getAttribute('data-180-title') || 'Payment';
            var orderId = payTrigger.getAttribute('data-180-order-id') || ('book_' + Math.random().toString(36).substring(2, 10));
            var returnUrl = payTrigger.getAttribute('data-180-return-url') || window.location.href;

            window.OneEighty.pay.openBottomSheet({
                amount: amount,
                currency: currency,
                title: title,
                orderId: orderId,
                returnUrl: returnUrl,
                clientId: payConfig.clientId,
                uxMode: 'bottom_sheet'
            }).then(function(res) {
                if (res && (res.status === 'completed' || res.transactionId)) {
                    try {
                        window.dispatchEvent(new CustomEvent('180:payment:success', { detail: res }));
                    } catch (_) {}

                    if (returnUrl) {
                        var separator = returnUrl.indexOf('?') !== -1 ? '&' : '?';
                        window.location.href = returnUrl + separator + '180_status=paid&180_order=' + encodeURIComponent(orderId) + '&180_txn=' + encodeURIComponent(res.transactionId || '');
                    }
                }
            }).catch(function(err) {
                console.error('[180 Pay] Checkout session cancelled or failed:', err);
            });
        }
    });
})();
