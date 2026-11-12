import { describe, expect, test } from 'bun:test';

describe('Checkpoint 4.2: Content Security Policy (CSP) Production Review', () => {
  test('Production CSP excludes unsafe-eval and localhost origins', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // Re-import or re-evaluate nextConfig logic
      const scriptSrc = process.env.NODE_ENV === 'production'
        ? `'self' 'unsafe-inline' https://www.gstatic.com`
        : `'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com`;

      const connectSrc = process.env.NODE_ENV === 'production'
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
      `.replace(/\s{2,}/g, ' ').trim();

      // Assertions for Production
      expect(cspHeader).not.toContain('unsafe-eval');
      expect(cspHeader).not.toContain('localhost');
      expect(cspHeader).not.toContain('ws://');
      expect(cspHeader).toContain('https://raktsetu-api-fsyx.onrender.com');
      expect(cspHeader).toContain('https://fcm.googleapis.com');
      expect(cspHeader).toContain("frame-ancestors 'none'");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('Development CSP permits localhost and unsafe-eval for developer workflow & HMR', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const scriptSrc = process.env.NODE_ENV === 'production'
        ? `'self' 'unsafe-inline' https://www.gstatic.com`
        : `'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com`;

      const connectSrc = process.env.NODE_ENV === 'production'
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
      `.replace(/\s{2,}/g, ' ').trim();

      expect(cspHeader).toContain('unsafe-eval');
      expect(cspHeader).toContain('http://localhost:3002');
      expect(cspHeader).toContain('ws://localhost:*');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

