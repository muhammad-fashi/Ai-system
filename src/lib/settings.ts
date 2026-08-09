import { prisma } from "./prisma";

export interface AiAgentSettings {
  agentName: string;
  companyName: string;
  companyDescription: string;
  websiteServices: string;
  seoServices: string;
  socialServices: string;
  pricingInfo: string;
  faqs: string;
  salesRules: string;
  qualificationQuestions: string;
  objectionHandling: string;
  tone: "Professional" | "Friendly" | "Consultative" | "Concise";
}

export interface CallingSettings {
  maxConcurrency: number;
  retryAttempts: number;
  retryDelayMin: number;
  delayBetweenSec: number;
  callingHoursStart: number;
  callingHoursEnd: number;
  callingDays: number[];
  timezone: string;
  maxCallsPerClient: number;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  complianceMessage: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  callCompletion: boolean;
  interestedLead: boolean;
  followUp: boolean;
  notifyEmail: string;
}

export interface RetellSettings {
  // Non-secret display copy of config. The API key/secret always come from
  // environment variables and are never stored here.
  agentId: string;
  phoneNumber: string;
  fromNumber: string;
}

const DEFAULTS = {
  aiAgent: {
    agentName: "Sarah",
    companyName: "Your Agency",
    companyDescription:
      "We help businesses grow their online presence through professional websites, SEO, and social media marketing.",
    websiteServices:
      "Professional business websites, WordPress websites, e-commerce stores, landing pages, website redesign, mobile-responsive design, and ongoing website maintenance.",
    seoServices:
      "Technical SEO, on-page SEO, local SEO, keyword research, content optimization, Google Business Profile optimization, ethical link building, and transparent SEO reporting. We never guarantee specific Google rankings.",
    socialServices:
      "Facebook & Instagram marketing, content creation, social media management, paid advertising, audience targeting, campaign optimization, and analytics reporting.",
    pricingInfo:
      "Pricing depends on project requirements, website size, features, SEO scope, and marketing needs. We do not quote fixed prices on calls; we arrange a consultation for an accurate quote.",
    faqs:
      "Q: Do you guarantee rankings? A: No, we never guarantee specific rankings; we focus on sustainable, ethical improvements.\nQ: Where are you based? A: We work with businesses remotely and can arrange a consultation at a convenient time.",
    salesRules:
      "Be consultative, never pushy. Never make false promises or guarantee results. Identify itself as an AI where legally appropriate. If the client is not interested, thank them and end politely. If the client asks not to be called again, mark Do Not Call immediately.",
    qualificationQuestions:
      "What type of business do you operate?\nDo you currently have a website, and are you happy with it?\nAre you currently doing any SEO?\nHow are customers finding your business today?\nAre you active on social media?\nWhat is your biggest online-marketing challenge?\nAre you looking for more leads or customers?\nWould you be open to a short follow-up with our team?",
    objectionHandling:
      "\"Not interested\" -> Thank them politely and end; mark Not Interested.\n\"We already have a website\" -> Offer performance, SEO, mobile, conversion or redesign help.\n\"We already have an SEO company\" -> Offer a second-opinion audit.\n\"Send me information\" -> Capture email; mark Follow-up Required.\n\"How much does it cost?\" -> Explain pricing depends on scope; offer a consultation.",
    tone: "Consultative" as const,
  } satisfies AiAgentSettings,
  calling: {
    maxConcurrency: 2,
    retryAttempts: 2,
    retryDelayMin: 60,
    delayBetweenSec: 5,
    callingHoursStart: 9,
    callingHoursEnd: 18,
    callingDays: [1, 2, 3, 4, 5],
    timezone: "UTC",
    maxCallsPerClient: 3,
    recordingEnabled: true,
    transcriptionEnabled: true,
    complianceMessage:
      "This call may be recorded for quality and training purposes.",
  } satisfies CallingSettings,
  notifications: {
    emailNotifications: false,
    callCompletion: true,
    interestedLead: true,
    followUp: true,
    notifyEmail: "",
  } satisfies NotificationSettings,
  retell: {
    agentId: process.env.RETELL_AGENT_ID || "",
    phoneNumber: process.env.RETELL_PHONE_NUMBER || "",
    fromNumber:
      process.env.RETELL_FROM_NUMBER || process.env.RETELL_PHONE_NUMBER || "",
  } satisfies RetellSettings,
};

export type SettingsMap = typeof DEFAULTS;
export type SettingsKey = keyof SettingsMap;

export async function getSetting<K extends SettingsKey>(
  key: K
): Promise<SettingsMap[K]> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key];
  // Merge stored value over defaults so new fields always have a value.
  return { ...DEFAULTS[key], ...(row.value as object) } as SettingsMap[K];
}

export async function setSetting<K extends SettingsKey>(
  key: K,
  value: Partial<SettingsMap[K]>
): Promise<SettingsMap[K]> {
  const current = await getSetting(key);
  const merged = { ...current, ...value };
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: merged as object },
    update: { value: merged as object },
  });
  return merged;
}

export async function getAllSettings() {
  const [aiAgent, calling, notifications, retell] = await Promise.all([
    getSetting("aiAgent"),
    getSetting("calling"),
    getSetting("notifications"),
    getSetting("retell"),
  ]);
  return { aiAgent, calling, notifications, retell };
}

export { DEFAULTS as SETTINGS_DEFAULTS };
