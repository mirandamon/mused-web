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
       // Add Firebase Storage hostname if needed for images
       {
         protocol: 'https',
         hostname: 'storage.googleapis.com',
         port: '',
         // Update pathname to match your bucket structure if needed
         pathname: `/mused-5ef9f.appspot.com/**`,
       },
    ],
  },
   // Ensure experimental features are correctly configured if needed
   // For Geist font, ensure fontLoaders configuration if required by older Next versions,
   // but usually handled automatically with App Router.

    // Add rewrites for local development proxy to Firebase Storage
    async rewrites() {
      // Only apply rewrites in development mode
      if (process.env.NODE_ENV === 'development') {
        const firebaseStorageBaseUrl = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mused-5ef9f.appspot.com'}`;
        console.log(`Proxying /sounds/* to ${firebaseStorageBaseUrl}/sounds/* in development.`);
        return [
          {
            source: '/sounds/:path*',
            // Destination URL needs to point directly to the file path in the bucket
            destination: `${firebaseStorageBaseUrl}/sounds/:path*`,
          },
        ];
      }
      // No rewrites in production
      return [];
    },
};

export default nextConfig;
