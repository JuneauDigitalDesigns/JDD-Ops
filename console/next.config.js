/** @type {import('next').NextConfig} */
const nextConfig = {
  // @jdd/ui ships source; Next compiles it. See template/next.config.js.
  transpilePackages: ['@jdd/ui'],
  reactStrictMode: true,
};

module.exports = nextConfig;
