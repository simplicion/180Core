/**
 * 180 Core SDK (v1.0.0-sovereign)
 * Universal Zero-Dependency Client Engine for 180 Identity (Authentication/SSO) & 180 Pay (Checkout)
 * 
 * Standards: RFC 6749 (OAuth 2.0), OpenID Connect Core 1.0, RFC 7636 (PKCE S256)
 * Supported Platforms: Universal Web (React, Next.js, Vue, Angular, HTML/Vanilla, WordPress, Shopify)
 *                      Mobile WebViews (Flutter, React Native, Android WebView, iOS WKWebView)
 * 
 * CDN Delivery: https://cdn.180workspace.com/sdk/v1/180-core-sdk.js
 *               https://180workspace.com/sdk/v1/180-core-sdk.js
 */
(function (global) {
  'use strict';

  // ─── DOMAIN CONFIGURATION & DISCOVERY ─────────────────────────────────────
  var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  function resolveEnvironmentMode(customMode) {
    if (customMode === 'development' || customMode === 'local_monorepo') {
      return 'development';
    }
    if (customMode === 'production' || customMode === 'cloud') {
      return 'production';
    }
    // Explicit debug flag for internal 180 engineers testing local services
    if (isBrowser) {
      if (window.__180_INTERNAL_DEV__ === true || window.__180_ENV__ === 'development') {
        return 'development';
      }
      if (window.location.port === '3009' && window.__180_ENABLE_PORT_AUTODETECT__ === true) {
        return 'development';
      }
    }
    if (typeof process !== 'undefined' && process.env && process.env.ONE_EIGHTY_ENV === 'development') {
      return 'development';
    }
    // Third-party consumer applications testing on localhost, staging, or production default to 180 Sovereign Cloud
    return 'production';
  }

  function getDiagnosticHint(code) {
    switch (code) {
      case '180_ERR_ORIGIN_NOT_WHITELISTED':
      case 'unauthorized_client':
        return 'Origin (' + (isBrowser ? window.location.origin : '') + ') is not whitelisted. Register your domain or localhost in https://developers.180workspace.com under Allowed Origins.';
      case '180_ERR_INVALID_CLIENT_ID':
      case 'invalid_client':
        return 'Client ID is invalid or missing. Verify NEXT_PUBLIC_180_CLIENT_ID or create an app in https://developers.180workspace.com.';
      case '180_ERR_POPUP_BLOCKED':
        return 'Browser blocked opening popup. Trigger signIn from a direct user click or use uxMode: "bottom_sheet".';
      case '180_ERR_NETWORK_DISCONNECTED':
        return 'Failed to reach 180 Sovereign Cloud. Verify internet connectivity or check https://status.180workspace.com.';
      case '180_ERR_TIMEOUT':
        return 'Connection timed out waiting for 180 Identity server to respond.';
      default:
        return 'Consult 180 Core documentation at https://docs.180workspace.com for integration guidelines.';
    }
  }

  function generateReferenceCode(domainPrefix) {
    var prefix = domainPrefix || 'CORE';
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var rand = '';
    for (var i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return '180-' + prefix + '-' + rand;
  }

  var activeEnv = resolveEnvironmentMode();
  var DEFAULT_AUTH_SERVER = activeEnv === 'production' ? 'https://profile.180workspace.com' : 'http://localhost:3009';
  var DEFAULT_PAY_SERVER = activeEnv === 'production' ? 'https://pay.180workspace.com' : 'http://localhost:3009';
  var DEFAULT_API_SERVER = activeEnv === 'production' ? 'https://api.180workspace.com' : 'http://localhost:4002';

  // ─── INTELLIGENT DEVICE & VIEWPORT DETECTOR ───────────────────────────────
  function isMobileViewport() {
    if (!isBrowser) return false;
    var hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    var isNarrow = window.innerWidth < 768;
    var mobileUA = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    return (hasTouch && isNarrow) || mobileUA;
  }

  // ─── CRYPTOGRAPHIC UTILITIES (RFC 7636 PKCE S256) ──────────────────────────
  function generateRandomString(length) {
    var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    var result = '';
    if (isBrowser && window.crypto && window.crypto.getRandomValues) {
      var values = new Uint8Array(length);
      window.crypto.getRandomValues(values);
      for (var i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
      }
    } else {
      for (var j = 0; j < length; j++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    }
    return result;
  }

  function base64UrlEncode(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async function generatePkcePair() {
    var verifier = generateRandomString(64);
    var challenge = verifier;
    if (isBrowser && window.crypto && window.crypto.subtle) {
      try {
        var encoder = new TextEncoder();
        var data = encoder.encode(verifier);
        var digest = await window.crypto.subtle.digest('SHA-256', data);
        challenge = base64UrlEncode(digest);
      } catch (_) {
        challenge = verifier;
      }
    }
    return { verifier: verifier, challenge: challenge };
  }

  // ─── ADAPTIVE BOTTOM SHEET & GLASS MODAL DOM ENGINE ───────────────────────
  var STYLESHEET_ID = '__180_core_sdk_styles__';

  function injectCoreStyles() {
    if (!isBrowser || document.getElementById(STYLESHEET_ID)) return;
    var style = document.createElement('style');
    style.id = STYLESHEET_ID;
    style.textContent = [
      '@keyframes one-eighty-fade-in { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes one-eighty-fade-out { from { opacity: 1; } to { opacity: 0; } }',
      '@keyframes one-eighty-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }',
      '@keyframes one-eighty-slide-down { from { transform: translateY(0); } to { transform: translateY(100%); } }',
      '@keyframes one-eighty-scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }',
      '@keyframes one-eighty-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function openAdaptiveModal(options) {
    if (!isBrowser) {
      return Promise.reject(new Error('[180 Core SDK] Modal requires a browser environment'));
    }

    var existing = document.getElementById('__180_core_modal_root__');
    if (existing) existing.remove();

    injectCoreStyles();

    return new Promise(function (resolve, reject) {
      var isResolved = false;
      var isMobile = isMobileViewport();
      var isFullScreen = options.uxMode === 'full_page' || options.uxMode === 'fullscreen';

      // 1. Root Overlay
      var root = document.createElement('div');
      root.id = '__180_core_modal_root__';
      root.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 9999999',
        'display: flex',
        'flex-direction: column',
        isMobile && !isFullScreen ? 'justify-content: flex-end' : 'justify-content: center',
        'align-items: center',
        'pointer-events: auto',
        'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ].join(';');

      // 2. Backdrop
      var backdrop = document.createElement('div');
      backdrop.style.cssText = [
        'position: fixed',
        'inset: 0',
        'background: rgba(0, 0, 0, 0.76)',
        'backdrop-filter: blur(10px)',
        '-webkit-backdrop-filter: blur(10px)',
        'animation: one-eighty-fade-in 0.22s ease-out forwards',
        'cursor: pointer'
      ].join(';');

      // 3. Container Card
      var card = document.createElement('div');
      var cardStyle = [
        'position: relative',
        'z-index: 10000000',
        'width: 100%',
        'background: #09090b',
        'color: #fafafa',
        'box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.75), 0 24px 64px rgba(0, 0, 0, 0.85)',
        'display: flex',
        'flex-direction: column',
        'overflow: hidden',
        'transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      ];

      if (isFullScreen) {
        cardStyle.push('height: 100vh', 'max-height: 100vh', 'border-radius: 0', 'border: none');
      } else if (isMobile) {
        cardStyle.push(
          'height: 88vh',
          'max-height: 92vh',
          'border-radius: 24px 24px 0 0',
          'border: 1px solid rgba(255, 255, 255, 0.12)',
          'animation: one-eighty-slide-up 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        );
      } else {
        cardStyle.push(
          'max-width: 480px',
          'height: 720px',
          'max-height: 90vh',
          'margin: 0 auto',
          'border-radius: 20px',
          'border: 1px solid rgba(255, 255, 255, 0.12)',
          'animation: one-eighty-scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        );
      }
      card.style.cssText = cardStyle.join(';');

      // 4. Header Bar
      var header = document.createElement('div');
      header.style.cssText = [
        'flex-shrink: 0',
        'padding: ' + (isMobile && !isFullScreen ? '8px 16px 8px 16px' : '12px 16px'),
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'border-bottom: 1px solid rgba(255, 255, 255, 0.08)',
        'background: #09090b',
        'position: relative'
      ].join(';');

      if (isMobile && !isFullScreen) {
        var grabHandle = document.createElement('div');
        grabHandle.style.cssText = 'width: 40px; height: 4px; border-radius: 9999px; background: rgba(255, 255, 255, 0.22); margin-bottom: 6px;';
        header.appendChild(grabHandle);
      }

      var navBar = document.createElement('div');
      navBar.style.cssText = 'width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;';

      var brandWrap = document.createElement('div');
      brandWrap.style.cssText = 'display: flex; align-items: center; gap: 8px; min-width: 0;';
      brandWrap.innerHTML = [
        '<div style="width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center;">',
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f4f4f5" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>',
        '</div>',
        '<div style="font-size: 13px; font-weight: 700; color: #f4f4f5; letter-spacing: -0.01em;">' + (options.title || '180 Pay') + '</div>'
      ].join('');

      var actionGroup = document.createElement('div');
      actionGroup.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      // Fullscreen expand toggle
      var expandBtn = document.createElement('button');
      expandBtn.type = 'button';
      expandBtn.setAttribute('aria-label', isFullScreen ? 'Collapse view' : 'Expand full page');
      expandBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: #a1a1aa; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; outline: none;';
      expandBtn.innerHTML = isFullScreen
        ? '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5"/></svg>'
        : '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>';

      expandBtn.onclick = function () {
        isFullScreen = !isFullScreen;
        if (isFullScreen) {
          card.style.height = '100vh';
          card.style.maxHeight = '100vh';
          card.style.maxWidth = '100%';
          card.style.borderRadius = '0';
          card.style.border = 'none';
        } else {
          card.style.height = isMobile ? '88vh' : '720px';
          card.style.maxHeight = isMobile ? '92vh' : '90vh';
          card.style.maxWidth = isMobile ? '100%' : '480px';
          card.style.borderRadius = isMobile ? '24px 24px 0 0' : '20px';
          card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
        }
      };

      // Close button
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: #a1a1aa; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; outline: none;';
      closeBtn.innerHTML = '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';

      actionGroup.appendChild(expandBtn);
      actionGroup.appendChild(closeBtn);
      navBar.appendChild(brandWrap);
      navBar.appendChild(actionGroup);
      header.appendChild(navBar);

      // 5. Iframe Viewport
      var iframeWrap = document.createElement('div');
      iframeWrap.style.cssText = 'flex: 1; width: 100%; height: 100%; position: relative; background: #09090b; overflow: hidden;';

      var spinner = document.createElement('div');
      spinner.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #09090b; transition: opacity 0.2s ease;';
      spinner.innerHTML = [
        '<div style="width: 30px; height: 30px; border: 2.5px solid rgba(255, 255, 255, 0.15); border-top-color: #f4f4f5; border-radius: 50%; animation: one-eighty-spin 0.75s linear infinite;"></div>',
        '<div style="font-size: 11px; font-weight: 500; color: #a1a1aa; letter-spacing: 0.02em;">Loading Secure Window...</div>'
      ].join('');

      var iframe = document.createElement('iframe');
      iframe.src = options.url;
      iframe.allow = 'clipboard-write; payment; geolocation';
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: transparent; opacity: 0; transition: opacity 0.2s ease;';
      iframe.onload = function () {
        spinner.style.opacity = '0';
        iframe.style.opacity = '1';
        setTimeout(function () { if (spinner.parentNode) spinner.remove(); }, 200);
      };

      iframeWrap.appendChild(spinner);
      iframeWrap.appendChild(iframe);
      card.appendChild(header);
      card.appendChild(iframeWrap);
      root.appendChild(backdrop);
      root.appendChild(card);
      document.body.appendChild(root);

      // Touch drag-down gesture for mobile bottom sheet
      var startY = 0;
      var currentY = 0;
      header.addEventListener('touchstart', function (e) {
        if (e.touches && e.touches[0]) {
          startY = e.touches[0].clientY;
        }
      }, { passive: true });

      header.addEventListener('touchmove', function (e) {
        if (isFullScreen || !isMobile) return;
        if (e.touches && e.touches[0]) {
          currentY = e.touches[0].clientY;
          var diff = currentY - startY;
          if (diff > 0) {
            card.style.transform = 'translateY(' + diff + 'px)';
          }
        }
      }, { passive: true });

      header.addEventListener('touchend', function () {
        if (isFullScreen || !isMobile) return;
        var diff = currentY - startY;
        if (diff > 80) {
          handleCancel();
        } else {
          card.style.transform = 'translateY(0)';
        }
        startY = 0;
        currentY = 0;
      }, { passive: true });

      function cleanupListeners() {
        if (window.removeEventListener) {
          window.removeEventListener('message', onMessage);
          window.removeEventListener('keydown', onKeyDown);
        }
      }

      function closeModal() {
        if (isMobile && !isFullScreen) {
          card.style.animation = 'one-eighty-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        }
        backdrop.style.animation = 'one-eighty-fade-out 0.2s ease-in forwards';
        setTimeout(function () {
          if (root.parentNode) root.remove();
        }, 220);
      }

      function handleCancel() {
        if (isResolved) return;
        isResolved = true;
        cleanupListeners();
        closeModal();
        if (options.onCancel) options.onCancel();
        resolve(null);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          handleCancel();
        }
      }

      backdrop.onclick = handleCancel;
      closeBtn.onclick = handleCancel;
      root.onclick = function (e) {
        if (e.target === root || e.target === backdrop || (card && !card.contains(e.target))) {
          handleCancel();
        }
      };

      // 6. PostMessage Receiver Bridge
      function onMessage(event) {
        var data = event.data;
        if (!data || typeof data !== 'object') {
          try { data = JSON.parse(event.data); } catch (_) { return; }
        }

        var successTypes = options.successTypes || ['180_IDENTITY_SUCCESS', '180_AUTH_SUCCESS', '180_PAY_SUCCESS', '180_PAYMENT_SUCCESS'];
        var closeTypes = options.closeTypes || ['180_IDENTITY_CLOSE', '180_PAYMENT_CLOSE', '180_PAY_CLOSE', '180_MODAL_CLOSE'];
        var errorTypes = options.errorTypes || ['180_IDENTITY_ERROR', '180_AUTH_ERROR', '180_PAY_ERROR', '180_PAYMENT_ERROR'];

        if (successTypes.indexOf(data.type) !== -1) {
          if (isResolved) return;
          isResolved = true;
          cleanupListeners();
          closeModal();
          var mapped = options.mapSuccess ? options.mapSuccess(data) : data;
          if (options.onSuccess) options.onSuccess(mapped);
          resolve(mapped);
        } else if (errorTypes.indexOf(data.type) !== -1) {
          if (isResolved) return;
          isResolved = true;
          cleanupListeners();
          closeModal();
          var errorCode = data.code || data.error_code || (typeof data.error === 'string' ? data.error : '180_ERR_OPERATION_FAILED');
          var errorDesc = data.error_description || data.error || data.message || '180 Sovereign operation failed';
          var hint = data.hint || getDiagnosticHint(errorCode);
          var err = new Error(errorDesc);
          err.code = errorCode;
          err.hint = hint;
          if (options.onError) options.onError(err);
          reject(err);
        } else if (closeTypes.indexOf(data.type) !== -1) {
          handleCancel();
        }
      }

      window.addEventListener('message', onMessage);
      window.addEventListener('keydown', onKeyDown);
    });
  }

  // ─── 180 AUTH / IDENTITY SERVICE ──────────────────────────────────────────
  var OneEightyAuth = {
    signIn: async function (options) {
      options = options || {};
      var clientId = options.clientId || '180-core-client';
      var env = resolveEnvironmentMode(options.environment);
      var authServer = options.authServerUrl || (env === 'production' ? 'https://profile.180workspace.com' : DEFAULT_AUTH_SERVER);
      var redirectUri = options.redirectUri || (isBrowser ? window.location.origin + '/oauth/callback' : '');
      var scope = options.scope || 'openid identity:read identity:email';
      var state = options.state || generateRandomString(16);
      var pkce = await generatePkcePair();

      var isMobile = isMobileViewport();
      var defaultMode = isMobile ? 'bottom_sheet' : 'bottom_sheet';
      var effectiveMode = options.uxMode || defaultMode;

      var params = [
        'client_id=' + encodeURIComponent(clientId),
        'redirect_uri=' + encodeURIComponent(redirectUri),
        'response_type=code',
        'scope=' + encodeURIComponent(scope),
        'state=' + encodeURIComponent(state),
        'code_challenge=' + encodeURIComponent(pkce.challenge),
        'code_challenge_method=S256',
        'ux_mode=' + encodeURIComponent(effectiveMode),
        'env=' + encodeURIComponent(env),
        'app=auth'
      ].join('&');

      var authUrl = authServer + '/auth/login?' + params;

      return openAdaptiveModal({
        url: authUrl,
        title: '180 Sovereign Identity',
        uxMode: effectiveMode,
        successTypes: ['180_IDENTITY_SUCCESS', '180_AUTH_SUCCESS'],
        closeTypes: ['180_IDENTITY_CLOSE'],
        mapSuccess: function (data) {
          var token = data.authToken || data.accessToken || data.token;
          if (isBrowser && token) {
            try {
              localStorage.setItem('platform_auth_token', token);
              localStorage.setItem('180_access_token', token);
              if (data.user) localStorage.setItem('180_user', JSON.stringify(data.user));
            } catch (_) {}
          }
          return {
            code: data.code,
            token: token,
            accessToken: token,
            idToken: data.id_token,
            state: data.state || state,
            user: data.user || null
          };
        },
        onSuccess: options.onSuccess,
        onError: options.onError,
        onCancel: options.onCancel
      });
    },

    signOut: function () {
      if (isBrowser) {
        try {
          localStorage.removeItem('platform_auth_token');
          localStorage.removeItem('180_access_token');
          localStorage.removeItem('180_user');
          document.cookie = 'platform_auth_token=; path=/; max-age=0';
        } catch (_) {}
      }
    },

    getUser: function () {
      if (!isBrowser) return null;
      try {
        var raw = localStorage.getItem('180_user') || localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    },

    getAccessToken: function () {
      if (!isBrowser) return null;
      try {
        return localStorage.getItem('180_access_token') || localStorage.getItem('platform_auth_token') || null;
      } catch (_) { return null; }
    },

    resolveEnvironmentMode: resolveEnvironmentMode,
    generateReferenceCode: generateReferenceCode
  };

  // ─── 180 PAY / SOVEREIGN CHECKOUT SERVICE ─────────────────────────────────
  var OneEightyPay = {
    checkout: function (options) {
      options = options || {};
      var env = resolveEnvironmentMode(options.environment);
      var payServer = options.payServerUrl || (env === 'production' ? 'https://pay.180workspace.com' : DEFAULT_PAY_SERVER);
      var sessionId = options.sessionId || 'cs_' + generateRandomString(24);

      var query = [
        options.amount ? 'amount=' + encodeURIComponent(options.amount) : '',
        options.currency ? 'currency=' + encodeURIComponent(options.currency) : 'currency=USD',
        options.title ? 'title=' + encodeURIComponent(options.title) : '',
        options.planCode ? 'plan=' + encodeURIComponent(options.planCode) : '',
        options.description ? 'description=' + encodeURIComponent(options.description) : '',
        'appName=' + encodeURIComponent('180 Workspace'),
        'app=pay',
        'ux_mode=' + encodeURIComponent(options.uxMode || 'bottom_sheet'),
        'env=' + encodeURIComponent(env)
      ].filter(Boolean).join('&');

      var checkoutUrl = payServer + '/checkout/' + encodeURIComponent(sessionId) + (query ? '?' + query : '');

      return openAdaptiveModal({
        url: checkoutUrl,
        title: options.title || '180 Pay',
        uxMode: options.uxMode || 'bottom_sheet',
        successTypes: ['180_PAYMENT_SUCCESS', '180_PAY_SUCCESS'],
        closeTypes: ['180_PAYMENT_CLOSE', '180_PAY_CLOSE', '180_MODAL_CLOSE'],
        mapSuccess: function (data) {
          return {
            sessionId: data.sessionId || sessionId,
            transactionId: data.transactionId,
            amount: data.amount || options.amount,
            currency: data.currency || options.currency,
            status: 'completed',
            isFree: Boolean(data.isFree)
          };
        },
        onSuccess: options.onSuccess,
        onError: options.onError,
        onCancel: options.onCancel
      });
    },
    openCheckoutModal: function (options) {
      return OneEightyPay.checkout(options);
    },
    openPopup: function (options) {
      return OneEightyPay.checkout(Object.assign({}, options, { uxMode: 'popup' }));
    },
    openBottomSheet: function (options) {
      return OneEightyPay.checkout(Object.assign({}, options, { uxMode: 'bottom_sheet' }));
    },
    openFullPage: function (options) {
      return OneEightyPay.checkout(Object.assign({}, options, { uxMode: 'full_page' }));
    },
    resolveEnvironmentMode: resolveEnvironmentMode,
    generateReferenceCode: generateReferenceCode
  };

  // ─── 180 UI ADAPTIVE SERVICE ──────────────────────────────────────────────
  var OneEightyUi = {
    openModal: openAdaptiveModal,
    openBottomSheet: function (options) {
      var opts = Object.assign({}, options, { uxMode: 'bottom_sheet' });
      return openAdaptiveModal(opts);
    },
    openFullPage: function (options) {
      var opts = Object.assign({}, options, { uxMode: 'full_page' });
      return openAdaptiveModal(opts);
    }
  };

  // ─── GLOBAL CONFIGURATION STATE ───────────────────────────────────────────
  var _config = {
    clientId: '180-core-client',
    authServerUrl: DEFAULT_AUTH_SERVER,
    payServerUrl: DEFAULT_PAY_SERVER,
    apiServerUrl: DEFAULT_API_SERVER,
    uxMode: 'auto'
  };

  // Wire auth aliases
  OneEightyAuth.openAuthModal = OneEightyAuth.signIn;
  OneEightyAuth.openLoginPopup = function (options) {
    return OneEightyAuth.signIn(Object.assign({}, options, { uxMode: (options && options.uxMode) || 'popup' }));
  };
  OneEightyAuth.openBottomSheet = function (options) {
    return OneEightyAuth.signIn(Object.assign({}, options, { uxMode: 'bottom_sheet' }));
  };
  OneEightyAuth.openPopup = function (options) {
    return OneEightyAuth.signIn(Object.assign({}, options, { uxMode: 'popup' }));
  };

  // ─── UNIFIED ONE-EIGHTY CORE ROOT OBJECT ──────────────────────────────────
  var OneEighty = {
    version: '1.0.0-sovereign',
    init: function (config) {
      if (config) {
        if (config.clientId) _config.clientId = config.clientId;
        if (config.authServerUrl) _config.authServerUrl = config.authServerUrl;
        if (config.payServerUrl) _config.payServerUrl = config.payServerUrl;
        if (config.apiServerUrl) _config.apiServerUrl = config.apiServerUrl;
        if (config.uxMode) _config.uxMode = config.uxMode;
      }
      return OneEighty;
    },
    auth: OneEightyAuth,
    pay: OneEightyPay,
    ui: OneEightyUi,
    resolveEnvironmentMode: resolveEnvironmentMode,
    generateReferenceCode: generateReferenceCode,
    signIn: OneEightyAuth.signIn,
    signOut: OneEightyAuth.signOut,
    getUser: OneEightyAuth.getUser,
    getAccessToken: OneEightyAuth.getAccessToken,
    checkout: OneEightyPay.checkout,
    openModal: OneEightyUi.openModal
  };

  // ─── UNIVERSAL WEB COMPONENT REGISTRATION (<one-eighty-auth-button>) ───────
  if (isBrowser && window.customElements && !window.customElements.get('one-eighty-auth-button')) {
    try {
      var OneEightyAuthButtonElement = class extends HTMLElement {
        connectedCallback() {
          var clientId = this.getAttribute('client-id') || _config.clientId || '180-core-client';
          var title = this.getAttribute('title') || 'Continue with 180 Profile';
          var subtitle = this.getAttribute('subtitle') || '';
          var subtitleHtml = subtitle
            ? '<span style="font-size: 10px; font-weight: 500; color: #71717a;">' + subtitle + '</span>'
            : '';
          this.innerHTML = [
            '<button type="button" style="display: inline-flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 14px; background: #ffffff; color: #09090b; border: 1.5px solid #27272a; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); transition: all 0.18s ease; outline: none;">',
            '<div style="width: 28px; height: 28px; border-radius: 8px; background: #18181b; border: 1px solid #27272a; display: flex; align-items: center; justify-content: center; position: relative;">',
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f4f4f5" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            '<div style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; border: 1.5px solid #ffffff; position: absolute; top: -2px; right: -2px;"></div>',
            '</div>',
            '<div style="display: flex; flex-direction: column; text-align: left; line-height: 1.2;">',
            '<span style="font-size: 13.5px; font-weight: 700; color: #09090b;">' + title + '</span>',
            subtitleHtml,
            '</div>',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2.5" style="margin-left: 4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>',
            '</button>'
          ].join('');

          var btn = this.querySelector('button');
          if (btn) {
            btn.onclick = function () {
              OneEighty.auth.signIn({ clientId: clientId });
            };
          }
        }
      };
      window.customElements.define('one-eighty-auth-button', OneEightyAuthButtonElement);
    } catch (_) {}
  }

  // ─── UNIVERSAL WEB COMPONENT REGISTRATION (<one-eighty-pay-button>) ────────
  if (isBrowser && window.customElements && !window.customElements.get('one-eighty-pay-button')) {
    try {
      var OneEightyPayButtonElement = class extends HTMLElement {
        connectedCallback() {
          var amount = parseFloat(this.getAttribute('amount') || '0');
          var currency = this.getAttribute('currency') || 'USD';
          var plan = this.getAttribute('plan') || '';
          var title = this.getAttribute('title') || 'Pay with 180 Pay';
          var subtitle = this.getAttribute('subtitle') || (amount > 0 ? ('$' + amount + ' ' + currency) : 'Secure Online Checkout');
          this.innerHTML = [
            '<button type="button" style="display: inline-flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 14px; background: #09090b; color: #ffffff; border: 1.5px solid rgba(16, 185, 129, 0.4); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.15); transition: all 0.18s ease; outline: none;">',
            '<div style="width: 28px; height: 28px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; position: relative;">',
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
            '</div>',
            '<div style="display: flex; flex-direction: column; text-align: left; line-height: 1.2;">',
            '<span style="font-size: 13.5px; font-weight: 700; color: #ffffff;">' + title + '</span>',
            '<span style="font-size: 10px; font-weight: 500; color: #94a3b8;">' + subtitle + '</span>',
            '</div>',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="margin-left: 4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>',
            '</button>'
          ].join('');

          var btn = this.querySelector('button');
          if (btn) {
            btn.onclick = function () {
              OneEighty.pay.checkout({
                amount: amount,
                currency: currency,
                planCode: plan,
                title: title
              });
            };
          }
        }
      };
      window.customElements.define('one-eighty-pay-button', OneEightyPayButtonElement);
    } catch (_) {}
  }

  if (isBrowser) {
    try {
      var handleRevoked = function (revokedClientId) {
        if (!revokedClientId) return;
        var currentClientId = (window.__180_CLIENT_ID || defaultClientConfig.clientId || '').toLowerCase();
        var normRevoked = (revokedClientId || '').toLowerCase();
        var isCurrentApp = normRevoked && (
          normRevoked === currentClientId ||
          (normRevoked.indexOf('social') !== -1 && currentClientId.indexOf('social') !== -1) ||
          (normRevoked.indexOf('developer') !== -1 && currentClientId.indexOf('developer') !== -1) ||
          (normRevoked.indexOf('workspace') !== -1 && currentClientId.indexOf('workspace') !== -1)
        );
        if (isCurrentApp) {
          OneEightyAuth.signOut();
          window.dispatchEvent(new Event('180_SIGNOUT'));
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.reload();
          }
        }
      };

      if (typeof BroadcastChannel !== 'undefined') {
        var syncChannel = new BroadcastChannel('180_auth_sync');
        syncChannel.onmessage = function (ev) {
          if (ev.data && ev.data.type === 'APP_REVOKED') {
            handleRevoked(ev.data.clientId);
          }
        };
      }

      window.addEventListener('storage', function (ev) {
        if (ev.key === '180_revoked_app_event' && ev.newValue) {
          try {
            var data = JSON.parse(ev.newValue);
            handleRevoked(data.clientId);
          } catch (_) {}
        }
      });
    } catch (_) {}
  }

  // ─── EXPORTS & BACKWARD COMPATIBILITY ─────────────────────────────────────
  global.OneEighty = OneEighty;
  global.OneEightyCore = OneEighty;
  global.OneEightyIdentity = OneEightyAuth;
  global.OneEightyAuth = OneEightyAuth;
  global.OneEightyPay = OneEightyPay;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OneEighty;
    module.exports.OneEighty = OneEighty;
    module.exports.OneEightyCore = OneEighty;
    module.exports.OneEightyIdentity = OneEightyAuth;
    module.exports.OneEightyAuth = OneEightyAuth;
    module.exports.OneEightyPay = OneEightyPay;
  }
})(typeof window !== 'undefined' ? window : global);
