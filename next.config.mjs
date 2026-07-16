/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Audio files can be large; allow bigger request bodies to the route handlers.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
