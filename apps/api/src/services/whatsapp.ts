import { mockStore, type OutboundWhatsAppMessage } from './mock-store';

export interface WhatsAppSendParams {
  recipientPhone: string;
  templateName?: string;
  language?: string;
  donorId: string;
  donorName: string;
  requestId: string;
  patientName: string;
  hospitalName: string;
  bloodGroup: string;
  unitsNeeded: number;
  distanceKm: number;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  mode: 'live' | 'mock';
  timestamp: string;
}

export class WhatsAppService {
  private readonly apiUrl = 'https://graph.facebook.com/v21.0';

  private get accessToken(): string | undefined {
    return process.env.WHATSAPP_ACCESS_TOKEN;
  }

  private get phoneNumberId(): string | undefined {
    return process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  public isLiveConfigured(): boolean {
    return Boolean(
      process.env.NODE_ENV !== 'test' &&
        this.accessToken &&
        this.phoneNumberId &&
        process.env.MOCK_SERVICES !== 'true'
    );
  }

  /**
   * Send emergency blood donation template request to volunteer donor
   */
  public async sendDonationRequest(
    params: WhatsAppSendParams
  ): Promise<WhatsAppSendResult> {
    const {
      recipientPhone,
      donorId,
      donorName,
      requestId,
      patientName,
      hospitalName,
      bloodGroup,
      unitsNeeded,
      distanceKm,
      templateName = 'blood_donation_request',
      language = 'en',
    } = params;

    const messageId = `wamid.HBgM${Date.now()}${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const timestamp = new Date().toISOString();

    const acceptButtonId = `accept_${requestId}_${donorId}`;
    const declineButtonId = `decline_${requestId}_${donorId}`;

    const parameters: Record<string, string> = {
      donor_name: donorName,
      patient_name: patientName,
      hospital_name: hospitalName,
      blood_group: bloodGroup,
      units_needed: String(unitsNeeded),
      distance_km: distanceKm.toFixed(1),
    };

    const interactiveButtons = [
      { id: acceptButtonId, title: '✅ I Can Donate' },
      { id: declineButtonId, title: '❌ Not Available' },
    ];

    // Always record in mock store for traceability & test inspection
    const outboundMsg: OutboundWhatsAppMessage = {
      id: messageId,
      recipientPhone,
      templateName,
      language,
      parameters,
      interactiveButtons,
      timestamp,
      requestId,
      donorId,
    };
    mockStore.recordOutboundWhatsApp(outboundMsg);

    if (this.isLiveConfigured()) {
      try {
        const payload = {
          messaging_product: 'whatsapp',
          to: recipientPhone.replace('+', ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: donorName },
                  { type: 'text', text: bloodGroup },
                  { type: 'text', text: hospitalName },
                  { type: 'text', text: `${distanceKm.toFixed(1)} km` },
                ],
              },
              {
                type: 'button',
                sub_type: 'quick_reply',
                index: '0',
                parameters: [{ type: 'payload', payload: acceptButtonId }],
              },
              {
                type: 'button',
                sub_type: 'quick_reply',
                index: '1',
                parameters: [{ type: 'payload', payload: declineButtonId }],
              },
            ],
          },
        };

        const res = await fetch(
          `${this.apiUrl}/${this.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          console.warn(
            '[@repo/api] WhatsApp template send was rejected. Trying interactive button message fallback:',
            res.status,
            errText
          );

          // Fallback to interactive button message (works seamlessly on test numbers)
          const fallbackPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhone.replace(/[^0-9]/g, ''),
            type: 'interactive',
            interactive: {
              type: 'button',
              body: {
                text: `🚨 *RaktKhoj Urgent Blood Request*\n\nHello *${donorName}*,\nImmediate requirement for *${bloodGroup}* (${unitsNeeded} unit(s)) at *${hospitalName}* (~${distanceKm.toFixed(1)} km away).\n\nCan you donate blood to save this patient?`,
              },
              action: {
                buttons: [
                  {
                    type: 'reply',
                    reply: {
                      id: acceptButtonId,
                      title: '✅ I Can Donate',
                    },
                  },
                  {
                    type: 'reply',
                    reply: {
                      id: declineButtonId,
                      title: '❌ Not Available',
                    },
                  },
                ],
              },
            },
          };

          const fallbackRes = await fetch(
            `${this.apiUrl}/${this.phoneNumberId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fallbackPayload),
            }
          );

          if (fallbackRes.ok) {
            const fbJson = (await fallbackRes.json()) as { messages?: Array<{ id: string }> };
            const liveId = fbJson.messages?.[0]?.id || messageId;
            console.log(`[@repo/api] Successfully dispatched live WhatsApp message: ${liveId} to ${recipientPhone}`);
            return {
              success: true,
              messageId: liveId,
              mode: 'live',
              timestamp,
            };
          } else {
            console.warn(
              '[@repo/api] Interactive fallback also rejected:',
              await fallbackRes.text()
            );
          }
        } else {
          const json = (await res.json()) as { messages?: Array<{ id: string }> };
          const liveId = json.messages?.[0]?.id || messageId;
          return {
            success: true,
            messageId: liveId,
            mode: 'live',
            timestamp,
          };
        }
      } catch (err) {
        console.warn(
          '[@repo/api] WhatsApp Cloud API network error; logging in mock mode:',
          err
        );
      }
    }

    // Mock Mode Output (zero-credential local development)
    console.log(`\n🩸 [WhatsApp Mock Notification Dispatched]`);
    console.log(`  To: ${recipientPhone} (${donorName})`);
    console.log(`  Blood Needed: ${bloodGroup} (${unitsNeeded} unit(s))`);
    console.log(`  Location: ${hospitalName} (${distanceKm.toFixed(1)} km away)`);
    console.log(`  Buttons: [1] ${acceptButtonId}  [2] ${declineButtonId}\n`);

    return {
      success: true,
      messageId,
      mode: 'mock',
      timestamp,
    };
  }

  public getOutboundMessages(): OutboundWhatsAppMessage[] {
    return mockStore.getOutboundWhatsAppMessages();
  }
}

export const whatsappService = new WhatsAppService();
