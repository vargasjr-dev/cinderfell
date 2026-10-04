/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'vellymon.game', 'cinderfell.vercel.app']
    }
  },
  async rewrites() {
    return [
      // Cinderfell rename shims — old identifiers keep resolving after the rename.
      // DB rows still store /vellymon/* avatar paths and the old guide/API URLs.
      { source: '/vellymon/:path*', destination: '/cinderlings/:path*' },
      { source: '/guide/vellymon/:path*', destination: '/guide/cinderling/:path*' },
      { source: '/api/v1/users/:userId/vellymons', destination: '/api/v1/users/:userId/cinderlings' }
    ];
  }
};

module.exports = nextConfig;
