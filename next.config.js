/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'agentic-44d3fdab.vercel.app'
      ]
    }
  }
};

module.exports = nextConfig;
