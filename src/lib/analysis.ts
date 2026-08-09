import { clamp } from "./utils";

export type InterestLevel = "HOT" | "WARM" | "COLD" | "UNKNOWN";
export type CallOutcome =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "FOLLOW_UP_REQUIRED"
  | "MEETING_REQUESTED"
  | "PRICING_REQUESTED"
  | "INFORMATION_REQUESTED"
  | "NO_ANSWER"
  | "BUSY"
  | "VOICEMAIL"
  | "WRONG_NUMBER"
  | "DO_NOT_CALL"
  | "CONVERTED"
  | "UNKNOWN";

const AGENCY_SERVICES = [
  { key: "Website Development", terms: ["website", "web site", "web development", "landing page"] },
  { key: "Website Design", terms: ["design", "redesign", "look"] },
  { key: "WordPress Development", terms: ["wordpress", "word press"] },
  { key: "E-commerce Development", terms: ["ecommerce", "e-commerce", "online store", "shop", "checkout"] },
  { key: "SEO", terms: ["seo", "search engine", "google ranking", "rank", "visibility", "keywords"] },
  { key: "Local SEO", terms: ["local seo", "google business", "maps", "local search"] },
  { key: "Social Media Marketing", terms: ["social media", "facebook", "instagram", "advertising", "ads"] },
  { key: "Digital Marketing", terms: ["digital marketing", "marketing", "leads", "campaign"] },
  { key: "Website Maintenance", terms: ["maintenance", "update", "support"] },
  { key: "Lead Generation", terms: ["lead generation", "more customers", "more leads"] },
];

export interface AnalysisResult {
  outcome: CallOutcome;
  interestLevel: InterestLevel;
  leadScore: number;
  leadScoreReason: string;
  sentiment: string;
  servicesDiscussed: string[];
  summary: string;
  nextAction: string;
  doNotCall: boolean;
  meetingRequested: boolean;
  followUpRequired: boolean;
}

interface AnalyzeInput {
  transcriptText?: string | null;
  // Retell call_analysis object, when present, is the source of truth.
  retellAnalysis?: {
    call_summary?: string;
    user_sentiment?: string;
    call_successful?: boolean;
    agent_task_completion_rating?: string;
    custom_analysis_data?: Record<string, unknown>;
  } | null;
  callStatus?: string;
  disconnectionReason?: string | null;
}

function detectServices(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const svc of AGENCY_SERVICES) {
    if (svc.terms.some((t) => lower.includes(t))) found.add(svc.key);
  }
  return [...found];
}

/**
 * Heuristic transcript analysis used to derive outcome, interest, lead score
 * and a summary. When Retell supplies structured call_analysis we prefer it
 * and enrich with our own signals.
 */
export function analyzeCall(input: AnalyzeInput): AnalysisResult {
  const text = (input.transcriptText || "").toLowerCase();
  const analysis = input.retellAnalysis;

  // Handle non-connected outcomes up front.
  const status = (input.callStatus || "").toLowerCase();
  const disconnect = (input.disconnectionReason || "").toLowerCase();
  if (disconnect.includes("voicemail") || status.includes("voicemail")) {
    return baseNonConnect("VOICEMAIL", "Reached voicemail.");
  }
  if (disconnect.includes("no_answer") || disconnect.includes("no-answer") || status.includes("no_answer")) {
    return baseNonConnect("NO_ANSWER", "Client did not answer.");
  }
  if (disconnect.includes("busy") || status.includes("busy")) {
    return baseNonConnect("BUSY", "Line was busy.");
  }
  if (disconnect.includes("dial_failed") || disconnect.includes("failed") || status.includes("failed")) {
    return baseNonConnect("WRONG_NUMBER", "Call failed / could not connect.");
  }

  let score = 30;
  const reasons: string[] = [];
  const services = detectServices(text);
  if (services.length) {
    score += Math.min(services.length * 4, 16);
    reasons.push(`discussed ${services.length} service area(s)`);
  }

  // Do not call detection.
  const dncPatterns = [
    "don't call", "do not call", "dont call", "stop calling",
    "remove me", "take me off", "never call",
  ];
  const doNotCall = dncPatterns.some((p) => text.includes(p));

  // Not interested detection.
  const notInterested =
    /not interested|no thanks|not right now|we're good|we are good|no thank you/.test(
      text
    );

  // Positive interest signals.
  const positives: [RegExp, number, string][] = [
    [/interested|sounds good|tell me more|yes,? i|i'?d like|we need|looking for/, 18, "expressed interest"],
    [/meeting|schedule|book a call|set up a|appointment|consultation/, 20, "open to a meeting/consultation"],
    [/how much|price|pricing|cost|quote|proposal|budget/, 12, "asked about pricing"],
    [/send.*(info|information|email)|email me|follow.?up|call me (back|next)/, 8, "requested info/follow-up"],
    [/outdated|old website|no website|not happy|slow|problem|struggling/, 12, "has a clear need/pain point"],
    [/urgent|soon|this month|asap|right away/, 8, "expressed urgency"],
  ];
  const meetingRequested = /meeting|schedule|book a call|appointment|consultation/.test(text);
  const pricingRequested = /how much|price|pricing|cost|quote|proposal/.test(text);
  const infoRequested = /send.*(info|information|email)|email me/.test(text);
  const followUpRequested =
    /follow.?up|call me (back|next|tuesday|monday|wednesday|thursday|friday)|next week/.test(
      text
    );

  for (const [re, pts, reason] of positives) {
    if (re.test(text)) {
      score += pts;
      reasons.push(reason);
    }
  }

  if (notInterested) {
    score -= 25;
    reasons.push("said not interested");
  }
  if (doNotCall) {
    score = 0;
    reasons.push("requested do-not-call");
  }

  // Sentiment from Retell (if any) nudges score.
  const sentiment =
    analysis?.user_sentiment ||
    (score >= 70 ? "Positive" : score <= 25 ? "Negative" : "Neutral");
  if (/positive/i.test(sentiment)) score += 6;
  if (/negative/i.test(sentiment)) score -= 6;

  score = clamp(Math.round(score), 0, 100);

  // Interest level from score.
  let interestLevel: InterestLevel;
  if (doNotCall || notInterested) interestLevel = "COLD";
  else if (score >= 70) interestLevel = "HOT";
  else if (score >= 40) interestLevel = "WARM";
  else interestLevel = "COLD";
  if (!text) interestLevel = "UNKNOWN";

  // Outcome classification (priority order).
  let outcome: CallOutcome = "UNKNOWN";
  if (doNotCall) outcome = "DO_NOT_CALL";
  else if (notInterested) outcome = "NOT_INTERESTED";
  else if (meetingRequested) outcome = "MEETING_REQUESTED";
  else if (pricingRequested) outcome = "PRICING_REQUESTED";
  else if (followUpRequested) outcome = "FOLLOW_UP_REQUIRED";
  else if (infoRequested) outcome = "INFORMATION_REQUESTED";
  else if (score >= 60) outcome = "INTERESTED";
  else if (text) outcome = "NOT_INTERESTED";

  const summary =
    analysis?.call_summary ||
    buildFallbackSummary({ services, interestLevel, outcome, meetingRequested, pricingRequested });

  const nextAction = buildNextAction(outcome);

  const reasonText = reasons.length
    ? `Client ${reasons.join(", ")}.`
    : "Limited signal from the conversation.";

  return {
    outcome,
    interestLevel,
    leadScore: score,
    leadScoreReason: reasonText,
    sentiment,
    servicesDiscussed: services,
    summary,
    nextAction,
    doNotCall,
    meetingRequested,
    followUpRequired:
      outcome === "FOLLOW_UP_REQUIRED" || outcome === "INFORMATION_REQUESTED",
  };
}

function baseNonConnect(outcome: CallOutcome, note: string): AnalysisResult {
  return {
    outcome,
    interestLevel: "UNKNOWN",
    leadScore: 0,
    leadScoreReason: note,
    sentiment: "Unknown",
    servicesDiscussed: [],
    summary: note,
    nextAction: "Retry the call at a better time.",
    doNotCall: false,
    meetingRequested: false,
    followUpRequired: false,
  };
}

function buildFallbackSummary(o: {
  services: string[];
  interestLevel: InterestLevel;
  outcome: CallOutcome;
  meetingRequested: boolean;
  pricingRequested: boolean;
}): string {
  const parts: string[] = [];
  parts.push(`The client is a ${o.interestLevel.toLowerCase()} lead.`);
  if (o.services.length) parts.push(`Discussed: ${o.services.join(", ")}.`);
  if (o.pricingRequested) parts.push("Client asked about pricing.");
  if (o.meetingRequested) parts.push("Client is open to a meeting.");
  parts.push(`Outcome: ${o.outcome.replace(/_/g, " ").toLowerCase()}.`);
  return parts.join(" ");
}

function buildNextAction(outcome: CallOutcome): string {
  switch (outcome) {
    case "MEETING_REQUESTED":
      return "Schedule the consultation and send a calendar invite.";
    case "PRICING_REQUESTED":
      return "Prepare and send a tailored quote / proposal.";
    case "INFORMATION_REQUESTED":
      return "Email the requested information and follow up.";
    case "FOLLOW_UP_REQUIRED":
      return "Schedule a follow-up call at the requested time.";
    case "INTERESTED":
      return "Have a team member reach out to move the conversation forward.";
    case "NOT_INTERESTED":
      return "No further action. Mark as not interested.";
    case "DO_NOT_CALL":
      return "Do not contact. Added to Do Not Call list.";
    case "NO_ANSWER":
    case "BUSY":
    case "VOICEMAIL":
      return "Retry the call at a better time.";
    default:
      return "Review the call and decide next steps.";
  }
}

/** Map a call outcome to the appropriate client status. */
export function outcomeToClientStatus(outcome: CallOutcome): string {
  switch (outcome) {
    case "INTERESTED":
      return "INTERESTED";
    case "NOT_INTERESTED":
      return "NOT_INTERESTED";
    case "MEETING_REQUESTED":
      return "MEETING_BOOKED";
    case "PRICING_REQUESTED":
    case "INFORMATION_REQUESTED":
    case "FOLLOW_UP_REQUIRED":
      return "FOLLOW_UP_REQUIRED";
    case "CONVERTED":
      return "CONVERTED";
    case "DO_NOT_CALL":
      return "DO_NOT_CALL";
    case "WRONG_NUMBER":
      return "INVALID_NUMBER";
    default:
      return "CONTACTED";
  }
}
