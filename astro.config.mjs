import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Astro 5 removed 'hybrid' — use 'server' for SSR with optional prerendering.
  // All pages are server-rendered on Vercel (edge/serverless); the API route
  // uses prerender = false (already set) which is the default in server mode.
  output: 'server',
  adapter: vercel(),
  site: 'https://brazengrace.org',
});
