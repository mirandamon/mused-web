import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
   // Ensure experimental features are correctly configured if needed
   // For Geist font, ensure fontLoaders configuration if required by older Next versions,
   // but usually handled automatically with App Router.
};

export default nextConfig;

     