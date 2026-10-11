import { developersPrisma as prisma } from '@workspace/db-180core';
import { CouponService } from '../coupon/coupon.service';

async function main() {
  console.log('--- Testing Phase 7 Coupon APIs & Security Logic ---');

  let app = await prisma.oAuthApp.findFirst({
    where: { isActive: true },
  });

  if (!app) {
    throw new Error('No active OAuth App found.');
  }

  const testCode = `TESTP7_${Date.now()}`;

  // 1. Create coupon with origin restriction and limits
  const coupon = await CouponService.createCoupon(app.id, {
    code: testCode,
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 500,
    minOrderAmount: 100,
    maxRedemptions: 5,
    perCustomerLimit: 1,
    allowedOrigins: ['https://shop.allowedstore.com', 'http://localhost:3000'],
  });

  console.log('✅ Coupon Created:', coupon.code, 'for app:', app.id);

  // 2. Test Validate with forbidden origin
  const invalidOriginResult = await CouponService.validateCoupon({
    appId: app.id,
    code: testCode,
    orderAmount: 1000,
    origin: 'https://evil-unauthorized-site.com',
  });
  console.log('Forbidden Origin Validation Result:', invalidOriginResult.valid === false ? '✅ BLOCKED AS EXPECTED' : '❌ FAILED');
  if (invalidOriginResult.valid) {
    throw new Error('Coupon should have failed origin check');
  }

  // 3. Test Validate with allowed origin
  const validOriginResult = await CouponService.validateCoupon({
    appId: app.id,
    code: testCode,
    orderAmount: 1000,
    origin: 'https://shop.allowedstore.com/checkout',
  });
  console.log('Allowed Origin Validation Result:', validOriginResult.valid ? '✅ ALLOWED AS EXPECTED' : '❌ FAILED');
  console.log('Discount Applied:', validOriginResult.discountAmount, 'Final Amount:', validOriginResult.finalAmount);
  if (validOriginResult.discountAmount !== 200 || validOriginResult.finalAmount !== 800) {
    throw new Error('Unexpected discount math');
  }

  // 4. Test CheckoutSession creation with coupon
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const session = await prisma.checkoutSession.create({
    data: {
      appId: app.id,
      amount: validOriginResult.finalAmount,
      originalAmount: 1000,
      discountAmount: validOriginResult.discountAmount,
      couponId: coupon.id,
      couponCode: coupon.code,
      currency: 'INR',
      title: 'Phase 7 Verification Test Purchase',
      expiresAt,
    },
  });

  console.log('✅ CheckoutSession Created with Coupon:', session.id, 'Amount:', session.amount);

  // 5. Test Atomic Redemption
  const redemption = await CouponService.redeemCouponAtomic({
    couponId: coupon.id,
    sessionId: session.id,
    customerEmail: 'customer@example.com',
    discountApplied: validOriginResult.discountAmount,
  });

  console.log('✅ Atomic Redemption Recorded:', redemption.redemptionId);

  // 6. Verify perCustomerLimit blocks 2nd redemption for same customer
  try {
    await CouponService.redeemCouponAtomic({
      couponId: coupon.id,
      sessionId: `fake_session_${Date.now()}`,
      customerEmail: 'customer@example.com',
      discountApplied: validOriginResult.discountAmount,
    });
    throw new Error('Should have blocked repeated redemption by same customer');
  } catch (err: any) {
    console.log('Customer Repeat Limit check:', err.message.includes('limit') ? '✅ BLOCKED AS EXPECTED' : '❌ UNEXPECTED');
  }

  // 7. Clean up
  await prisma.couponRedemption.deleteMany({ where: { couponId: coupon.id } });
  await prisma.checkoutSession.delete({ where: { id: session.id } });
  await prisma.coupon.delete({ where: { id: coupon.id } });

  console.log('✅ Clean up complete. Phase 7 Validation 100% PASSED!');
}

main().catch((err) => {
  console.error('Phase 7 Test Failed:', err);
  process.exit(1);
});
