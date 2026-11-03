/** @type {import('next').NextConfig} */
const nextConfig = {
  // @jdd/ui ships source; Next compiles it. See template/next.config.js.
  transpilePackages: ['@jdd/ui'],
  reactStrictMode: true,
  // File tracing (@vercel/nft) is what made `next build` never finish. Server code here
  // builds paths from runtime roots — resolve(clientDir(slug), 'site.ts'), resolve(dir,
  // '.env.local') — and nft, unable to evaluate the root, expands each to a glob from the
  // cwd: `<console>/**/*/site.ts`, `<console>/**/*/.env.local`, `<console>/**/*/site-*`.
  // That walk descends node_modules and, in the main checkout, console/.claude/worktrees,
  // where every worktree is a full repo with its own node_modules. One worker sat on it
  // for 20+ minutes. Traces only feed `output: 'standalone'` and Vercel deploys, and the
  // console is never deployed, so nothing reads them. Next 15 drops this option: if you
  // upgrade, replace it with `outputFileTracingExcludes` covering those globs.
  outputFileTracing: false,
  experimental: {
    // Tree-shake heavy barrel packages so a route compiles only the
    // icons/components it actually imports, not the whole library.
    // Applies to the webpack dev/build path; Turbopack does its own.
    optimizePackageImports: [
      '@phosphor-icons/react',
      'framer-motion',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
};

module.exports = nextConfig;
