import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // The resume builder's Typst compiler is a native Node module: load it from node_modules at runtime.
  serverExternalPackages: ['@myriaddreamin/typst-ts-node-compiler'],
  // Ship the resume fonts (assets/fonts) and the Linux compiler binary with the resume builder routes.
  outputFileTracingIncludes: {
    // Each site's database is set up / upgraded from prisma/init.sql the first time a server uses it.
    '/**': ['./prisma/init.sql'],
    '/api/resume-builder/**': [
      './assets/fonts/**/*',
      './node_modules/@myriaddreamin/typst-ts-node-compiler-linux-x64-gnu/**/*',
    ],
  },
  // Local development of the multi-site platform: sites open at <address>.localhost:3000.
  allowedDevOrigins: ['*.localhost'],
  experimental: {
    optimizePackageImports: []
  }
};

export default nextConfig;
