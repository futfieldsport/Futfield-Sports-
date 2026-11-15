#!/usr/bin/env node
/**
 * FUTFIELD Automated Netlify Environment & First-Deploy Sync Tool
 * Syncs required environment variables (Supabase, Paystack, Gemini, App URL)
 * from local .env or active shell environment directly to Netlify before deployment.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = new Set(process.argv.slice(2));
const shouldDeploy = args.has('--deploy');
const cwd = process.cwd();
const envPath = path.join(cwd, '.env');

const MANAGED_ENV_KEYS = [
  'GEMINI_API_KEY',
  'APP_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PUBLIC_KEY',
  'VITE_PAYSTACK_PUBLIC_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

function parseDotEnv(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && val) {
      result[key] = val;
    }
  }
  return result;
}

function runNetlify(netlifyArgs, opts = {}) {
  const res = spawnSync('npx', ['--no-install', 'netlify', ...netlifyArgs], {
    stdio: opts.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: process.env,
  });
  return res;
}

function main() {
  console.log('=== FUTFIELD Netlify Environment & Deployment Sync ===');

  const dotEnvVars = parseDotEnv(envPath);
  const collected = {};

  for (const key of MANAGED_ENV_KEYS) {
    const val = process.env[key] || dotEnvVars[key] || '';
    if (val && !val.startsWith('MY_') && !val.includes('your-')) {
      collected[key] = val;
    }
  }

  // Mirror Vite public equivalents if only backend keys are present
  if (!collected.VITE_SUPABASE_URL && collected.SUPABASE_URL) {
    collected.VITE_SUPABASE_URL = collected.SUPABASE_URL;
  }
  if (!collected.VITE_SUPABASE_ANON_KEY && collected.SUPABASE_ANON_KEY) {
    collected.VITE_SUPABASE_ANON_KEY = collected.SUPABASE_ANON_KEY;
  }
  if (!collected.VITE_PAYSTACK_PUBLIC_KEY && collected.PAYSTACK_PUBLIC_KEY) {
    collected.VITE_PAYSTACK_PUBLIC_KEY = collected.PAYSTACK_PUBLIC_KEY;
  }
  if (!collected.PAYSTACK_PUBLIC_KEY && collected.VITE_PAYSTACK_PUBLIC_KEY) {
    collected.PAYSTACK_PUBLIC_KEY = collected.VITE_PAYSTACK_PUBLIC_KEY;
  }
  if (!collected.APP_URL) {
    collected.APP_URL = 'https://futfieldsport.com.ng';
  }

  const keysToPush = Object.keys(collected);
  console.log(`Detected ${keysToPush.length} configured environment variables: ${keysToPush.join(', ')}`);

  const cliCheck = runNetlify(['--version'], { silent: true });
  if (cliCheck.status !== 0) {
    console.error('Netlify CLI not available. Run npm install first.');
    process.exit(1);
  }
  console.log('Netlify CLI:', (cliCheck.stdout || '').trim());

  // Check authentication / site link before attempting remote env push
  const statusRes = runNetlify(['status'], { silent: true });
  const statusText = `${statusRes.stdout || ''}\n${statusRes.stderr || ''}`;
  const isLinked =
    Boolean(process.env.NETLIFY_SITE_ID) ||
    /Current Netlify project|Project Id:|Site Id:/i.test(statusText);

  if (statusRes.status !== 0 || (!isLinked && !process.env.NETLIFY_AUTH_TOKEN)) {
    console.log('\nNetlify CLI is installed and ready for first-deploy sync.');
    console.log('To push all environment variables and deploy frontend + backend tools at once:');
    console.log('  1. npx netlify login');
    console.log('  2. npx netlify init   (or npx netlify link to attach your site)');
    console.log('  3. npm run netlify:deploy');
    process.exit(0);
  }

  // Push every detected env variable to Netlify project
  for (const [key, value] of Object.entries(collected)) {
    console.log(`Setting Netlify env var: ${key}`);
    const setRes = runNetlify(['env:set', key, value], { silent: false });
    if (setRes.status !== 0) {
      console.warn(`Warning: Could not push ${key} automatically. Verify site link.`);
    }
  }

  if (shouldDeploy) {
    console.log('\nDeploying FUTFIELD frontend + backend functions to Netlify production...');
    const deployRes = runNetlify(['deploy', '--build', '--prod'], { silent: false });
    process.exit(deployRes.status ?? 0);
  }
}

main();
