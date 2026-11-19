import dotenv from 'dotenv';

// Earlier files win; platform-injected variables (Vercel, Netlify) are never overridden.
for (const file of ['.env.development.local', '.env.local', '.env']) {
  dotenv.config({ path: file, quiet: true });
}
