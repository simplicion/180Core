/**
 * 180 Pay Vault & Gateway Client Embed SDK (v2.0.0)
 * Fast, secure, zero-dependency payment & subscription checkout embed SDK.
 *
 * Usage:
 * <script src="https://profile.180workspace.com/sdk/180-pay.js"></script>
 * <script>
 *   OneEightyPay.openCheckout({
 *     sessionId: 'cs_live_...',
 *     uxMode: 'bottom_sheet', // 'bottom_sheet' | 'modal' | 'popup' | 'redirect'
 *     onSuccess: function(data) {
 *       console.log('Payment Successful!', data);
 *       window.location.reload();
 *     },
 *     onCancel: function() { console.log('Checkout dismissed'); }
 *   });
 * </script>
 */
(function (global) {
  'use strict';

  var DEFAULT_CHECKOUT_BASE = 'http://localhost:3009';
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname.endsWith('180workspace.com')) {
      DEFAULT_CHECKOUT_BASE = 'https://profile.180workspace.com';
    } else if (window.location.protocol === 'https:') {
      DEFAULT_CHECKOUT_BASE = 'https://profile.180workspace.com';
    }
  }

  var activeModalContainer = null;

  function getOrCreateClientSessionId() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        var sid = window.sessionStorage.getItem('180_client_session_id');
        if (!sid) {
          sid = 'sess_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
          window.sessionStorage.setItem('180_client_session_id', sid);
        }
        return sid;
      }
    } catch (_) {}
    return 'sess_' + Math.random().toString(36).substring(2, 12);
  }

  var OneEightyPay = {
    version: '2.0.0',

    /**
     * Open 180 Pay Checkout Drawer / Modal / Popup
     * @param {Object} options
     * @returns {Promise<Object>} Resolves on payment success
     */
    openCheckout: function (options) {
      options = options || {};
      var sessionId = options.sessionId;
      if (!sessionId) {
        var err = new Error('[180 Pay] Missing required option: sessionId');
        if (options.onError) options.onError(err);
        return Promise.reject(err);
      }

      var isMobile = typeof window !== 'undefined' && (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') ||
        (window.innerWidth && window.innerWidth <= 768)
      );

      var uxMode = options.uxMode || 'bottom_sheet';

      // On mobile devices, always prioritize in-page bottom_sheet drawer over desktop popups
      if (isMobile && uxMode === 'popup') {
        uxMode = 'bottom_sheet';
      }

      var baseUrl = options.checkoutServerUrl || DEFAULT_CHECKOUT_BASE;
      var clientSessionId = options.clientSessionId || getOrCreateClientSessionId();
      var separator = (sessionId.indexOf('?') >= 0) ? '&' : '?';
      var checkoutUrl = baseUrl + '/checkout/' + encodeURIComponent(sessionId) + separator + 'clientSessionId=' + encodeURIComponent(clientSessionId);

      // Handle Full Page Redirect
      if (uxMode === 'redirect' || uxMode === 'full_page') {
        window.location.href = checkoutUrl;
        return Promise.resolve({ redirected: true });
      }

      // Handle Popup Window
      if (uxMode === 'popup') {
        return this._openPopup(checkoutUrl, sessionId, options);
      }

      // Handle In-App Bottom Sheet or Centered Modal
      return this._openIframeOverlay(checkoutUrl, sessionId, uxMode, options);
    },

    /**
     * Internal: Open Popup Window
     */
    _openPopup: function (url, sessionId, options) {
      var width = 480;
      var height = 720;
      var left = (window.screen.width - width) / 2;
      var top = (window.screen.height - height) / 2;

      var popup = window.open(
        url,
        '180_pay_checkout_' + sessionId,
        'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',scrollbars=yes,status=no,toolbar=no,resizable=yes'
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        console.warn('[180 Pay] Popup blocked or not supported on this device. Gracefully degrading to Bottom Sheet.');
        return this._openIframeOverlay(url, sessionId, 'bottom_sheet', options);
      }

      return new Promise(function (resolve, reject) {
        var isResolved = false;

        var messageListener = function (event) {
          if (!event.data || (event.data.type !== '180_PAYMENT_SUCCESS' && event.data.type !== '180_PAYMENT_CLOSE')) {
            return;
          }

          if (event.data.type === '180_PAYMENT_SUCCESS') {
            isResolved = true;
            window.removeEventListener('message', messageListener);
            clearInterval(pollTimer);
            if (options.onSuccess) options.onSuccess(event.data);
            resolve(event.data);
          } else if (event.data.type === '180_PAYMENT_CLOSE') {
            window.removeEventListener('message', messageListener);
            clearInterval(pollTimer);
            if (!isResolved && options.onCancel) options.onCancel();
            resolve({ cancelled: true });
          }
        };

        window.addEventListener('message', messageListener);

        var pollTimer = setInterval(function () {
          if (popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', messageListener);
            if (!isResolved) {
              if (options.onCancel) options.onCancel();
              resolve({ cancelled: true });
            }
          }
        }, 500);
      });
    },

    /**
     * Internal: Open Bottom Sheet or Modal with Iframe
     */
    _openIframeOverlay: function (url, sessionId, uxMode, options) {
      var existingBackdrop = activeModalContainer || document.getElementById('one-eighty-pay-backdrop');
      if (existingBackdrop && existingBackdrop.parentNode) {
        existingBackdrop.parentNode.removeChild(existingBackdrop);
      }
      var strayExisting = document.querySelectorAll('#one-eighty-pay-backdrop');
      for (var s = 0; s < strayExisting.length; s++) {
        if (strayExisting[s].parentNode) strayExisting[s].parentNode.removeChild(strayExisting[s]);
      }
      activeModalContainer = null;

      var isBottomSheet = uxMode === 'bottom_sheet';

      // 1. Overlay Backdrop
      var backdrop = document.createElement('div');
      backdrop.id = 'one-eighty-pay-backdrop';
      backdrop.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 9999999',
        'background: rgba(9, 9, 11, 0.65)',
        'backdrop-filter: blur(8px)',
        '-webkit-backdrop-filter: blur(8px)',
        'display: flex',
        'align-items: ' + (isBottomSheet ? 'flex-end' : 'center'),
        'justify-content: center',
        'opacity: 0',
        'cursor: pointer',
        'transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      ].join(';');

      // 2. Drawer / Modal Container
      var drawer = document.createElement('div');
      drawer.id = 'one-eighty-pay-drawer';
      
      var drawerBaseStyles = [
        'position: relative',
        'width: 100%',
        'display: flex',
        'flex-direction: column',
        'background: #ffffff',
        'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        'overflow: hidden',
        'cursor: default',
        'transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      ];

      if (isBottomSheet) {
        drawerBaseStyles.push(
          'max-width: 520px',
          'height: min(88vh, 760px)',
          'border-top-left-radius: 32px',
          'border-top-right-radius: 32px',
          'border-top: 1px solid rgba(255, 255, 255, 0.4)',
          'box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.35)',
          'transform: translateY(100%)'
        );
      } else {
        drawerBaseStyles.push(
          'max-width: 480px',
          'height: min(90vh, 700px)',
          'border-radius: 28px',
          'border: 1px solid #e4e4e7',
          'transform: scale(0.95)'
        );
      }
      drawer.style.cssText = drawerBaseStyles.join(';');

      // 3. Header tactile drag zone & Close Button
      var header = document.createElement('div');
      header.style.cssText = [
        'flex-shrink: 0',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'position: relative',
        'padding: ' + (isBottomSheet ? '14px 16px 10px' : '10px 14px'),
        'background: #ffffff',
        'user-select: none',
        '-webkit-user-select: none',
        'touch-action: none',
        'cursor: ' + (isBottomSheet ? 'grab' : 'default')
      ].join(';');

      var dragBar = null;
      if (isBottomSheet) {
        dragBar = document.createElement('div');
        dragBar.style.cssText = [
          'width: 44px',
          'height: 5px',
          'border-radius: 9999px',
          'background: #cbd5e1',
          'pointer-events: none',
          'transition: background 0.15s ease, transform 0.15s ease'
        ].join(';');
        header.appendChild(dragBar);
      }

      // Close Icon Button
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close checkout');
      closeBtn.style.cssText = [
        'position: absolute',
        'top: 50%',
        'right: 14px',
        'transform: translateY(-50%)',
        'width: 32px',
        'height: 32px',
        'border-radius: 50%',
        'border: 1px solid rgba(0, 0, 0, 0.08)',
        'background: #f1f5f9',
        'color: #64748b',
        'cursor: pointer',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 0',
        'outline: none',
        'z-index: 20',
        'pointer-events: auto',
        'transition: background 0.15s ease, color 0.15s ease'
      ].join(';');
      closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      header.appendChild(closeBtn);

      // 4. Iframe wrapper (fills remaining space below header)
      var iframeWrapper = document.createElement('div');
      iframeWrapper.style.cssText = 'flex: 1; width: 100%; overflow: hidden;';

      var iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = [
        'width: 100%',
        'height: 100%',
        'border: none',
        'background: #ffffff'
      ].join(';');

      iframeWrapper.appendChild(iframe);
      drawer.appendChild(header);
      drawer.appendChild(iframeWrapper);
      backdrop.appendChild(drawer);
      document.body.appendChild(backdrop);
      activeModalContainer = backdrop;

      // Prevent background scrolling
      document.body.style.overflow = 'hidden';

      // Animate In
      requestAnimationFrame(function () {
        backdrop.style.opacity = '1';
        if (isBottomSheet) {
          drawer.style.transform = 'translateY(0)';
        } else {
          drawer.style.transform = 'scale(1)';
        }
      });

      var self = this;

      return new Promise(function (resolve) {
        var removeDragListeners = function () {};
        var isDismissed = false;

        var cleanup = function () {
          if (isDismissed) return;
          isDismissed = true;
          window.removeEventListener('message', messageListener);
          document.removeEventListener('keydown', escListener);
          removeDragListeners();
          self.close();
        };

        var handleCloseClick = function (e) {
          if (e) {
            try { e.preventDefault(); } catch (_) {}
            try { e.stopPropagation(); } catch (_) {}
          }
          cleanup();
          if (options.onCancel) options.onCancel();
          resolve({ cancelled: true });
        };

        closeBtn.addEventListener('click', handleCloseClick);
        closeBtn.addEventListener('mousedown', function (e) {
          e.stopPropagation();
        });
        closeBtn.addEventListener('touchstart', function (e) {
          e.stopPropagation();
        }, { passive: true });

        var messageListener = function (event) {
          if (!event.data) return;
          var data = event.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (_) {
              return;
            }
          }
          if (!data || typeof data !== 'object') return;

          var successTypes = ['180_PAYMENT_SUCCESS', '180_PAY_SUCCESS'];
          var closeTypes = ['180_PAYMENT_CLOSE', '180_PAY_CLOSE', '180_IDENTITY_CLOSE', '180_MODAL_CLOSE'];

          if (successTypes.indexOf(data.type) !== -1) {
            cleanup();
            if (options.onSuccess) options.onSuccess(data);
            resolve(data);
          } else if (closeTypes.indexOf(data.type) !== -1) {
            cleanup();
            if (options.onCancel) options.onCancel();
            resolve({ cancelled: true });
          }
        };

        var escListener = function (e) {
          if (e.key === 'Escape' || e.keyCode === 27) {
            cleanup();
            if (options.onCancel) options.onCancel();
            resolve({ cancelled: true });
          }
        };

        // ─── Native App Gestures: Drag Up / Drag Down Physics ─────────────
        if (isBottomSheet) {
          var isDragging = false;
          var startY = 0;
          var currentDeltaY = 0;
          var drawerHeight = 0;

          var onDragStart = function (clientY) {
            isDragging = true;
            startY = clientY;
            currentDeltaY = 0;
            drawerHeight = drawer.offsetHeight || 600;
            drawer.style.transition = 'none';
            backdrop.style.transition = 'none';
            header.style.cursor = 'grabbing';
            if (dragBar) {
              dragBar.style.background = '#94a3b8';
              dragBar.style.transform = 'scaleX(1.15)';
            }
          };

          var onDragMove = function (clientY) {
            if (!isDragging) return;
            var delta = clientY - startY;
            if (delta < 0) {
              // Upward dragging: rubber-band elastic damping resistance
              currentDeltaY = delta * 0.22;
            } else {
              // Downward dragging: direct 1:1 finger tracking
              currentDeltaY = delta;
            }
            drawer.style.transform = 'translateY(' + currentDeltaY + 'px)';
            if (currentDeltaY > 0) {
              var progress = Math.min(currentDeltaY / Math.max(drawerHeight * 0.6, 200), 1);
              backdrop.style.opacity = String(Math.max(0.1, 1 - progress * 0.85));
            } else {
              backdrop.style.opacity = '1';
            }
          };

          var onDragEnd = function () {
            if (!isDragging) return;
            isDragging = false;
            header.style.cursor = 'grab';
            if (dragBar) {
              dragBar.style.background = '#cbd5e1';
              dragBar.style.transform = 'scaleX(1)';
            }

            drawer.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
            backdrop.style.transition = 'opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1)';

            // Dismiss threshold: 75px
            if (currentDeltaY > 75) {
              drawer.style.transform = 'translateY(100%)';
              backdrop.style.opacity = '0';
              setTimeout(function () {
                cleanup();
                if (options.onCancel) options.onCancel();
                resolve({ cancelled: true });
              }, 220);
            } else {
              // Elastic snap-back
              drawer.style.transform = 'translateY(0)';
              backdrop.style.opacity = '1';
            }
          };

          // Touch listeners
          var touchStartHandler = function (e) {
            if (closeBtn && (e.target === closeBtn || closeBtn.contains(e.target))) {
              return;
            }
            if (e.touches && e.touches[0]) {
              onDragStart(e.touches[0].clientY);
            }
          };
          var touchMoveHandler = function (e) {
            if (isDragging && e.touches && e.touches[0]) {
              onDragMove(e.touches[0].clientY);
            }
          };
          var touchEndHandler = function () {
            if (isDragging) onDragEnd();
          };

          // Mouse listeners
          var mouseDownHandler = function (e) {
            if (closeBtn && (e.target === closeBtn || closeBtn.contains(e.target))) {
              return;
            }
            e.preventDefault();
            onDragStart(e.clientY);
          };
          var mouseMoveHandler = function (e) {
            if (isDragging) {
              onDragMove(e.clientY);
            }
          };
          var mouseUpHandler = function () {
            if (isDragging) onDragEnd();
          };

          header.addEventListener('touchstart', touchStartHandler, { passive: true });
          window.addEventListener('touchmove', touchMoveHandler, { passive: true });
          window.addEventListener('touchend', touchEndHandler, { passive: true });
          window.addEventListener('touchcancel', touchEndHandler, { passive: true });

          header.addEventListener('mousedown', mouseDownHandler);
          window.addEventListener('mousemove', mouseMoveHandler);
          window.addEventListener('mouseup', mouseUpHandler);

          removeDragListeners = function () {
            header.removeEventListener('touchstart', touchStartHandler);
            window.removeEventListener('touchmove', touchMoveHandler);
            window.removeEventListener('touchend', touchEndHandler);
            window.removeEventListener('touchcancel', touchEndHandler);

            header.removeEventListener('mousedown', mouseDownHandler);
            window.removeEventListener('mousemove', mouseMoveHandler);
            window.removeEventListener('mouseup', mouseUpHandler);
          };
        }

        // ─── Instant Dismiss on Click Outside ─────────────────────────────
        var handleBackdropDismiss = function (e) {
          if (e.target === backdrop || (drawer && !drawer.contains(e.target))) {
            cleanup();
            if (options.onCancel) options.onCancel();
            resolve({ cancelled: true });
          }
        };

        backdrop.addEventListener('click', handleBackdropDismiss);
        backdrop.addEventListener('touchend', function (e) {
          if (e.target === backdrop || (drawer && !drawer.contains(e.target))) {
            handleBackdropDismiss(e);
          }
        }, { passive: true });

        window.addEventListener('message', messageListener);
        document.addEventListener('keydown', escListener);
      });
    },

    /**
     * Dismiss active checkout drawer or modal
     */
    close: function () {
      var backdrop = activeModalContainer || document.getElementById('one-eighty-pay-backdrop');
      if (!backdrop) return;
      var drawer = backdrop.querySelector('#one-eighty-pay-drawer');
      
      if (drawer) {
        drawer.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        drawer.style.transform = 'translateY(100%)';
      }
      backdrop.style.transition = 'opacity 0.22s ease';
      backdrop.style.opacity = '0';

      setTimeout(function () {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        var strayBackdrops = document.querySelectorAll('#one-eighty-pay-backdrop');
        for (var i = 0; i < strayBackdrops.length; i++) {
          if (strayBackdrops[i].parentNode) {
            strayBackdrops[i].parentNode.removeChild(strayBackdrops[i]);
          }
        }
        document.body.style.overflow = '';
        if (activeModalContainer === backdrop) {
          activeModalContainer = null;
        }
      }, 240);
    },

    /**
     * Render Branded "Pay with 180 Pay" Drop-In Button
     */
    renderButton: function (target, options) {
      options = options || {};
      var element = typeof target === 'string' ? document.getElementById(target) : target;
      if (!element) throw new Error('[180 Pay] Target element not found');

      var text = options.text || 'Pay with 180 Pay';
      var theme = options.theme || 'dark'; // 'dark' | 'light'
      var isDark = theme === 'dark';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'one-eighty-pay-button';

      var bg = isDark ? '#09090b' : '#ffffff';
      var textCol = isDark ? '#ffffff' : '#09090b';
      var borderCol = isDark ? 'rgba(59, 130, 246, 0.4)' : '#e2e8f0';

      btn.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'gap: 10px',
        'background: ' + bg,
        'color: ' + textCol,
        'border: 1px solid ' + borderCol,
        'border-radius: 14px',
        'padding: 10px 20px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size: 14px',
        'font-weight: 700',
        'cursor: pointer',
        'box-shadow: 0 4px 14px rgba(37, 99, 235, 0.15)',
        'transition: all 0.2s ease',
        'outline: none',
        'user-select: none'
      ].join(';');

      btn.innerHTML = [
        '<div style="width: 22px; height: 22px; border-radius: 6px; background: #2563eb; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 900;">180</div>',
        '<span>' + text + '</span>'
      ].join('');

      var self = this;
      btn.onclick = function () {
        self.openCheckout(options);
      };

      element.innerHTML = '';
      element.appendChild(btn);
    },

    /**
     * Auto-initialize HTML elements marked with data-180-pay-button
     */
    init: function () {
      var targets = document.querySelectorAll('[data-180-pay-button], #180-pay-button');
      var self = this;
      targets.forEach(function (el) {
        if (el.getAttribute('data-180-pay-init')) return;
        el.setAttribute('data-180-pay-init', 'true');

        var sessionId = el.getAttribute('data-session-id') || '';
        var uxMode = el.getAttribute('data-ux-mode') || 'bottom_sheet';
        var theme = el.getAttribute('data-theme') || 'dark';

        self.renderButton(el, {
          sessionId: sessionId,
          uxMode: uxMode,
          theme: theme,
          onSuccess: function (data) {
            var callbackName = el.getAttribute('data-on-success');
            if (callbackName && typeof window[callbackName] === 'function') {
              window[callbackName](data);
            }
          }
        });
      });
    }
  };

  // Expose globally
  global.OneEightyPay = OneEightyPay;

  // Auto-init on DOMContentLoaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        OneEightyPay.init();
      });
    } else {
      OneEightyPay.init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
