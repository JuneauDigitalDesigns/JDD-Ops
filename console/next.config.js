/** @type {import('next').NextConfig} */
const nextConfig = {
  // @jdd/ui ships source; Next compiles it. See template/next.config.js.
  transpilePackages: ['@jdd/ui'],
  reactStrictMode: true,
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
