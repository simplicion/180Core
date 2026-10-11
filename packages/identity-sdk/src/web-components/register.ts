'use strict';

/**
 * Native Custom Elements (Web Components) for framework-agnostic drop-in integration
 */
export function register180WebComponents() {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') {
    return;
  }

  // 1. <one-eighty-geo-banner>
  if (!customElements.get('one-eighty-geo-banner')) {
    class OneEightyGeoBannerElement extends HTMLElement {
      connectedCallback() {
        const appId = this.getAttribute('app-id') || '';
        const baseAmount = parseFloat(this.getAttribute('base-amount') || '50');
        const apiBaseUrl = this.getAttribute('api-url') || 'https://auth.180workspace.com';

        if (!appId) return;

        fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/v1/geo-pricing/resolve?appId=${encodeURIComponent(appId)}&baseAmount=${baseAmount}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data?.hasRegionalDiscount && json.data.banner) {
              const b = json.data.banner;
              this.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(15,23,42,0.9);color:#f8fafc;border-radius:8px;font-size:13px;font-family:sans-serif;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:18px;">${b.flag}</span>
                    <span><strong style="color:#34d399;margin-right:6px;">${json.data.discountPercentage}% OFF</strong>${b.message}</span>
                  </div>
                  <button style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;" onclick="this.closest('one-eighty-geo-banner').remove()">✕</button>
                </div>
              `;
            }
          })
          .catch(() => {});
      }
    }
    customElements.define('one-eighty-geo-banner', OneEightyGeoBannerElement);
  }

  // 2. <one-eighty-pricing-table>
  if (!customElements.get('one-eighty-pricing-table')) {
    class OneEightyPricingTableElement extends HTMLElement {
      connectedCallback() {
        const appId = this.getAttribute('app-id') || '';
        const plansRaw = this.getAttribute('plans') || '[]';
        let plans = [];
        try {
          plans = JSON.parse(plansRaw);
        } catch {
          plans = [];
        }

        if (!plans.length) return;

        this.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;font-family:sans-serif;color:#f8fafc;">
            ${plans.map((p: any) => `
              <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:700;">${p.name}</h3>
                  <div style="font-size:28px;font-weight:800;margin:12px 0;">₹${p.monthlyAmount}<span style="font-size:13px;color:#a1a1aa;font-weight:normal;"> /mo</span></div>
                  <ul style="list-style:none;padding:0;margin:16px 0;font-size:13px;color:#d4d4d8;display:flex;flex-direction:column;gap:8px;">
                    ${(p.features || []).map((f: string) => `<li>✓ ${f}</li>`).join('')}
                  </ul>
                </div>
                <button style="width:100%;padding:10px;background:#ffffff;color:#09090b;font-weight:700;border:none;border-radius:8px;cursor:pointer;" onclick="window.OneEightyPay ? window.OneEightyPay.checkout({ planId: '${p.id}', appId: '${appId}' }) : null">
                  Get Started
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
    customElements.define('one-eighty-pricing-table', OneEightyPricingTableElement);
  }
}

// Auto-register in browser
if (typeof window !== 'undefined') {
  register180WebComponents();
}
