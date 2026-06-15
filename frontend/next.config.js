/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // face-api.js references "fs"/"encoding" which don't exist in the browser;
  // stub them out so the client bundle builds.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      encoding: false,
    };
    return config;
  },
};

module.exports = nextConfig;
