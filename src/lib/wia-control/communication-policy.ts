import { createHash } from "node:crypto";
import { WiaDomainError } from "@/lib/wia-control/domain-core";

/**
 * Who may be contacted, on which channel, with which version of which message.
 *
 * All of it is pure so the rules that decide whether a person gets an email can
 * be tested exhaustively, and so the worker, the queueing path, and the
 * monitoring view can never disagree about what was supposed to be sent.
 */

export type CommunicationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";

export type CommunicationTemplateKey =
  | "coverage_confirmed"
  | "incident_opened"
  | "shift_cancelled"
  | "coordinator_message";

type TemplateVersion = {
  version: number;
  /** Channels this message may ever use, before consent is considered. */
  channels: CommunicationChannel[];
  render: (payload: Record<string, unknown>) => { subject: string; body: string };
};

function text(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

/**
 * Every published version, newest last. A published version is never edited:
 * a message that was already sent must stay reproducible, and a recipient who
 * asks "what did you send me" gets the text they actually received.
 */
const templates: Record<CommunicationTemplateKey, TemplateVersion[]> = {
  coverage_confirmed: [
    {
      version: 1,
      channels: ["IN_APP", "EMAIL"],
      render: (payload) => ({
        subject: "You have been assigned to a shift",
        body:
          "You have been assigned to cover a shift.\n\n" +
          `Start: ${text(payload, "scheduledStart")}\n` +
          `End: ${text(payload, "scheduledEnd")}\n\n` +
          "Open WIAControl to see the full details and confirm you have seen this message.",
      }),
    },
  ],
  incident_opened: [
    {
      version: 1,
      channels: ["IN_APP", "EMAIL"],
      render: (payload) => ({
        subject: "An incident was opened on your shift",
        body:
          "An incident was opened on one of your shifts.\n\n" +
          `Shift: ${text(payload, "shiftTitle")}\n` +
          `Detail: ${text(payload, "detail")}\n\n` +
          "Open WIAControl to see what is being done about it.",
      }),
    },
  ],
  /**
   * A message a named coordinator wrote or approved, carried verbatim. The
   * template adds no wording of its own precisely because a person already
   * agreed to this exact text.
   */
  coordinator_message: [
    {
      version: 1,
      channels: ["IN_APP", "EMAIL"],
      render: (payload) => ({
        subject: text(payload, "subject") || "A message from your coordinator",
        body: text(payload, "body"),
      }),
    },
  ],
  shift_cancelled: [
    {
      version: 1,
      channels: ["IN_APP", "EMAIL"],
      render: (payload) => ({
        subject: "A shift you were assigned to was cancelled",
        body:
          "A shift you were assigned to has been cancelled.\n\n" +
          `Shift: ${text(payload, "shiftTitle")}\n` +
          `Start: ${text(payload, "scheduledStart")}\n\n` +
          "You do not need to attend. Open WIAControl if anything is unclear.",
      }),
    },
  ],
};

export function activeCommunicationTemplate(key: CommunicationTemplateKey) {
  const versions = templates[key];
  const latest = versions?.[versions.length - 1];
  if (!latest) {
    throw new WiaDomainError("COMMUNICATION_TEMPLATE_NOT_FOUND", `There is no message template ${key}.`);
  }
  return latest;
}

/**
 * Renders the exact version that was queued. An unknown template or version is
 * an error, never a generic fallback message: sending a person a placeholder
 * because the template was renamed is worse than not sending at all, and it
 * would hide the mistake.
 */
export function renderCommunication(
  key: string,
  version: number,
  payload: Record<string, unknown>
) {
  const versions = templates[key as CommunicationTemplateKey];
  const template = versions?.find((candidate) => candidate.version === version);
  if (!template) {
    throw new WiaDomainError(
      "COMMUNICATION_TEMPLATE_NOT_FOUND",
      `Message template ${key} has no published version ${version}.`
    );
  }
  return { ...template.render(payload), version: template.version };
}

export type RecipientContact = {
  email?: string | null;
  phone?: string | null;
  /** Operational messages about the recipient's own shifts. */
  emailOptIn: boolean;
  smsOptIn: boolean;
};

export type ChannelDecision = {
  channels: CommunicationChannel[];
  skipped: Array<{ channel: CommunicationChannel; reason: string }>;
};

/**
 * Decides which channels a message actually goes out on.
 *
 * IN_APP is always used: it is the record inside the product the recipient
 * already has an account for, and it is what the acknowledgement is read from.
 * EMAIL requires both an address and an opt-in. SMS and WhatsApp are refused
 * outright until a provider, a cost owner, and a consent record exist — an
 * unconfigured channel must fail closed, not queue messages nobody will send.
 */
export function resolveCommunicationChannels(
  key: CommunicationTemplateKey,
  contact: RecipientContact,
  options: { smsProviderConfigured?: boolean } = {}
): ChannelDecision {
  const allowed = activeCommunicationTemplate(key).channels;
  const channels: CommunicationChannel[] = [];
  const skipped: ChannelDecision["skipped"] = [];

  for (const channel of allowed) {
    if (channel === "IN_APP") {
      channels.push(channel);
      continue;
    }
    if (channel === "EMAIL") {
      if (!contact.email) {
        skipped.push({ channel, reason: "The recipient has no email address on file." });
      } else if (!contact.emailOptIn) {
        skipped.push({ channel, reason: "The recipient has not opted in to email." });
      } else {
        channels.push(channel);
      }
      continue;
    }
    if (!options.smsProviderConfigured) {
      skipped.push({ channel, reason: `${channel} has no configured provider.` });
    } else if (!contact.phone || !contact.smsOptIn) {
      skipped.push({ channel, reason: `The recipient has not opted in to ${channel}.` });
    } else {
      channels.push(channel);
    }
  }

  return { channels, skipped };
}

/**
 * Stable identity of one message. Queueing the same event twice — a retried
 * request, a double click, a replayed job — produces the same key, and the
 * unique index on it is what makes "never duplicated" a database guarantee
 * rather than an intention.
 */
export function communicationDedupeKey(input: {
  template: string;
  version: number;
  channel: CommunicationChannel;
  shiftId?: string | null;
  recipientEmployeeId?: string | null;
  discriminator?: string;
  /**
   * What the message actually says. Two messages that differ only in their
   * content are different messages: without this, a second coordinator note
   * about the same shift would be silently swallowed as a duplicate of the
   * first, which is the opposite failure from sending it twice.
   */
  payload?: unknown;
}) {
  const digest = createHash("sha256")
    .update(
      [
        input.template,
        String(input.version),
        input.channel,
        input.shiftId ?? "",
        input.recipientEmployeeId ?? "",
        input.discriminator ?? "",
        input.payload === undefined ? "" : stableStringify(input.payload),
      ].join("|")
    )
    .digest("hex");
  return `${input.template}:${input.channel}:${digest.slice(0, 32)}`;
}

/** Key order must not change the identity of a message. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

export type CommunicationHealth = {
  pending: number;
  retrying: number;
  processing: number;
  /** Claimed by a worker that never came back. */
  stuckProcessing: number;
  failed: number;
  sentLast24h: number;
  unacknowledgedLast24h: number;
  oldestPendingMinutes: number | null;
  /** True when something needs a human to look at the outbox. */
  needsAttention: boolean;
};

/**
 * How long a worker may hold a claimed message before the claim is treated as
 * abandoned. Shared with the health view so the two cannot disagree about what
 * "stuck" means.
 */
export const OUTBOX_LEASE_MINUTES = 15;

/** The threshold beyond which a queued message is considered stuck. */
export const OUTBOX_STUCK_MINUTES = 30;

export function summariseCommunicationHealth(input: {
  pending: number;
  retrying: number;
  processing: number;
  /** In PROCESSING past the lease, i.e. claimed by a worker that never returned. */
  stuckProcessing: number;
  failed: number;
  sentLast24h: number;
  unacknowledgedLast24h: number;
  oldestPendingAt: Date | null;
  now: Date;
}): CommunicationHealth {
  const oldestPendingMinutes = input.oldestPendingAt
    ? Math.max(0, Math.round((input.now.getTime() - input.oldestPendingAt.getTime()) / 60_000))
    : null;
  return {
    pending: input.pending,
    retrying: input.retrying,
    processing: input.processing,
    stuckProcessing: input.stuckProcessing,
    failed: input.failed,
    sentLast24h: input.sentLast24h,
    unacknowledgedLast24h: input.unacknowledgedLast24h,
    oldestPendingMinutes,
    needsAttention:
      input.failed > 0 ||
      // A record claimed by a worker that died sits in PROCESSING and is
      // counted by nothing else. Healthy was the wrong answer for that.
      input.stuckProcessing > 0 ||
      (oldestPendingMinutes !== null && oldestPendingMinutes >= OUTBOX_STUCK_MINUTES),
  };
}
