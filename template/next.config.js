/** @type {import('next').NextConfig} */
const nextConfig = {
  // @jdd/ui ships SOURCE, not a compiled dist, so Next has to compile it. That is what keeps
  // LeadForm's 'use client' directive intact — a tsc emit can drop or hoist it, and a
  // client component from node_modules without it silently becomes a server component.
  transpilePackages: ['@jdd/ui'],
  reactStrictMode: true,
};

module.exports = nextConfig;
