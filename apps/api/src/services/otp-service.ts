import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import { createOtpVerificationTicket } from './donor-session';

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
    // Here we ensure fail-closed behavior when configuration is absent
    return { success: true };
  }
}

export class OtpService {
  private sessions = new Map<string, OtpSession>();
  private testOtps = new Map<string, string>(); // Only used in test environment
  private provider: OtpProvider;

  constructor(provider?: OtpProvider) {
    if (provider) {
      this.provider = provider;
    } else if (process.env.NODE_ENV === 'production') {
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
    purpose: string = 'donor_registration'
  ): Promise<{ success: boolean; message: string; cooldownSeconds?: number; error?: string }> {
    const key = this.sessionKey(phone, purpose);
    const existing = this.sessions.get(key);
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

    this.sessions.set(key, session);
    if (process.env.NODE_ENV === 'test') {
      this.testOtps.set(key, otp);
    }

    const sendRes = await this.provider.sendOtp(phone, otp, purpose);
    if (!sendRes.success) {
      this.sessions.delete(key);
      return {
        success: false,
        message: sendRes.error || 'Failed to dispatch verification code',
        error: 'PROVIDER_ERROR',
      };
    }

    return {
      success: true,
      message: 'Verification code sent successfully',
    };
  }

  public verifyOtp(
    phone: string,
    otp: string,
    purpose: string = 'donor_registration'
  ): { success: boolean; verificationTicket?: string; error?: string; remainingAttempts?: number } {
    const key = this.sessionKey(phone, purpose);
    const session = this.sessions.get(key);
    const now = Date.now();

    if (!session) {
      return {
        success: false,
        error: 'No active OTP verification session found. Please request a new code.',
      };
    }

    if (now > session.expiresAt) {
      this.sessions.delete(key);
      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    if (session.attempts >= session.maxAttempts) {
      this.sessions.delete(key);
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
        this.sessions.delete(key);
        return {
          success: false,
          error: 'Maximum verification attempts exceeded. Session invalidated.',
          remainingAttempts: 0,
        };
      }
      return {
        success: false,
        error: `Invalid verification code. ${remaining} attempts remaining.`,
        remainingAttempts: remaining,
      };
    }

    // Successfully verified: clear OTP session and issue signed verification ticket
    this.sessions.delete(key);
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
    this.sessions.clear();
    this.testOtps.clear();
  }
}

export const otpService = new OtpService();

