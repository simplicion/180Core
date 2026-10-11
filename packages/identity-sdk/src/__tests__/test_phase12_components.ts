import {
  OneEightyPricingTable,
  OneEightyGeoBanner,
  use180GeoPricing,
  register180WebComponents,
} from '../index';

async function main() {
  console.log('--- Testing Phase 12 Client SDK Components & Web Components ---');

  if (typeof OneEightyPricingTable !== 'function') {
    throw new Error('OneEightyPricingTable component is not exported');
  }
  if (typeof OneEightyGeoBanner !== 'function') {
    throw new Error('OneEightyGeoBanner component is not exported');
  }
  if (typeof use180GeoPricing !== 'function') {
    throw new Error('use180GeoPricing hook is not exported');
  }
  if (typeof register180WebComponents !== 'function') {
    throw new Error('register180WebComponents function is not exported');
  }

  console.log('✅ OneEightyPricingTable Component Exported');
  console.log('✅ OneEightyGeoBanner Component Exported');
  console.log('✅ use180GeoPricing React Hook Exported');
  console.log('✅ register180WebComponents Function Exported');

  console.log('✅ Phase 12 Client Components & Web Components 100% PASSED!');
}

main().catch((err) => {
  console.error('Phase 12 Test Failed:', err);
  process.exit(1);
});
