/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['sqlite3', 'bcryptjs']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('sqlite3');
    }
    return config;
  }
}

module.exports = nextConfig