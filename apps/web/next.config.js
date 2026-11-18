/* global process */
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';

// Strict production CSP vs developer-friendly local development CSP
const scriptSrc = isProduction
  ? `'self' 'unsafe-inline' https://www.gstatic.com`
  : `'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com`;

const connectSrc = isProduction
  ? `'self' https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.bigdatacloud.net https://fcm.googleapis.com https://firebaseinstallations.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://www.gstatic.com https://raktsetu-api-fsyx.onrender.com`
  : `'self' https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.bigdatacloud.net https://fcm.googleapis.com https://firebaseinstallations.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://www.gstatic.com https://raktsetu-api-fsyx.onrender.com http://localhost:3002 ws://localhost:* http://localhost:*`;

const cspHeader = `
  default-src 'self';
  script-src ${scriptSrc};
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob: https://*.tile.openstreetmap.org https://raw.githubusercontent.com https://unpkg.com;
  connect-src ${connectSrc};
  worker-src 'self' blob: https://www.gstatic.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self' https://wa.me https://www.google.com;
`
  .replace(/\s{2,}/g, ' ')
  .trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/shared'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3002/api/v1/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
