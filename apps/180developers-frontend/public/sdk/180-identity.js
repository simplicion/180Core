/**
 * 180 Identity Client Embed SDK (v1.0.0)
 * Fast, secure, zero-dependency authentication SDK for 180 Workspace and the 180 Ecosystem.
 * Standards: RFC 6749 (OAuth 2.0), OpenID Connect Core 1.0, RFC 7636 (PKCE)
 */
(function (global) {
  'use strict';

  var DEFAULT_AUTH_SERVER = 'http://localhost:3002';
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname.endsWith('180workspace.com')) {
      DEFAULT_AUTH_SERVER = 'https://180identity.180workspace.com';
    } else {
      DEFAULT_AUTH_SERVER = window.location.origin;
    }
  }

  var OneEightyIdentity = {
    version: '1.0.0',

    /**
     * Open Centered 180 Identity Dynamic Modal in Popup Window
     * @param {Object} options
     * @returns {Promise<Object>} Resolves with { code, state, id_token }
     */
    openPopup: function (options) {
      options = options || {};
      var clientId = options.clientId;
      if (!clientId) {
        throw new Error('[180 Identity] Missing required option: clientId');
      }

      var authServer = options.authServerUrl || DEFAULT_AUTH_SERVER;
      var redirectUri = options.redirectUri || (typeof window !== 'undefined' ? window.location.origin + '/oauth/callback' : '');
      var scope = options.scope || 'openid identity:read';
      var state = options.state || Math.random().toString(36).substring(2, 15);
      var responseType = options.responseType || 'code';
      var codeChallenge = options.codeChallenge || '';
      var codeChallengeMethod = options.codeChallengeMethod || 'S256';

      var query = [
        'client_id=' + encodeURIComponent(clientId),
        'redirect_uri=' + encodeURIComponent(redirectUri),
        'scope=' + encodeURIComponent(scope),
        'state=' + encodeURIComponent(state),
        'response_type=' + encodeURIComponent(responseType),
        'ux_mode=popup'
      ];

      if (codeChallenge) {
        query.push('code_challenge=' + encodeURIComponent(codeChallenge));
        query.push('code_challenge_method=' + encodeURIComponent(codeChallengeMethod));
      }

      var url = authServer + '/oauth/authorize?' + query.join('&');

      var width = 450;
      var height = 680;
      var left = (window.screen.width - width) / 2;
      var top = (window.screen.height - height) / 2;

      var popup = window.open(
        url,
        '180_identity_auth',
        'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',scrollbars=yes,status=no,toolbar=no,resizable=yes'
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        if (options.onError) {
          options.onError(new Error('Popup blocked by browser. Please allow popups for 180 Identity.'));
        }
        return Promise.reject(new Error('Popup blocked'));
      }

      return new Promise(function (resolve, reject) {
        var isResolved = false;

        var messageListener = function (event) {
          if (!event.data || event.data.type !== '180_IDENTITY_SUCCESS') {
            return;
          }

          isResolved = true;
          window.removeEventListener('message', messageListener);
          clearInterval(pollTimer);

          var result = {
            code: event.data.code,
            state: event.data.state,
            id_token: event.data.id_token || null
          };

          if (options.onSuccess) {
            options.onSuccess(result);
          }
          resolve(result);
        };

        window.addEventListener('message', messageListener);

        // Poll for manual user closure
        var pollTimer = setInterval(function () {
          if (popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', messageListener);
            if (!isResolved) {
              var err = new Error('Authentication cancelled by user');
              if (options.onError) {
                options.onError(err);
              }
              reject(err);
            }
          }
        }, 500);
      });
    },

    /**
     * Render Branded Drop-in Button
     * @param {HTMLElement|string} target
     * @param {Object} options
     */
    renderButton: function (target, options) {
      options = options || {};
      var element = typeof target === 'string' ? document.getElementById(target) : target;
      if (!element) {
        throw new Error('[180 Identity] Target element not found');
      }

      var text = options.text || 'Get started with 180 Identity';
      var theme = options.theme || 'dark'; // 'dark' | 'light'

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'one-eighty-identity-button';

      var isDark = theme === 'dark';
      var bg = isDark ? '#0f172a' : '#ffffff';
      var textCol = isDark ? '#f8fafc' : '#0f172a';
      var borderCol = isDark ? 'rgba(99, 102, 241, 0.4)' : '#e2e8f0';

      btn.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'gap: 10px',
        'background: ' + bg,
        'color: ' + textCol,
        'border: 1px solid ' + borderCol,
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

      // 180 Emblem Icon
      var icon = document.createElement('span');
      icon.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'width: 22px',
        'height: 22px',
        'border-radius: 6px',
        'background: linear-gradient(135deg, #6366f1, #a855f7)',
        'color: #ffffff',
        'font-size: 10px',
        'font-weight: 900',
        'letter-spacing: -0.5px'
      ].join(';');
      icon.innerText = '180';

      var label = document.createElement('span');
      label.innerText = text;

      btn.appendChild(icon);
      btn.appendChild(label);

      btn.onmouseenter = function () {
        btn.style.borderColor = '#818cf8';
        btn.style.boxShadow = '0 0 16px rgba(99, 102, 241, 0.35)';
      };

      btn.onmouseleave = function () {
        btn.style.borderColor = borderCol;
        btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      };

      btn.onclick = function () {
        if (options.uxMode === 'redirect') {
          var authServer = options.authServerUrl || DEFAULT_AUTH_SERVER;
          var redirectUri = options.redirectUri || window.location.origin + '/oauth/callback';
          var scope = options.scope || 'openid identity:read';
          var state = options.state || Math.random().toString(36).substring(2, 15);
          window.location.href = authServer + '/oauth/authorize?client_id=' + encodeURIComponent(options.clientId) +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&scope=' + encodeURIComponent(scope) +
            '&state=' + encodeURIComponent(state) +
            '&response_type=code&ux_mode=redirect';
        } else {
          OneEightyIdentity.openPopup(options);
        }
      };

      element.innerHTML = '';
      element.appendChild(btn);
    }
  };

  global.OneEightyIdentity = OneEightyIdentity;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OneEightyIdentity;
  }
})(typeof window !== 'undefined' ? window : global);
