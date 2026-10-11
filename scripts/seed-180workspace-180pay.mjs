import { corePrisma } from '../packages/db-180core/src/index.ts';
import { prisma } from '../packages/db/src/index.ts';

async function seed() {
  console.log('--- Seeding 180workspace Plans into 180 Pay & Workspace Database ---');

  // 1. Locate 180workspace OAuthApp in db-180core
  const app = await corePrisma.oAuthApp.findFirst({
    where: {
      OR: [
        { clientId: '180_client_70d751541f05347fe803ec8e128f5e83' },
        { id: '8bc81b3e-8510-4144-8c47-c43fe46d71a3' },
        { name: '180workspace' }
      ]
    }
  });

  if (!app) {
    throw new Error('OAuthApp for 180workspace not found in db-180core!');
  }

  console.log(`Found 180workspace app: ${app.name} (${app.id}, clientId: ${app.clientId})`);

  // Ensure enablePay is true
  if (!app.enablePay) {
    await corePrisma.oAuthApp.update({
      where: { id: app.id },
      data: { enablePay: true }
    });
    console.log('Enabled 180 Pay for 180workspace app');
  }

  // 2. Define the 3 plans: Kickstart ($10), Momentum ($17), Limitless ($20)
  const plansData = [
    {
      planCode: '180-kickstart',
      name: '180 Kickstart',
      description: 'Essential workspace foundations with unified Work Graph data isolation for solopreneurs and early ventures.',
      amount: 10,
      yearlyAmount: 96,
      currency: 'USD',
      interval: 'MONTHLY',
      trialDays: 0,
      isPopular: false,
      badgeText: 'Essential',
      badgeColor: 'slate',
      buttonText: 'Get Started',
      features: [
        { text: 'Access to 5 Core Applications', included: true },
        { text: 'Up to 2 Team Members', included: true },
        { text: '1 Active Website / Custom CNAME', included: true },
        { text: '1 GB Cloud Storage', included: true },
        { text: 'Standard Community & Ticket Support', included: true },
        { text: 'Unified Work Graph Data Isolation', included: true }
      ],
      featureKeys: [
        '5_core_apps',
        '2_team_members',
        '1_website',
        '1gb_storage',
        'standard_support',
        'work_graph_isolation'
      ]
    },
    {
      planCode: '180-momentum',
      name: '180 Momentum',
      description: 'Expanded application capacity, AI copilot intelligence, and custom SMTP email routing for scaling businesses.',
      amount: 17,
      yearlyAmount: 163,
      currency: 'USD',
      interval: 'MONTHLY',
      trialDays: 14,
      isPopular: true,
      badgeText: 'Most Popular',
      badgeColor: 'indigo',
      buttonText: 'Start 14-Day Free Trial',
      features: [
        { text: 'Access to 7 Applications', included: true },
        { text: 'Up to 5 Team Members', included: true },
        { text: 'Up to 5 Active Websites', included: true },
        { text: '10 GB Cloud Storage', included: true },
        { text: 'Orbit AI Copilot Access', included: true },
        { text: 'Custom Email SMTP Integration', included: true },
        { text: 'Priority Email & Ticket Support', included: true },
        { text: 'Cross-App Event Triggers & Workflows', included: true }
      ],
      featureKeys: [
        '7_apps',
        '5_team_members',
        '5_websites',
        '10gb_storage',
        'orbit_ai_access',
        'custom_smtp',
        'priority_support',
        'cross_app_triggers'
      ]
    },
    {
      planCode: '180-limitless',
      name: '180 Limitless',
      description: 'Complete unrestricted access to all 15+ applications, 20 team seats, and sub-5ms edge traffic routing.',
      amount: 20,
      yearlyAmount: 192,
      currency: 'USD',
      interval: 'MONTHLY',
      trialDays: 14,
      isPopular: false,
      badgeText: 'Scale & Enterprise',
      badgeColor: 'violet',
      buttonText: 'Start 14-Day Free Trial',
      features: [
        { text: 'Unlimited Access to All 15+ Applications', included: true },
        { text: 'Up to 20 Team Members Included', included: true },
        { text: 'Unlimited Websites & Automated SSL', included: true },
        { text: '20 GB High-Speed Cloud Storage', included: true },
        { text: 'Sub-5ms Traffic Director & Bot Shield', included: true },
        { text: 'Dedicated Team & Priority Support', included: true },
        { text: 'Orbit AI Copilot Full Capabilities', included: true },
        { text: 'Custom Email SMTP & Webhook Integrations', included: true },
        { text: 'Enterprise Multi-Tenant Security & RBAC', included: true }
      ],
      featureKeys: [
        'all_apps_unlimited',
        '20_team_members',
        'unlimited_websites_ssl',
        '20gb_storage',
        'traffic_director_edge',
        'dedicated_support',
        'orbit_ai_full',
        'smtp_webhooks',
        'enterprise_rbac'
      ]
    }
  ];

  // 3. Upsert into corePrisma.subscriptionPlan (180 Pay Recurring Engine)
  for (const p of plansData) {
    await corePrisma.subscriptionPlan.upsert({
      where: {
        appId_planCode: {
          appId: app.id,
          planCode: p.planCode
        }
      },
      update: {
        name: p.name,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        interval: p.interval,
        trialDays: p.trialDays,
        isActive: true,
        metadata: {
          features: p.features,
          featureKeys: p.featureKeys,
          isPopular: p.isPopular,
          badgeText: p.badgeText,
          badgeColor: p.badgeColor,
          buttonText: p.buttonText,
          trialDays: p.trialDays,
          yearlyAmount: p.yearlyAmount
        }
      },
      create: {
        appId: app.id,
        planCode: p.planCode,
        name: p.name,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        interval: p.interval,
        trialDays: p.trialDays,
        isActive: true,
        metadata: {
          features: p.features,
          featureKeys: p.featureKeys,
          isPopular: p.isPopular,
          badgeText: p.badgeText,
          badgeColor: p.badgeColor,
          buttonText: p.buttonText,
          trialDays: p.trialDays,
          yearlyAmount: p.yearlyAmount
        }
      }
    });
    console.log(`✓ Seeded 180 Pay plan: ${p.name} ($${p.amount}/mo)`);
  }

  // 4. Upsert into corePrisma.pricingTableConfig
  await corePrisma.pricingTableConfig.upsert({
    where: { appId: app.id },
    update: {
      headline: '180workspace Plans & Pricing',
      subheadline: 'Choose the plan that fits your growth with no per-seat penalties or hidden fees.',
      theme: 'auto',
      accentColor: '#6366f1',
      billingIntervals: ['MONTHLY', 'YEARLY'],
      yearlyDiscountPct: 20,
      planCards: plansData.map(p => ({
        planCode: p.planCode,
        name: p.name,
        description: p.description,
        amount: p.amount,
        yearlyAmount: p.yearlyAmount,
        currency: p.currency,
        interval: p.interval,
        trialDays: p.trialDays,
        isPopular: p.isPopular,
        badgeText: p.badgeText,
        badgeColor: p.badgeColor,
        features: p.features,
        featureKeys: p.featureKeys,
        buttonText: p.buttonText,
        isFree: false
      })),
      customCss: ''
    },
    create: {
      appId: app.id,
      headline: '180workspace Plans & Pricing',
      subheadline: 'Choose the plan that fits your growth with no per-seat penalties or hidden fees.',
      theme: 'auto',
      accentColor: '#6366f1',
      billingIntervals: ['MONTHLY', 'YEARLY'],
      yearlyDiscountPct: 20,
      planCards: plansData.map(p => ({
        planCode: p.planCode,
        name: p.name,
        description: p.description,
        amount: p.amount,
        yearlyAmount: p.yearlyAmount,
        currency: p.currency,
        interval: p.interval,
        trialDays: p.trialDays,
        isPopular: p.isPopular,
        badgeText: p.badgeText,
        badgeColor: p.badgeColor,
        features: p.features,
        featureKeys: p.featureKeys,
        buttonText: p.buttonText,
        isFree: false
      })),
      customCss: ''
    }
  });
  console.log('✓ Seeded PricingTableConfig for 180workspace in 180 Pay Studio');

  // 5. Update workspace database Plan table in @workspace/db
  const workspaceDbPlans = [
    {
      planName: '180 Kickstart',
      price: 10,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 2,
      maxWebsites: 1,
      maxApps: 5,
      maxStorageBytes: 1 * 1024 * 1024 * 1024,
      features: [
        'Access to 5 Apps',
        'Up to 2 Team Members',
        '1 Website',
        '1GB Cloud Storage',
        'Standard Support'
      ],
      isActive: true,
      trialDays: 0
    },
    {
      planName: '180 Momentum',
      price: 17,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 5,
      maxWebsites: 5,
      maxApps: 7,
      maxStorageBytes: 10 * 1024 * 1024 * 1024,
      features: [
        'Access to 7 Apps',
        'Up to 5 Team Members',
        'Up to 5 Websites',
        '10GB Cloud Storage',
        'Priority Support',
        'AI Assistant Access',
        'Custom Email SMTP'
      ],
      isActive: true,
      trialDays: 14
    },
    {
      planName: '180 Limitless',
      price: 20,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 20,
      maxWebsites: -1,
      maxApps: 999,
      maxStorageBytes: 20 * 1024 * 1024 * 1024,
      features: [
        'Unlimited Access to All Apps',
        'Up to 20 Team Members',
        'Unlimited Websites',
        '20GB Cloud Storage',
        'Dedicated Team Support',
        'AI Assistant Access',
        'Custom Email SMTP'
      ],
      isActive: true,
      trialDays: 14
    }
  ];

  for (const wp of workspaceDbPlans) {
    const existing = await prisma.plan.findFirst({
      where: { planName: wp.planName }
    });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: wp
      });
      console.log(`✓ Updated workspace db plan: ${wp.planName} -> $${wp.price}/mo`);
    } else {
      await prisma.plan.create({
        data: wp
      });
      console.log(`✓ Created workspace db plan: ${wp.planName} -> $${wp.price}/mo`);
    }
  }

  console.log('=== All 180workspace plans seeded successfully ===');
}

seed()
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await corePrisma.$disconnect();
    await prisma.$disconnect();
  });
