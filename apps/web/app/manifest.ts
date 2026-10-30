import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RaktKhoj — Emergency Blood Discovery (रक्तखोज)',
    short_name: 'RaktKhoj',
    description:
      'Emergency blood discovery and routing active engine connecting patients with verified blood banks and compatible volunteer donors in India.',
    start_url: '/',
    id: 'raktkhoj-pwa',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#dc2626',
    orientation: 'portrait',
    categories: ['medical', 'health'],
    lang: 'en-IN',
    dir: 'ltr',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Emergency Search',
        short_name: 'Find Blood',
        url: '/search',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Register as Donor',
        short_name: 'Donate Blood',
        url: '/donor/register',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
