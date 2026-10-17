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
        return 'Origin (' + (isBrowser ? window.location.origin : '') + ') is not whitelisted. Register your domain or localhost in https://developer.180core.cloud under Allowed Origins.';
      case '180_ERR_INVALID_CLIENT_ID':
      case 'invalid_client':
        return 'Client ID is invalid or missing. Verify NEXT_PUBLIC_180_CLIENT_ID or create an app in https://developer.180core.cloud.';
      case '180_ERR_POPUP_BLOCKED':
        return 'Browser blocked opening popup. Trigger signIn from a direct user click or use uxMode: "bottom_sheet".';
      case '180_ERR_NETWORK_DISCONNECTED':
        return 'Failed to reach 180 Sovereign Cloud. Verify internet connectivity or check https://developer.180core.cloud.';
      case '180_ERR_TIMEOUT':
        return 'Connection timed out waiting for 180 Identity server to respond.';
      default:
        return 'Consult 180 Core documentation at https://developer.180core.cloud for integration guidelines.';
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
  var DEFAULT_AUTH_SERVER = activeEnv === 'production' ? 'https://profile.180core.cloud' : 'http://localhost:3009';
  var DEFAULT_PAY_SERVER = activeEnv === 'production' ? 'https://profile.180core.cloud' : 'http://localhost:3009';
  var DEFAULT_API_SERVER = activeEnv === 'production' ? 'https://api.180core.cloud' : 'http://localhost:4003';

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
        'font-family: \'Satoshi\', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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

      var loadTimer = setTimeout(function () {
        if (spinner && spinner.parentNode) {
          var isLocal = options.url && options.url.indexOf('localhost:3009') !== -1;
          spinner.innerHTML = [
            '<div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; color: #ef4444; font-weight: bold;">!</div>',
            '<div style="font-size: 13px; font-weight: 700; color: #f4f4f5;">Connection Timeout</div>',
            '<div style="font-size: 11px; color: #94a3b8; text-align: center; max-width: 320px; line-height: 1.4;">' +
              (isLocal
                ? 'Unable to reach local 180 Identity server (localhost:3009). Run "pnpm dev" in 180 core, or switch to production: OneEighty.auth.signIn({ environment: "production" })'
                : 'Unable to load 180 Sovereign Window. Check your network connection or verify Allowed Origins in Developer Console.') +
            '</div>',
            '<button type="button" style="margin-top: 6px; padding: 6px 14px; border-radius: 8px; background: #27272a; color: #fff; border: 1px solid #3f3f46; font-size: 11px; cursor: pointer;">Retry</button>'
          ].join('');
          var retryBtn = spinner.querySelector('button');
          if (retryBtn) {
            retryBtn.onclick = function () {
              iframe.src = options.url;
            };
          }
        }
      }, 10000);

      var iframe = document.createElement('iframe');
      iframe.src = options.url;
      iframe.allow = 'clipboard-write; payment; geolocation';
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: transparent; opacity: 0; transition: opacity 0.2s ease;';
      iframe.onload = function () {
        if (loadTimer) clearTimeout(loadTimer);
        spinner.style.opacity = '0';
        iframe.style.opacity = '1';
        setTimeout(function () { if (spinner.parentNode) spinner.remove(); }, 200);
      };
      iframe.onerror = function () {
        if (loadTimer) clearTimeout(loadTimer);
        var isLocal = options.url && options.url.indexOf('localhost:3009') !== -1;
        spinner.innerHTML = [
          '<div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; color: #ef4444; font-weight: bold;">!</div>',
          '<div style="font-size: 13px; font-weight: 700; color: #f4f4f5;">Failed to Load Window</div>',
          '<div style="font-size: 11px; color: #94a3b8; text-align: center; max-width: 320px; line-height: 1.4;">' +
            (isLocal
              ? 'Local server on port 3009 is unreachable. Start 180 core or specify environment: "production".'
              : 'Window failed to load. Check your network connection.') +
          '</div>'
        ].join('');
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
      var authServer = options.authServerUrl || (env === 'production' ? 'https://profile.180core.cloud' : DEFAULT_AUTH_SERVER);
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
      var payServer = options.payServerUrl || (env === 'production' ? 'https://profile.180core.cloud' : DEFAULT_PAY_SERVER);
      var sessionId = options.sessionId || 'cs_' + generateRandomString(24);

      var query = [
        (options.amount !== undefined && options.amount !== null) ? 'amount=' + encodeURIComponent(options.amount) : '',
        options.currency ? 'currency=' + encodeURIComponent(String(options.currency).toUpperCase()) : 'currency=USD',
        options.title ? 'title=' + encodeURIComponent(options.title) : '',
        options.orderId ? 'order_id=' + encodeURIComponent(options.orderId) : '',
        options.planCode ? 'plan=' + encodeURIComponent(options.planCode) : '',
        options.description ? 'description=' + encodeURIComponent(options.description) : '',
        options.clientId ? 'client_id=' + encodeURIComponent(options.clientId) : (_config.clientId ? 'client_id=' + encodeURIComponent(_config.clientId) : ''),
        options.appName ? 'appName=' + encodeURIComponent(options.appName) : '',
        options.metadata ? 'metadata=' + encodeURIComponent(typeof options.metadata === 'string' ? options.metadata : JSON.stringify(options.metadata)) : '',
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
    generateReferenceCode: generateReferenceCode,
    webhooks: {
      verifySignature: function (options) {
        return verifyWebhookSignature(options);
      },
      constructEvent: function (rawBody, signature, secret, timestamp) {
        var isValid = verifyWebhookSignature({
          rawBody: rawBody,
          signature: signature,
          secret: secret,
          timestamp: timestamp
        });
        if (!isValid) {
          throw new Error('[180 Pay Webhook Verification] Cryptographic signature mismatch or expired replay window.');
        }
        var bodyString = (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(rawBody))
          ? rawBody.toString('utf8')
          : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
        return JSON.parse(bodyString);
      }
    }
  };

  function verifyWebhookSignature(options) {
    try {
      if (!options || !options.secret) return false;
      var rawPayload = options.rawBody !== undefined ? options.rawBody : options.payload;
      if (rawPayload === undefined || rawPayload === null) return false;

      var payloadString = '';
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(rawPayload)) {
        payloadString = rawPayload.toString('utf8');
      } else if (typeof rawPayload === 'string') {
        payloadString = rawPayload;
      } else {
        try { payloadString = JSON.stringify(rawPayload); } catch (_) { return false; }
      }

      var signature = options.signature;
      var timestamp = options.timestamp;

      if (options.headers) {
        if (!signature) {
          signature = options.headers['x-180-signature'] || options.headers['X-180-Signature'] || options.headers['x_180_signature'];
        }
        if (!timestamp) {
          timestamp = options.headers['x-180-timestamp'] || options.headers['X-180-Timestamp'] || options.headers['x_180_timestamp'];
        }
      }

      if (!signature || typeof signature !== 'string') return false;

      if (signature.indexOf('t=') !== -1 && signature.indexOf('v1=') !== -1) {
        var parts = signature.split(',');
        for (var i = 0; i < parts.length; i++) {
          var part = parts[i].trim();
          if (part.indexOf('t=') === 0 && !timestamp) timestamp = part.replace('t=', '').trim();
          if (part.indexOf('v1=') === 0) signature = part.replace('v1=', '').trim();
        }
      }

      if (typeof require !== 'undefined') {
        var crypto = require('crypto');
        var safeTimingCompare = function(a, b) {
          if (!a || !b) return false;
          var bufA = Buffer.from(a.trim());
          var bufB = Buffer.from(b.trim());
          if (bufA.length !== bufB.length) return false;
          return crypto.timingSafeEqual(bufA, bufB);
        };

        var tolerance = options.toleranceSeconds || 300;
        if (timestamp) {
          var parsedTimestamp = typeof timestamp === 'number' ? timestamp : parseInt(String(timestamp), 10);
          var now = Math.floor(Date.now() / 1000);
          if (isNaN(parsedTimestamp) || Math.abs(now - parsedTimestamp) > tolerance) {
            return false;
          }
          var expectedWithTimestamp = crypto.createHmac('sha256', options.secret).update(parsedTimestamp + '.' + payloadString).digest('hex');
          if (safeTimingCompare(expectedWithTimestamp, signature)) return true;
        }

        var expectedDirect = crypto.createHmac('sha256', options.secret).update(payloadString).digest('hex');
        return safeTimingCompare(expectedDirect, signature);
      }
      return false;
    } catch (_) {
      return false;
    }
  }

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
    webhooks: OneEightyPay.webhooks,
    verifyWebhook: function (options) {
      return verifyWebhookSignature(options);
    },
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
            '<button type="button" class="identity-btn-shimmer" style="position: relative; display: inline-flex; align-items: center; gap: 12px; min-height: 44px; padding: 7px 15px; border-radius: 14px; border: 1.5px solid transparent; background: linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, #2563eb, #4f46e5, #3b82f6, #1d4ed8) border-box; background-size: 100% 100%, 250% 250%; animation: identity-border-flow 4s ease infinite; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px -1px rgba(37, 99, 235, 0.15), 0 1px 3px rgba(0, 0, 0, 0.04); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); outline: none; user-select: none; overflow: hidden;">',
            '<div style="width: 28px; height: 28px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; position: relative;">',
            '<img src="/black icon.svg" alt="180 Profile" style="width: 17px; height: 17px; object-fit: contain;" onerror="this.src=\'/black-icon.svg\'" />',
            '<div style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; border: 1px solid #ffffff; position: absolute; top: -2px; right: -2px;"><span style="position: absolute; inset: 0; border-radius: 50%; background: #10b981; opacity: 0.7; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span></div>',
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
      if (!window.customElements.get('one-eighty-identity-button')) {
        window.customElements.define('one-eighty-identity-button', OneEightyAuthButtonElement);
      }
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

  // <one-eighty-pricing-table> UNIVERSAL EMBEDDABLE COMPONENT
  if (isBrowser && window.customElements && !window.customElements.get('one-eighty-pricing-table')) {
    try {
      var OneEightyPricingTableElement = class extends HTMLElement {
        connectedCallback() {
          var el = this;
          var appId = el.getAttribute('app-id') || el.getAttribute('appid') || el.getAttribute('client-id') || '';
          var theme = el.getAttribute('theme') || 'auto';
          var customAccent = el.getAttribute('accent-color') || '';
          var apiServer = el.getAttribute('api-base') || DEFAULT_API_SERVER;
          var selectedInterval = el.getAttribute('interval') || 'monthly';

          if (!appId) {
            el.innerHTML = '<div style="padding:16px;font-family:sans-serif;color:#ef4444;background:rgba(239,68,68,0.1);border-radius:12px;font-size:13px;border:1px solid rgba(239,68,68,0.2);">Missing required <code>app-id</code> attribute on <code>&lt;one-eighty-pricing-table&gt;</code>.</div>';
            return;
          }

          el.innerHTML = '<div style="padding:32px;text-align:center;font-family:sans-serif;color:#71717a;font-size:13px;"><div style="width:24px;height:24px;border:2px solid #71717a;border-top-color:transparent;border-radius:50%;margin:0 auto 12px auto;animation:one-eighty-spin 0.75s linear infinite;"></div>Loading subscription tiers...</div>';

          fetch(apiServer + '/api/v1/pricing-tables/' + encodeURIComponent(appId))
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (!data || !data.success || !data.config) {
                el.innerHTML = '<div style="padding:20px;text-align:center;font-family:sans-serif;color:#ef4444;font-size:13px;">Unable to load pricing table. Please check app ID or network connectivity.</div>';
                return;
              }
              var config = data.config;
              var accentColor = customAccent || config.accentColor || '#6366f1';
              var yearlyDiscount = Number(config.yearlyDiscountPct || 20);
              var plans = config.planCards || [];

              function checkIsDark() {
                if (theme === 'light') return false;
                if (theme === 'dark' || theme === 'obsidian') return true;
                // 'auto' mode: check host/developer platform document classes
                if (typeof document !== 'undefined') {
                  var docDark = document.documentElement.classList.contains('dark') ||
                    Boolean(document.body && document.body.classList.contains('dark')) ||
                    document.documentElement.getAttribute('data-theme') === 'dark' ||
                    Boolean(document.body && document.body.getAttribute('data-theme') === 'dark');
                  if (docDark) return true;
                }
                // Default is White / Light Mode!
                return false;
              }

              var currentActiveInterval = selectedInterval;

              function renderTable(currentInterval) {
                currentActiveInterval = currentInterval;
                var isDark = checkIsDark();
                var text = isDark ? '#f4f4f5' : '#09090b';
                var muted = isDark ? '#a1a1aa' : '#71717a';
                var cardBg = isDark ? '#18181b' : '#ffffff';
                var cardBorder = isDark ? 'rgba(255,255,255,0.1)' : '#e4e4e7';
                var toggleBg = isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5';

                var html = '<div style="font-family:\'Satoshi\',system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:' + text + ';padding:24px 12px;box-sizing:border-box;">';

                if (config.headline) {
                  html += '<div style="text-align:center;margin-bottom:28px;">';
                  html += '<h2 style="margin:0 0 8px 0;font-size:26px;font-weight:800;letter-spacing:-0.02em;">' + config.headline + '</h2>';
                  if (config.subheadline) {
                    html += '<p style="margin:0;font-size:14px;color:' + muted + ';max-width:580px;margin-left:auto;margin-right:auto;">' + config.subheadline + '</p>';
                  }

                  html += '<div style="margin-top:20px;display:inline-flex;align-items:center;padding:4px;border-radius:12px;background:' + toggleBg + ';border:1px solid ' + cardBorder + ';">';
                  html += '<button type="button" data-interval="monthly" style="padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:' + (currentInterval === 'monthly' ? accentColor : 'transparent') + ';color:' + (currentInterval === 'monthly' ? '#ffffff' : muted) + ';transition:all 0.15s ease;">Monthly</button>';
                  html += '<button type="button" data-interval="yearly" style="padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:' + (currentInterval === 'yearly' ? accentColor : 'transparent') + ';color:' + (currentInterval === 'yearly' ? '#ffffff' : muted) + ';transition:all 0.15s ease;display:inline-flex;align-items:center;gap:6px;">Annual <span style="font-size:10px;background:rgba(16,185,129,0.2);color:#10b981;padding:1px 6px;border-radius:999px;font-weight:700;">Save ' + yearlyDiscount + '%</span></button>';
                  html += '</div></div>';
                }

                html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:1100px;margin:0 auto;align-items:stretch;">';
                plans.forEach(function (p) {
                  var amount = currentInterval === 'yearly' ? (p.yearlyAmount || Math.round((p.amount || 0) * 12 * (1 - yearlyDiscount / 100))) : (p.amount || 0);
                  var isPopular = !!p.isPopular;
                  var curSymbol = p.currency === 'INR' ? '₹' : p.currency === 'EUR' ? '€' : p.currency === 'GBP' ? '£' : '$';
                  var badge = p.badgeText || (isPopular ? 'Most Popular' : '');

                  html += '<div style="position:relative;background:' + cardBg + ';border:' + (isPopular ? '2px solid ' + accentColor : '1px solid ' + cardBorder) + ';border-radius:20px;padding:28px 24px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:' + (isPopular ? '0 12px 32px -8px rgba(99,102,241,0.25)' : (isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)')) + ';transition:transform 0.2s ease;">';
                  if (badge) {
                    html += '<div style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:' + accentColor + ';color:#ffffff;font-size:10px;font-weight:700;padding:2px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.04em;">' + badge + '</div>';
                  }
                  html += '<div>';
                  html += '<h3 style="margin:0 0 6px 0;font-size:18px;font-weight:700;">' + p.name + '</h3>';
                  if (p.description) {
                    html += '<p style="margin:0 0 16px 0;font-size:12px;color:' + muted + ';line-height:1.4;">' + p.description + '</p>';
                  }
                  html += '<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:20px;">';
                  html += '<span style="font-size:32px;font-weight:800;font-family:\'Fira Code\',\'JetBrains Mono\',monospace;">' + curSymbol + amount + '</span>';
                  html += '<span style="font-size:12px;color:' + muted + ';">/' + (currentInterval === 'yearly' ? 'yr' : 'mo') + '</span>';
                  html += '</div>';

                  if (p.features && p.features.length) {
                    html += '<div style="border-top:1px solid ' + cardBorder + ';padding-top:16px;margin-bottom:24px;">';
                    html += '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;font-size:12.5px;">';
                    p.features.forEach(function (feat) {
                      var featText = typeof feat === 'object' ? feat.text : feat;
                      var inc = typeof feat === 'object' ? feat.included !== false : true;
                      html += '<li style="display:flex;align-items:center;gap:8px;color:' + (inc ? text : muted) + ';opacity:' + (inc ? '1' : '0.5') + ';">';
                      html += '<span style="color:' + (inc ? '#10b981' : muted) + ';font-weight:700;">' + (inc ? '✓' : '×') + '</span>';
                      html += '<span>' + featText + '</span>';
                      html += '</li>';
                    });
                    html += '</ul>';
                    html += '</div>';
                  }
                  html += '</div>';

                  var btnText = p.buttonText || (p.trialDays && p.trialDays > 0 ? 'Start ' + p.trialDays + '-Day Free Trial' : 'Get Started');
                  html += '<div>';
                  html += '<button type="button" data-plan="' + p.planCode + '" style="width:100%;padding:12px;border-radius:12px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:' + (isPopular ? accentColor : (isDark ? '#27272a' : '#09090b')) + ';color:#ffffff;transition:all 0.15s ease;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">' + btnText + '</button>';
                  if (p.trialDays && p.trialDays > 0) {
                    html += '<p style="margin:6px 0 0 0;font-size:11px;color:' + muted + ';text-align:center;">' + p.trialDays + '-day free trial • Cancel anytime</p>';
                  }
                  html += '</div>';
                  html += '</div>';
                });
                html += '</div></div>';

                el.innerHTML = html;

                var btnMonthly = el.querySelector('button[data-interval="monthly"]');
                var btnYearly = el.querySelector('button[data-interval="yearly"]');
                if (btnMonthly) btnMonthly.onclick = function () { renderTable('monthly'); };
                if (btnYearly) btnYearly.onclick = function () { renderTable('yearly'); };

                var planBtns = el.querySelectorAll('button[data-plan]');
                planBtns.forEach(function (b) {
                  b.onclick = function () {
                    var code = b.getAttribute('data-plan');
                    var targetPlan = plans.find(function (item) { return item.planCode === code; });
                    if (!targetPlan) return;
                    if (targetPlan.buttonUrl && targetPlan.buttonUrl.trim().length > 0) {
                      window.open(targetPlan.buttonUrl.trim(), '_blank');
                      return;
                    }
                    var amt = currentInterval === 'yearly' ? (targetPlan.yearlyAmount || Math.round((targetPlan.amount || 0) * 12 * (1 - yearlyDiscount / 100))) : (targetPlan.amount || 0);
                    OneEighty.pay.checkout({
                      appId: appId,
                      planCode: targetPlan.planCode,
                      amount: amt,
                      currency: targetPlan.currency || 'USD',
                      title: targetPlan.name,
                      uxMode: 'bottom_sheet'
                    });
                  };
                });
              }

              renderTable(selectedInterval);

              // Auto-sync with host page theme changes
              if (theme === 'auto' && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
                if (el._themeObserver) el._themeObserver.disconnect();
                el._themeObserver = new MutationObserver(function () {
                  renderTable(currentActiveInterval);
                });
                el._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
                if (document.body) {
                  el._themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
                }
              }
            })
            .catch(function (err) {
              el.innerHTML = '<div style="padding:20px;text-align:center;font-family:sans-serif;color:#ef4444;font-size:13px;">Error loading pricing table: ' + (err.message || 'Network error') + '</div>';
            });
        }

        disconnectedCallback() {
          if (this._themeObserver) {
            this._themeObserver.disconnect();
            this._themeObserver = null;
          }
        }
      };
      window.customElements.define('one-eighty-pricing-table', OneEightyPricingTableElement);
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
