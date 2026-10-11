/**
 * 180 Profile Embeddable Authentication Button SDK
 * (c) 180 Core Platform
 *
 * Usage:
 * <div id="180-auth-button" data-client-id="YOUR_CLIENT_ID" data-redirect-uri="YOUR_CALLBACK_URL"></div>
 * <script src="https://developers.180workspace.com/sdk/180-auth-button.js" async></script>
 */
(function() {
  'use strict';

  function init180AuthButtons() {
    var targets = document.querySelectorAll('[data-180-auth-button], #180-auth-button, .one80-auth-button');
    if (!targets || targets.length === 0) return;

    var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    var defaultAuthBase = isLocal ? 'http://localhost:3009/auth/login' : 'https://profile.180workspace.com/auth/login';

    targets.forEach(function(container) {
      if (container.getAttribute('data-180-initialized')) return;
      container.setAttribute('data-180-initialized', 'true');

      var clientId = container.getAttribute('data-client-id') || container.getAttribute('data-clientid') || '';
      var redirectUri = container.getAttribute('data-redirect-uri') || window.location.href;
      var scope = container.getAttribute('data-scope') || 'openid identity:read identity:email';
      var uxMode = container.getAttribute('data-ux-mode') || 'popup';
      var authBase = container.getAttribute('data-auth-base') || defaultAuthBase;
      var primaryText = container.getAttribute('data-primary-text') || 'Get Started';
      var subText = container.getAttribute('data-sub-text') || 'with 180 Profile';
      var theme = container.getAttribute('data-theme') || 'dark'; // 'dark' | 'light'

      var isDark = theme !== 'light';

      // Create button
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', primaryText + ' ' + subText);

      // Embedded styles
      var bgStyle = isDark 
        ? 'background: #09090b; color: #ffffff; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.3);' 
        : 'background: #ffffff; color: #09090b; border: 1px solid #e4e4e7; box-shadow: 0 2px 8px rgba(0,0,0,0.06);';

      btn.style.cssText = [
        'display: inline-flex;',
        'align-items: center;',
        'gap: 12px;',
        'padding: 10px 18px;',
        'border-radius: 16px;',
        'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
        'cursor: pointer;',
        'transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);',
        'outline: none;',
        'user-select: none;',
        'min-height: 52px;',
        bgStyle
      ].join(' ');

      // Hover and Active micro-interactions
      btn.addEventListener('mouseenter', function() {
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 6px 20px rgba(0,0,0,0.12)';
      });
      btn.addEventListener('mouseleave', function() {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)';
      });
      btn.addEventListener('mousedown', function() {
        btn.style.transform = 'scale(0.98)';
      });
      btn.addEventListener('mouseup', function() {
        btn.style.transform = 'translateY(-1px)';
      });

      // SVG Icon Emblem
      var iconHtml = [
        '<div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(147, 51, 234, 0.2), rgba(236, 72, 153, 0.2)); border: 1px solid rgba(147, 51, 234, 0.35); display: flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0;">',
        '  <svg width="22" height="22" viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">',
        '    <path d="M210 40 L370 130 L370 290 L210 380 L50 290 L50 130 Z" stroke="url(#emb_grad)" stroke-width="28" stroke-linejoin="round"/>',
        '    <circle cx="210" cy="210" r="48" fill="url(#emb_grad)"/>',
        '    <defs>',
        '      <linearGradient id="emb_grad" x1="0%" y1="0%" x2="100%" y2="100%">',
        '        <stop offset="0%" stop-color="#6366F1"/>',
        '        <stop offset="50%" stop-color="#A855F7"/>',
        '        <stop offset="100%" stop-color="#EC4899"/>',
        '      </linearGradient>',
        '    </defs>',
        '  </svg>',
        '  <span style="position: absolute; bottom: -2px; right: -2px; width: 8px; height: 8px; border-radius: 50%; background: #10B981; border: 2px solid ' + (isDark ? '#09090b' : '#ffffff') + ';"></span>',
        '</div>'
      ].join('');

      // Text Column
      var textColor = isDark ? '#ffffff' : '#09090b';
      var textHtml = [
        '<div style="display: flex; flex-direction: column; text-align: left; line-height: 1.15;">',
        '  <span style="font-size: 13px; font-weight: 700; color: ' + textColor + '; letter-spacing: -0.2px;">' + primaryText + '</span>',
        '  <span style="font-size: 10px; font-weight: 800; background: linear-gradient(90deg, #6366F1, #A855F7, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">' + subText + '</span>',
        '</div>'
      ].join('');

      btn.innerHTML = iconHtml + textHtml;

      // Click Action
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var authState = '180_' + Math.random().toString(36).substring(2, 10);
        var targetUrl = authBase + '?client_id=' + encodeURIComponent(clientId) +
          '&redirect_uri=' + encodeURIComponent(redirectUri) +
          '&scope=' + encodeURIComponent(scope) +
          '&state=' + encodeURIComponent(authState) +
          '&response_type=code&ux_mode=' + encodeURIComponent(uxMode);

        if (uxMode === 'redirect') {
          window.location.href = targetUrl;
          return;
        }

        var width = 450;
        var height = 680;
        var left = window.screen.width ? (window.screen.width - width) / 2 : 100;
        var top = window.screen.height ? (window.screen.height - height) / 2 : 100;

        var popup = window.open(
          targetUrl,
          '180_auth_window',
          'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',scrollbars=yes,status=no,toolbar=no,resizable=yes'
        );

        if (!popup) {
          alert('Popup blocked. Please allow popups for 180 Identity.');
          return;
        }
      });

      // Handle postMessage from popup
      window.addEventListener('message', function(evt) {
        if (evt.data && evt.data.type === '180_AUTH_SUCCESS') {
          // Dispatch custom event on window and container
          var authEvent = new CustomEvent('180:auth:success', { detail: evt.data });
          window.dispatchEvent(authEvent);
          container.dispatchEvent(authEvent);

          // If a redirectUri is configured and no custom handler intercepted, redirect
          if (redirectUri && redirectUri !== window.location.href) {
            var sep = redirectUri.indexOf('?') !== -1 ? '&' : '?';
            window.location.href = redirectUri + sep + 'code=' + encodeURIComponent(evt.data.code) + '&state=' + encodeURIComponent(evt.data.state || '');
          }
        }
      });

      container.innerHTML = '';
      container.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init180AuthButtons);
  } else {
    init180AuthButtons();
  }
})();
