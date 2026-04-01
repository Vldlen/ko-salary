/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compress responses with gzip
  compress: true,
  // Optimize images
  images: {
    formats: ['image/webp'],
  },
  // Minimize JS in production
  swcMinify: true,
  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}
module.exports = nextConfig
