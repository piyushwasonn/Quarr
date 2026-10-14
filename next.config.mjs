/** @type {import('next').NextConfig} */
const nextConfig = {
  // The crawler and Prisma run in the worker and in server routes only.
  serverExternalPackages: ["playwright-core", "@prisma/client"],
  poweredByHeader: false,
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
