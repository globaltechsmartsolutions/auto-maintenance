/**
 * Pure, storage-agnostic logic for the offline clock-in/out queue.
 *
 * This module intentionally has no IndexedDB or browser dependency so it can
 * be unit tested in Node. The IndexedDB-backed storage adapter lives in
 * `offline-clock-queue-db.ts` (browser-only) and is a thin wrapper around
 * these pure functions.
 *
 * Design decisions (Stage 2, playbook Section 7):
 * - One idempotency key is generated on the device the moment the person
 *   taps the button, and is reused for every retry of that same action.
 *   It is never regenerated — this is what lets the server's
 *   `(companyId, idempotencyKey)` uniqueness constraint guarantee "exactly
 *   one event" even after several retries.
 * - Commands are sent strictly in the order they were queued (FIFO). A
 *   later event never overtakes an earlier one that has not been
 *   acknowledged yet.
 * - A default 24-hour expiry is used for queued commands that never
 *   manage to send. This value is a starting assumption for staging and
 *   should be confirmed with the product owner before pilot, per the
 *   playbook's explicit requirement to set this policy deliberately.
 * - A server validation rejection (4xx from the domain layer) is treated
 *   as "needs attention", not silently retried — retrying an invalid
 *   command will never fix itself by waiting.
 */

export type ClockEventType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";

export type QueuedClockCommandStatus = "pending" | "sending" | "needs_attention";

export type QueuedClockCommand = {
    /** Also used as the idempotency key. Generated once, never regenerated. */
    id: string;
    shiftId: string;
    type: ClockEventType;
    method: "MOBILE";
    /** ISO timestamp captured the moment the person tapped the button. */
    occurredAt: string;
    idempotencyKey: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    isOffline: boolean;
    /** ISO timestamp of when the command was queued locally. */
    createdAt: string;
    retryCount: number;
    status: QueuedClockCommandStatus;
    lastError?: string;
};

/**
 * Default expiry window for a queued command that has not been sent.
 * Assumption pending product-owner sign-off (playbook Section 14-D).
 */
export const QUEUE_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Bounded exponential backoff schedule, in milliseconds, indexed by retry count. */
const BACKOFF_SCHEDULE_MS = [0, 5_000, 15_000, 30_000, 60_000, 120_000];

export const MAX_RETRY_ATTEMPTS = BACKOFF_SCHEDULE_MS.length;

export function createQueuedCommand(input: {
    id: string;
    shiftId: string;
    type: ClockEventType;
    occurredAt: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    isOffline: boolean;
    now?: string;
}): QueuedClockCommand {
    return {
        id: input.id,
        shiftId: input.shiftId,
        type: input.type,
        method: "MOBILE",
        occurredAt: input.occurredAt,
        // The idempotency key is the same value as the command id, by
        // construction. It must never be regenerated on retry.
        idempotencyKey: input.id,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        isOffline: input.isOffline,
        createdAt: input.now ?? new Date().toISOString(),
        retryCount: 0,
        status: "pending",
    };
}

/** FIFO by queue time, so an earlier unsent event is always sent first. */
export function sortQueueForSend(commands: QueuedClockCommand[]): QueuedClockCommand[] {
    return [...commands].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function isExpired(
    command: QueuedClockCommand,
    now: Date = new Date(),
    maxAgeMs: number = QUEUE_EXPIRY_MS
): boolean {
    return now.getTime() - new Date(command.createdAt).getTime() > maxAgeMs;
}

export function nextBackoffDelayMs(retryCount: number): number {
    const index = Math.min(Math.max(retryCount, 0), BACKOFF_SCHEDULE_MS.length - 1);
    return BACKOFF_SCHEDULE_MS[index];
}

export function hasExceededRetryLimit(retryCount: number): boolean {
    return retryCount >= MAX_RETRY_ATTEMPTS;
}

/** Marks a command as currently being sent. The id/idempotencyKey never change. */
export function markSending(command: QueuedClockCommand): QueuedClockCommand {
    return { ...command, status: "sending" };
}

/**
 * A network/transport failure: safe to retry with the same idempotency
 * key. After too many attempts, stop retrying automatically and surface
 * it to the person instead of retrying forever.
 */
export function markRetryableFailure(
    command: QueuedClockCommand,
    error: string
): QueuedClockCommand {
    const retryCount = command.retryCount + 1;
    return {
        ...command,
        retryCount,
        status: hasExceededRetryLimit(retryCount) ? "needs_attention" : "pending",
        lastError: error,
    };
}

/**
 * A server-side validation/domain rejection: retrying with the same
 * payload will not succeed, so this stops automatic retries immediately.
 */
export function markNeedsAttention(
    command: QueuedClockCommand,
    error: string
): QueuedClockCommand {
    return { ...command, status: "needs_attention", lastError: error };
}

/** Resets a `needs_attention` command back to `pending` for a manual retry. */
export function resetForManualRetry(command: QueuedClockCommand): QueuedClockCommand {
    return { ...command, status: "pending", lastError: undefined };
}

export function toRequestPayload(command: QueuedClockCommand) {
    return {
        shiftId: command.shiftId,
        type: command.type,
        method: command.method,
        occurredAt: command.occurredAt,
        idempotencyKey: command.idempotencyKey,
        latitude: command.latitude,
        longitude: command.longitude,
        accuracyMeters: command.accuracyMeters,
        isOffline: command.isOffline,
    };
}