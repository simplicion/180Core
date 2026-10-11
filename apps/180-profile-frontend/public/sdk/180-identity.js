/**
 * 180 Identity & 180 Pay Client Embed SDK (v1.1.0)
 * Universal, Zero-Dependency Authentication & Checkout SDK for 180 Workspace and the 180 Ecosystem.
 * Supports Razorpay-style responsive in-page bottom sheets & glass modals across mobile and desktop.
 * Standards: RFC 6749 (OAuth 2.0), OpenID Connect Core 1.0, RFC 7636 (PKCE)
 */
(function (global) {
  'use strict';

  var DEFAULT_AUTH_SERVER = 'http://localhost:3009';
  var DEFAULT_PAY_SERVER = 'http://localhost:3009';
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname.endsWith('180workspace.com')) {
      DEFAULT_AUTH_SERVER = 'https://profile.180workspace.com';
      DEFAULT_PAY_SERVER = 'https://pay.180workspace.com';
    } else {
      DEFAULT_AUTH_SERVER = window.location.origin;
      DEFAULT_PAY_SERVER = window.location.origin;
    }
  }

  function isMobileDevice() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  var BOTTOM_SHEET_STYLE_ID = '__180_bottom_sheet_styles__';

  function injectBottomSheetCSS() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(BOTTOM_SHEET_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = BOTTOM_SHEET_STYLE_ID;
    style.textContent = [
      '@keyframes one-eighty-fade-in { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes one-eighty-fade-out { from { opacity: 1; } to { opacity: 0; } }',
      '@keyframes one-eighty-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }',
      '@keyframes one-eighty-slide-down { from { transform: translateY(0); } to { transform: translateY(100%); } }',
      '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function openInBottomSheet(opts) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('[180 SDK] Bottom sheet requires a browser environment'));
    }

    var existingSheet = document.getElementById('__180_bottom_sheet_container__');
    if (existingSheet) existingSheet.remove();

    injectBottomSheetCSS();

    return new Promise(function (resolve, reject) {
      var isResolved = false;

      var root = document.createElement('div');
      root.id = '__180_bottom_sheet_container__';
      root.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 999999',
        'display: flex',
        'flex-direction: column',
        'justify-content: flex-end',
        'align-items: center',
        'pointer-events: auto',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ].join(';');

      var backdrop = document.createElement('div');
      backdrop.style.cssText = [
        'position: fixed',
        'inset: 0',
        'background: rgba(0, 0, 0, 0.72)',
        'backdrop-filter: blur(8px)',
        '-webkit-backdrop-filter: blur(8px)',
        'animation: one-eighty-fade-in 0.25s ease-out forwards',
        'cursor: pointer'
      ].join(';');

      var isMobile = isMobileDevice();
      var sheet = document.createElement('div');
      sheet.style.cssText = [
        'position: relative',
        'z-index: 1000000',
        'width: 100%',
        'max-width: ' + (isMobile ? '100%' : '480px'),
        'height: ' + (isMobile ? '90vh' : '700px'),
        'max-height: 94vh',
        'margin: ' + (isMobile ? '0' : '0 0 24px 0'),
        'background: #09090b',
        'color: #fafafa',
        'border: 1px solid rgba(255, 255, 255, 0.12)',
        'border-radius: ' + (isMobile ? '24px 24px 0 0' : '24px'),
        'box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.65), 0 20px 48px rgba(0, 0, 0, 0.85)',
        'display: flex',
        'flex-direction: column',
        'overflow: hidden',
        'animation: one-eighty-slide-up 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      ].join(';');

      // Header with handle bar and close button
      var header = document.createElement('div');
      header.style.cssText = [
        'flex-shrink: 0',
        'padding: 10px 16px 8px 16px',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'border-bottom: 1px solid rgba(255, 255, 255, 0.08)',
        'background: #09090b',
        'position: relative'
      ].join(';');

      var grabBar = document.createElement('div');
      grabBar.style.cssText = [
        'width: 44px',
        'height: 4px',
        'border-radius: 9999px',
        'background: rgba(255, 255, 255, 0.22)',
        'margin-bottom: 8px'
      ].join(';');
      header.appendChild(grabBar);

      var bar = document.createElement('div');
      bar.style.cssText = [
        'width: 100%',
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'gap: 12px'
      ].join(';');

      var titleWrap = document.createElement('div');
      titleWrap.style.cssText = 'display: flex; align-items: center; gap: 8px; min-width: 0;';
      titleWrap.innerHTML = '<div style="font-size: 13px; font-weight: 700; color: #f4f4f5; letter-spacing: -0.01em;">' + (opts.title || '180 Identity') + '</div>';

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.style.cssText = [
        'width: 28px',
        'height: 28px',
        'border-radius: 50%',
        'background: rgba(255, 255, 255, 0.08)',
        'border: 1px solid rgba(255, 255, 255, 0.1)',
        'color: #a1a1aa',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'cursor: pointer',
        'padding: 0',
        'outline: none'
      ].join(';');
      closeBtn.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';

      bar.appendChild(titleWrap);
      bar.appendChild(closeBtn);
      header.appendChild(bar);

      // Sandboxed Iframe
      var iframeWrapper = document.createElement('div');
      iframeWrapper.style.cssText = 'flex: 1; width: 100%; height: 100%; position: relative; background: #09090b; overflow: hidden;';

      var iframe = document.createElement('iframe');
      iframe.src = opts.url;
      iframe.title = opts.title || '180 Identity';
      iframe.allow = 'clipboard-write; payment; geolocation';
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: transparent;';

      iframeWrapper.appendChild(iframe);
      sheet.appendChild(header);
      sheet.appendChild(iframeWrapper);
      root.appendChild(backdrop);
      root.appendChild(sheet);
      document.body.appendChild(root);

      function closeSheet(dismissedByUser) {
        window.removeEventListener('message', messageListener);
        window.removeEventListener('keydown', keydownListener);
        sheet.style.animation = 'one-eighty-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        backdrop.style.animation = 'one-eighty-fade-out 0.25s ease-in forwards';
        setTimeout(function () {
          root.remove();
        }, 250);

        if (dismissedByUser && !isResolved) {
          if (opts.onCancel) opts.onCancel();
          resolve({ code: '', state: opts.state || '' });
        }
      }

      function messageListener(event) {
        if (!event.data) return;
        if (event.data.type === '180_IDENTITY_ERROR' || event.data.type === '180_AUTH_ERROR') {
          var errMessage = event.data.error_description || event.data.error || 'Authentication failed';
          var err = new Error(errMessage);
          err.data = event.data;
          if (opts.onError) opts.onError(err);
          return;
        }
        if (opts.closeTypes && opts.closeTypes.indexOf(event.data.type) !== -1) {
          closeSheet(false);
          return;
        }
        if (opts.successTypes && opts.successTypes.indexOf(event.data.type) !== -1) {
          isResolved = true;
          var result = opts.mapSuccess ? opts.mapSuccess(event.data) : event.data;
          if (opts.onSuccess) opts.onSuccess(result);
          resolve(result);
          closeSheet(false);
        }
      }

      function keydownListener(e) {
        if (e.key === 'Escape') closeSheet(true);
      }

      backdrop.onclick = function () { closeSheet(true); };
      closeBtn.onclick = function () { closeSheet(true); };
      root.onclick = function (e) {
        if (e.target === root || e.target === backdrop || (sheet && !sheet.contains(e.target))) {
          closeSheet(true);
        }
      };
      window.addEventListener('message', messageListener);
      window.addEventListener('keydown', keydownListener);
    });
  }

  var OneEightyIdentity = {
    version: '1.1.0',
    isMobileDevice: isMobileDevice,

    /**
     * Universal Auth with Razorpay-style responsive in-page bottom sheet
     */
    openAuth: function (options) {
      options = options || {};
      var clientId = options.clientId;
      if (!clientId) {
        throw new Error('[180 Identity] Missing required option: clientId');
      }

      var authServer = options.authServerUrl || DEFAULT_AUTH_SERVER;
      var redirectUri = options.redirectUri || (typeof window !== 'undefined' ? window.location.origin + '/oauth/callback' : '');
      var scope = options.scope || 'openid identity:read identity:email';
      var state = options.state || Math.random().toString(36).substring(2, 15);
      var responseType = options.responseType || 'code';

      // Detect mobile vs desktop
      var isMobile = (typeof window !== 'undefined') && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
      var uxMode = options.uxMode;
      if (!uxMode || uxMode === 'auto') {
        uxMode = isMobile ? 'bottom_sheet' : 'popup';
      }

      if (uxMode === 'redirect' || uxMode === 'fullscreen') {
        window.location.href = authServer + '/auth/login?client_id=' + encodeURIComponent(clientId) +
          '&redirect_uri=' + encodeURIComponent(redirectUri) +
          '&scope=' + encodeURIComponent(scope) +
          '&state=' + encodeURIComponent(state) +
          '&response_type=' + encodeURIComponent(responseType) +
          '&ux_mode=redirect';
        return Promise.resolve({ code: '', state: state });
      }

      if (uxMode === 'popup') {
        var width = 450;
        var height = 680;
        var left = (typeof window !== 'undefined' && window.screen.width) ? (window.screen.width - width) / 2 : 100;
        var top = (typeof window !== 'undefined' && window.screen.height) ? (window.screen.height - height) / 2 : 100;
        var popupUrl = authServer + '/auth/login?client_id=' + encodeURIComponent(clientId) +
          '&redirect_uri=' + encodeURIComponent(redirectUri) +
          '&scope=' + encodeURIComponent(scope) +
          '&state=' + encodeURIComponent(state) +
          '&response_type=' + encodeURIComponent(responseType) +
          '&ux_mode=popup';

        var popup = typeof window !== 'undefined'
          ? window.open(popupUrl, '180_identity_auth', 'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',scrollbars=yes,status=no,toolbar=no,resizable=yes')
          : null;

        if (popup && typeof popup.focus === 'function') {
          try { popup.focus(); } catch (_) {}
        }

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // If popup is blocked by browser, degrade seamlessly to bottom sheet
          return OneEightyIdentity.openBottomSheet(options);
        }

        return new Promise(function (resolve, reject) {
          var isResolved = false;
          var pollTimer = null;

          var messageListener = function (event) {
            if (!event.data) return;
            if (event.data.type === '180_IDENTITY_ERROR' || event.data.type === '180_AUTH_ERROR') {
              var errMessage = event.data.error_description || event.data.error || 'Authentication failed';
              var err = new Error(errMessage);
              err.data = event.data;
              if (options.onError) options.onError(err);
              return;
            }
            if (event.data.type !== '180_IDENTITY_SUCCESS' && event.data.type !== '180_AUTH_SUCCESS') {
              return;
            }

            isResolved = true;
            if (typeof window !== 'undefined') {
              window.removeEventListener('message', messageListener);
            }
            if (pollTimer) clearInterval(pollTimer);

            var bestToken = event.data.authToken || event.data.accessToken || event.data.token || null;
            var result = {
              code: event.data.code,
              state: event.data.state || state,
              token: bestToken,
              id_token: event.data.id_token || null,
              user: event.data.user || null
            };

            if (bestToken && typeof window !== 'undefined') {
              try {
                localStorage.setItem('platform_auth_token', bestToken);
                localStorage.setItem('token', bestToken);
              } catch (_) {}
            }

            if (options.onSuccess) options.onSuccess(result);
            resolve(result);
          };

          if (typeof window !== 'undefined') {
            window.addEventListener('message', messageListener);
          }

          pollTimer = setInterval(function () {
            if (popup.closed) {
              clearInterval(pollTimer);
              if (typeof window !== 'undefined') {
                window.removeEventListener('message', messageListener);
              }
              if (!isResolved) {
                if (options.onCancel) options.onCancel();
                resolve({ code: '', state: state, token: null, id_token: null, user: null });
              }
            }
          }, 500);
        });
      }

      var authUrl = authServer + '/auth/login?client_id=' + encodeURIComponent(clientId) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&scope=' + encodeURIComponent(scope) +
        '&state=' + encodeURIComponent(state) +
        '&response_type=' + encodeURIComponent(responseType) +
        '&ux_mode=bottom_sheet';

      return openInBottomSheet({
        url: authUrl,
        title: '180 Identity',
        state: state,
        successTypes: ['180_IDENTITY_SUCCESS', '180_AUTH_SUCCESS'],
        closeTypes: ['180_IDENTITY_CLOSE'],
        mapSuccess: function (data) {
          var bestToken = data.authToken || data.accessToken || data.token || null;
          return {
            code: data.code,
            state: data.state || state,
            token: bestToken,
            id_token: data.id_token || null,
            user: data.user || null
          };
        },
        onSuccess: options.onSuccess,
        onError: options.onError,
        onCancel: options.onCancel
      });
    },

    openBottomSheet: function (options) {
      return OneEightyIdentity.openAuth(Object.assign({}, options, { uxMode: 'bottom_sheet' }));
    },

    openPopup: function (options) {
      return OneEightyIdentity.openAuth(Object.assign({}, options, { uxMode: 'popup' }));
    },

    renderButton: function (target, options) {
      options = options || {};
      var element = typeof target === 'string' ? document.getElementById(target) : target;
      if (!element) throw new Error('[180 Identity] Target element not found');

      var text = options.text || 'Continue with 180 Profile';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'one-eighty-identity-button';
      btn.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'gap: 10px',
        'background: #0f172a',
        'color: #f8fafc',
        'border: 1px solid rgba(99, 102, 241, 0.4)',
        'border-radius: 12px',
        'padding: 10px 18px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size: 14px',
        'font-weight: 600',
        'cursor: pointer',
        'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)',
        'transition: all 0.2s ease',
        'outline: none'
      ].join(';');

      var icon = document.createElement('span');
      icon.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #6366f1, #a855f7); color: #ffffff; font-size: 10px; font-weight: 900;';
      icon.innerText = '180';

      var label = document.createElement('span');
      label.innerText = text;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.onclick = function () { OneEightyIdentity.openBottomSheet(options); };

      element.innerHTML = '';
      element.appendChild(btn);
    }
  };

  var OneEightyPay = {
    version: '1.1.0',
    checkout: function (options) {
      options = options || {};
      var sessionId = options.sessionId || ('sess_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now());
      var payServer = options.checkoutServerUrl || DEFAULT_PAY_SERVER;

      var query = [
        options.amount ? 'amount=' + encodeURIComponent(options.amount) : '',
        options.currency ? 'currency=' + encodeURIComponent(options.currency) : '',
        options.title ? 'title=' + encodeURIComponent(options.title) : '',
        options.description ? 'description=' + encodeURIComponent(options.description) : '',
        options.couponCode ? 'coupon=' + encodeURIComponent(options.couponCode) : '',
        'ux_mode=bottom_sheet'
      ].filter(Boolean).join('&');

      var checkoutUrl = payServer + '/checkout/' + encodeURIComponent(sessionId) + (query ? '?' + query : '');

      return openInBottomSheet({
        url: checkoutUrl,
        title: options.title || 'Secure Payment',
        successTypes: ['180_PAYMENT_SUCCESS', '180_PAY_SUCCESS'],
        closeTypes: ['180_PAYMENT_CLOSE'],
        mapSuccess: function (data) {
          return {
            sessionId: data.sessionId || sessionId,
            transactionId: data.transactionId,
            amount: data.amount || options.amount,
            currency: data.currency || options.currency,
            isFree: Boolean(data.isFree)
          };
        },
        onSuccess: options.onSuccess,
        onError: options.onError,
        onCancel: options.onCancel
      });
    }
  };

  global.OneEightyIdentity = OneEightyIdentity;
  global.OneEightyPay = OneEightyPay;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      OneEightyIdentity: OneEightyIdentity,
      OneEightyPay: OneEightyPay
    };
  }
})(typeof window !== 'undefined' ? window : global);
