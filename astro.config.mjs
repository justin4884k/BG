import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'hybrid',   // static by default, API routes opt-in to server
  adapter: vercel(),
  site: 'https://brazengrace.org',
});
