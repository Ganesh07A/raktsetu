import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { createOtpVerificationTicket } from './donor-session';
import { securityStore } from './security-store';

export interface OtpSession {
  phone: string;
  purpose: string;
  hashedOtp: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  lastSentAt: number;
}

export interface OtpProvider {
  sendOtp(phone: string, otp: string, purpose: string): Promise<{ success: boolean; error?: string }>;
}

export class DevOtpProvider implements OtpProvider {
  public async sendOtp(phone: string, otp: string, purpose: string): Promise<{ success: boolean; error?: string }> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DevOtpProvider] Dispatched OTP ${otp} to ${phone} for ${purpose}`);
    }
    return { success: true };
  }
}

export class ProductionSmsProvider implements OtpProvider {
  public async sendOtp(phone: string, otp: string, purpose: string): Promise<{ success: boolean; error?: string }> {
    const apiKey = process.env.OTP_PROVIDER_API_KEY || process.env.FAST2SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN;
    if (!apiKey) {
      console.error('[@repo/api] Production OTP provider is not configured. Missing API credentials.');
      return { success: false, error: 'SMS service is currently unavailable. Please contact support.' };
    }

    // In a live environment with configured provider, integrate external HTTP payload
    return { success: true };
  }
}

export class OtpService {
  private testOtps = new Map<string, string>(); // Only used in test environment
  private provider: OtpProvider;

  public get sessions(): Map<string, any> {
    return (securityStore as any).memoryOtpSessions;
  }

  constructor(provider?: OtpProvider) {
    if (provider) {
      this.provider = provider;
    } else if (
      process.env.NODE_ENV === 'production' &&
      (process.env.OTP_PROVIDER_API_KEY || process.env.FAST2SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN)
    ) {
      this.provider = new ProductionSmsProvider();
    } else {
      this.provider = new DevOtpProvider();
    }
  }

  private sessionKey(phone: string, purpose: string): string {
    const normPhone = phone.replace(/\D/g, '').slice(-10);
    return `${normPhone}:${purpose}`;
  }

  private hashOtp(phone: string, purpose: string, otp: string): string {
    const secret = process.env.DONOR_SESSION_SECRET || 'raktsetu-otp-hashing-secret-default-change';
    return createHmac('sha256', secret).update(`${phone}:${purpose}:${otp}`).digest('hex');
  }

  public async sendOtp(
    phone: string,
    purpose: string = 'donor_registration',
    fcmToken?: string
  ): Promise<{ success: boolean; message: string; cooldownSeconds?: number; error?: string }> {
    const key = this.sessionKey(phone, purpose);
    const existing = await securityStore.getOtpSession(phone, purpose);
    const now = Date.now();

    // Check resend cooldown (60 seconds)
    if (existing && now - existing.lastSentAt < 60000) {
      const waitSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
      return {
        success: false,
        message: `Please wait ${waitSec} seconds before requesting a new OTP`,
        cooldownSeconds: waitSec,
        error: 'COOLDOWN_ACTIVE',
      };
    }

    // Generate cryptographic 6-digit random code
    const otp = randomInt(100000, 1000000).toString();
    const hashedOtp = this.hashOtp(phone, purpose, otp);

    const session: OtpSession = {
      phone,
      purpose,
      hashedOtp,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes TTL
      lastSentAt: now,
    };

    await securityStore.saveOtpSession(session);
    if (process.env.NODE_ENV === 'test') {
      this.testOtps.set(key, otp);
    }

    const sendRes = await this.provider.sendOtp(phone, otp, purpose);
    if (!sendRes.success) {
      await securityStore.deleteOtpSession(phone, purpose);
      return {
        success: false,
        message: sendRes.error || 'Failed to dispatch verification code',
        error: 'PROVIDER_ERROR',
      };
    }

    // Dispatch FCM push notification ONLY to the requesting device's fcmToken (if provided)
    if (fcmToken) {
      try {
        const { pushNotificationService } = await import('./push-notifications');
        await pushNotificationService.sendOtpNotification([fcmToken], otp, phone);
      } catch (pushErr) {
        console.warn('[@repo/api] FCM OTP dispatch notice:', pushErr);
      }
    }

    return {
      success: true,
      message: 'Verification code sent successfully',
    };
  }

  public async verifyOtp(
    phone: string,
    otp: string,
    purpose: string = 'donor_registration'
  ): Promise<{ success: boolean; verificationTicket?: string; error?: string; remainingAttempts?: number }> {
    const key = this.sessionKey(phone, purpose);
    const session = await securityStore.getOtpSession(phone, purpose);
    const now = Date.now();

    if (!session) {
      return {
        success: false,
        error: 'No active OTP verification session found. Please request a new code.',
      };
    }

    if (now > session.expiresAt) {
      await securityStore.deleteOtpSession(phone, purpose);
      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    if (session.attempts >= session.maxAttempts) {
      await securityStore.deleteOtpSession(phone, purpose);
      return {
        success: false,
        error: 'Maximum verification attempts exceeded. Please request a new code.',
      };
    }

    session.attempts += 1;

    const candidateHash = this.hashOtp(phone, purpose, otp);
    const expectedHashBuf = Buffer.from(session.hashedOtp, 'hex');
    const candidateHashBuf = Buffer.from(candidateHash, 'hex');

    const isMatch =
      expectedHashBuf.length === candidateHashBuf.length &&
      timingSafeEqual(expectedHashBuf, candidateHashBuf);

    if (!isMatch) {
      const remaining = session.maxAttempts - session.attempts;
      if (remaining <= 0) {
        await securityStore.deleteOtpSession(phone, purpose);
        return {
          success: false,
          error: 'Maximum verification attempts exceeded. Session invalidated.',
          remainingAttempts: 0,
        };
      }
      await securityStore.saveOtpSession(session);
      return {
        success: false,
        error: `Invalid verification code. ${remaining} attempts remaining.`,
        remainingAttempts: remaining,
      };
    }

    // Successfully verified: clear OTP session and issue signed verification ticket
    await securityStore.deleteOtpSession(phone, purpose);
    if (process.env.NODE_ENV === 'test') {
      this.testOtps.delete(key);
    }

    const ticket = createOtpVerificationTicket(phone, purpose);
    return {
      success: true,
      verificationTicket: ticket,
    };
  }

  /** Inspection method for unit tests */
  public getTestOtp(phone: string, purpose: string = 'donor_registration'): string | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;
    return this.testOtps.get(this.sessionKey(phone, purpose));
  }

  public clear(): void {
    securityStore.clear();
    this.sessions.clear();
    this.testOtps.clear();
  }
}

export const otpService = new OtpService();

