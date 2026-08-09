/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  eslint: {
    // Linting is run separately; do not fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
