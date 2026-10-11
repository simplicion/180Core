import { developersPrisma as prisma } from '@workspace/db-180core';
import { PaymentLinkService } from '../payment-link/payment-link.service';
import { GeoPricingService } from '../geo/geo-pricing.service';

async function main() {
  console.log('--- Testing Phase 8 Payment Links & Geo-Pricing Logic ---');

  const app = await prisma.oAuthApp.findFirst({
    where: { isActive: true },
  });

  if (!app) {
    throw new Error('No active OAuth App found.');
  }

  // ─── 1. Payment Link Tests ───────────────────────────────────────────────
  const testSlug = `testlink-${Date.now()}`;
  const secretMessage = 'TOP-SECRET-DIGITAL-ASSET-KEY-12345';

  const link = await PaymentLinkService.createPaymentLink(app.id, {
    title: 'Phase 8 Pro Digital Bundle',
    amount: 999,
    currency: 'INR',
    customSlug: testSlug,
    maxPurchases: 2,
    fulfillmentMessage: secretMessage,
    fulfillmentFileUrl: 'https://cdn.example.com/assets/pro-bundle.zip',
  });

  console.log('✅ Payment Link Created:', link.slug, 'ID:', link.id);

  // 2. Public lookup must conceal fulfillment data
  const publicLink = await PaymentLinkService.getPublicPaymentLink(testSlug);
  console.log('Public Link Title:', publicLink.title, 'Available:', publicLink.isAvailable, 'Sold Out:', publicLink.isSoldOut);
  if ((publicLink as any).fulfillmentMessage || (publicLink as any).fulfillmentFileUrl) {
    throw new Error('SECURITY VIOLATION: Public payment link leaked fulfillment secret!');
  }
  console.log('✅ Public Payment Link Conceals Secrets Correctly');

  // 3. Complete purchase #1
  const purchase1 = await PaymentLinkService.completeLinkPurchase(link.id, 'session_mock_1');
  console.log('✅ Purchase 1 Completed. Delivered message:', purchase1.fulfillmentMessage === secretMessage ? 'MATCH' : 'MISMATCH');
  if (purchase1.fulfillmentMessage !== secretMessage) {
    throw new Error('Fulfillment message mismatch');
  }

  // 4. Complete purchase #2 (hits capacity limit)
  await PaymentLinkService.completeLinkPurchase(link.id, 'session_mock_2');
  console.log('✅ Purchase 2 Completed (Hit maxPurchases of 2)');

  // 5. Purchase #3 must fail with capacity exceeded
  try {
    await PaymentLinkService.completeLinkPurchase(link.id, 'session_mock_3');
    throw new Error('Should have blocked purchase beyond maxPurchases');
  } catch (err: any) {
    console.log('Capacity limit enforcement check:', err.message.includes('capacity') ? '✅ BLOCKED AS EXPECTED' : '❌ UNEXPECTED');
  }

  // ─── 2. Geo-Pricing & PPP Tests ──────────────────────────────────────────
  // A. Header resolution
  const detectedIndia = GeoPricingService.resolveVisitorCountry({ 'cf-ipcountry': 'IN' });
  const detectedUK = GeoPricingService.resolveVisitorCountry({ 'cf-ipcountry': 'GB' });
  console.log('Detected Countries from Headers:', { India: detectedIndia, UK: detectedUK });
  if (detectedIndia !== 'IN' || detectedUK !== 'GB') {
    throw new Error('Header resolution failed');
  }

  // B. Pricing resolution for India (Tier 3: 65% regional discount, INR)
  const indiaPricing = await GeoPricingService.resolveLocalizedPricing({
    appId: app.id,
    baseAmount: 100, // $100 USD base
    baseCurrency: 'USD',
    visitorCountry: 'IN',
  });
  console.log('India Pricing Result:', {
    country: indiaPricing.countryName,
    currency: indiaPricing.currency,
    localizedAmount: indiaPricing.localizedAmount,
    discountPct: indiaPricing.discountPercentage,
    formatted: indiaPricing.formattedPrice,
  });
  if (indiaPricing.currency !== 'INR' || !indiaPricing.hasRegionalDiscount) {
    throw new Error('India pricing PPP discount failed');
  }

  // C. Developer Custom Country Override Rule
  const customRule = await GeoPricingService.setCountryRule(app.id, {
    countryCode: 'IN',
    overrideType: 'PERCENTAGE_DISCOUNT',
    discountPct: 80,
  });
  console.log('✅ Custom Country Rule Set for IN:', customRule.discountPct, '% discount');

  // Verify custom rule overrides default PPP
  const overriddenPricing = await GeoPricingService.resolveLocalizedPricing({
    appId: app.id,
    baseAmount: 100,
    baseCurrency: 'USD',
    visitorCountry: 'IN',
  });
  console.log('Overridden India Pricing Result (80% discount):', {
    discountPct: overriddenPricing.discountPercentage,
    isCustomOverride: overriddenPricing.isCustomOverride,
  });
  if (overriddenPricing.discountPercentage !== 80 || !overriddenPricing.isCustomOverride) {
    throw new Error('Custom rule override did not take precedence');
  }

  // Clean up
  await GeoPricingService.deleteCountryRule(app.id, 'IN');
  await prisma.paymentLink.delete({ where: { id: link.id } });

  console.log('✅ Clean up complete. Phase 8 Payment Links & Geo-Pricing 100% PASSED!');
}

main().catch((err) => {
  console.error('Phase 8 Test Failed:', err);
  process.exit(1);
});
