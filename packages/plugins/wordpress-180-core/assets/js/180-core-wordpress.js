/**
 * 180 Core WordPress & WooCommerce Integration Bridge
 * CSP-compliant click delegation for Universal 180 Identity bottom sheet
 */
(function() {
    'use strict';

    document.addEventListener('click', function(e) {
        var trigger = e.target.closest('[data-180-auth-trigger]');
        if (!trigger) return;

        if (window.OneEighty && window.OneEighty.auth) {
            e.preventDefault();
            var config = window.oneEightyCoreConfig || {};
            var clientId = trigger.getAttribute('data-180-client-id') || config.clientId;
            var redirectUri = trigger.getAttribute('data-180-redirect-uri') || (window.location.origin + '/?180core_auth=callback');

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
        }
    });
})();
