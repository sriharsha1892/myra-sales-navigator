import type { OutreachChannel, ChannelConstraints } from "../types";

export const CHANNEL_CONSTRAINTS: Record<OutreachChannel, ChannelConstraints> = {
  email: {
    maxChars: null,
    maxWords: 150,
    hasSubject: true,
    outputFields: ["subject", "message"],
    platformGuidance:
      "Write a professional B2B sales email. Include a compelling subject line. Use plain text with line breaks.",
  },
  linkedin_connect: {
    maxChars: 300,
    maxWords: null,
    hasSubject: false,
    outputFields: ["message"],
    platformGuidance:
      "Write a LinkedIn connection request note. Must be under 300 characters. Be concise and personal — mention a shared interest or specific reason to connect. No sales pitch.",
  },
  linkedin_inmail: {
    maxChars: null,
    maxWords: 200,
    hasSubject: true,
    outputFields: ["subject", "message"],
    platformGuidance:
      "Write a LinkedIn InMail message. Include a subject line. More professional than a connection note but still personal. Reference the prospect's work or company.",
  },
  whatsapp: {
    maxChars: 300,
    maxWords: null,
    hasSubject: false,
    outputFields: ["message"],
    platformGuidance:
      "Write a brief WhatsApp message. Must be under 300 characters. Casual and conversational tone. Only appropriate for warm contacts with prior CRM history.",
  },
};

export const CHANNEL_OPTIONS: {
  value: OutreachChannel;
  label: string;
  icon: string;
}[] = [
  { value: "email", label: "Email", icon: "mail" },
  { value: "linkedin_connect", label: "Connect", icon: "linkedin" },
  { value: "linkedin_inmail", label: "InMail", icon: "linkedin" },
  { value: "whatsapp", label: "WhatsApp", icon: "message-circle" },
];
