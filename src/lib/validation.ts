import { z } from "zod";

export const clientCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  phone: z.string().min(5, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  leadSource: z.string().optional().nullable(),
  servicesNeeded: z.array(z.string()).optional().default([]),
  notes: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  preferredCallTime: z.string().optional().nullable(),
  status: z.string().optional(),
  interestLevel: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const campaignCreateSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
  fromNumber: z.string().optional().nullable(),
  maxConcurrency: z.number().int().min(1).max(50).optional(),
  retryLimit: z.number().int().min(0).max(10).optional(),
  retryDelayMin: z.number().int().min(1).optional(),
  delayBetweenSec: z.number().int().min(0).optional(),
  callingHoursStart: z.number().int().min(0).max(23).optional(),
  callingHoursEnd: z.number().int().min(1).max(24).optional(),
  callingDays: z.array(z.number().int().min(0).max(6)).optional(),
  timezone: z.string().optional(),
  clientIds: z.array(z.string()).optional().default([]),
});

export const followUpCreateSchema = z.object({
  clientId: z.string().min(1),
  callId: z.string().optional().nullable(),
  scheduledAt: z.string(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  autoCall: z.boolean().optional(),
  assignedToId: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const CLIENT_STATUSES = [
  "NEW",
  "PENDING",
  "CALLING",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "FOLLOW_UP_REQUIRED",
  "MEETING_BOOKED",
  "CONVERTED",
  "DO_NOT_CALL",
  "INVALID_NUMBER",
] as const;

export const INTEREST_LEVELS = ["HOT", "WARM", "COLD", "UNKNOWN"] as const;

export const AGENCY_SERVICES = [
  "Website Development",
  "Website Design",
  "WordPress Development",
  "E-commerce Website Development",
  "SEO Services",
  "Local SEO",
  "Social Media Marketing",
  "Social Media Management",
  "Digital Marketing",
  "Website Maintenance",
  "Website Redesign",
  "Lead Generation",
] as const;
