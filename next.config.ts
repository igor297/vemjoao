import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    // Configuração automática para Railway
    MONGODB_URI: process.env.NODE_ENV === 'production' 
      ? 'mongodb://mongo:dfSakOiePzOactfHNwqrQNfHnRlqBVZX@shuttle.proxy.rlwy.net:30512/condominio-sistema'
      : process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema',
    MONGODB_DB: 'condominio-sistema',
  },
  // Configuração para Railway
  serverExternalPackages: ['mongoose'],
  // Configuração de headers para Railway
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
