/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['@iconify/react'],
  },
};

export default nextConfig;
