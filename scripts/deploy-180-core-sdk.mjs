import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const srcJs = path.join(rootDir, 'packages', 'identity-sdk', 'src', '180-core-sdk.js');
const srcMinJs = path.join(rootDir, 'packages', 'identity-sdk', 'src', '180-core-sdk.min.js');
const srcDts = path.join(rootDir, 'packages', 'identity-sdk', 'src', '180-core-sdk.d.ts');

if (!fs.existsSync(srcJs) || !fs.existsSync(srcMinJs)) {
  console.error('Source files missing in packages/identity-sdk/src');
  process.exit(1);
}

const targetDirs = [
  path.join(rootDir, 'apps', '180developers-frontend', 'public', 'sdk'),
  path.join(rootDir, 'apps', '180developers-frontend', 'public', 'sdk', 'v1'),
  path.join(rootDir, 'apps', '180-profile-frontend', 'public', 'sdk'),
  path.join(rootDir, 'apps', '180-profile-frontend', 'public', 'sdk', 'v1'),
];
if (fs.existsSync(path.join(rootDir, 'apps', 'frontend'))) {
  targetDirs.push(path.join(rootDir, 'apps', 'frontend', 'public', 'sdk'));
  targetDirs.push(path.join(rootDir, 'apps', 'frontend', 'public', 'sdk', 'v1'));
}

console.log('================================================================');
console.log('🚀 180 Core SDK: Global CDN Distribution & Pipeline Sync');
console.log('================================================================\n');

// 1. Local Edge Public Mirrors
console.log('1️⃣ Synchronizing Local Static Edge Repositories...');
for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }

  const destJs = path.join(dir, '180-core-sdk.js');
  const destMinJs = path.join(dir, '180-core-sdk.min.js');
  const destDts = path.join(dir, '180-core-sdk.d.ts');

  fs.copyFileSync(srcJs, destJs);
  fs.copyFileSync(srcMinJs, destMinJs);
  fs.copyFileSync(srcDts, destDts);

  const rel = path.relative(rootDir, dir).replace(/\\/g, '/');
  console.log(`  ✅ Deployed to ${rel} (${fs.statSync(destMinJs).size} bytes minified)`);
}

// 2. Cloudflare R2 / AWS S3 Global CDN Direct Edge Upload (if credentials exist)
const r2Endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT;
const r2AccessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY;
const r2SecretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY;
const r2Bucket = process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || '180core';

if (r2Endpoint && r2AccessKey && r2SecretKey) {
  console.log('\n2️⃣ Cloudflare R2 Global CDN Credentials Detected — Synchronizing Edge Bucket...');
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKey,
        secretAccessKey: r2SecretKey,
      },
      maxAttempts: 3,
    });

    const uploads = [
      { key: 'sdk/v1/180-core-sdk.js', body: fs.readFileSync(srcJs) },
      { key: 'sdk/v1/180-core-sdk.min.js', body: fs.readFileSync(srcMinJs) },
      { key: 'sdk/180-core-sdk.js', body: fs.readFileSync(srcJs) },
      { key: 'sdk/180-core-sdk.min.js', body: fs.readFileSync(srcMinJs) },
    ];

    for (const item of uploads) {
      await s3.send(
        new PutObjectCommand({
          Bucket: r2Bucket,
          Key: item.key,
          Body: item.body,
          ContentType: 'application/javascript; charset=utf-8',
          CacheControl: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        })
      );
      console.log(`  ☁️ Cloudflare R2: Uploaded https://cdn.180workspace.com/${item.key}`);
    }
    console.log('  ✅ Cloudflare R2 Edge Sync Successful');
  } catch (err) {
    console.warn(`  ⚠️ Cloudflare R2 edge upload skipped or failed: ${err.message}`);
  }
} else {
  console.log('\n2️⃣ Cloudflare R2 Direct Sync: No direct S3/R2 credentials in current process (serving via Cloudflare Pages & Container static edge).');
}

console.log('\n================================================================');
console.log('🎉 180 Core SDK CDN Deployment Pipeline Completed Successfully');
console.log('================================================================\n');
