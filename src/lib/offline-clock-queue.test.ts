import { describe, expect, it } from "vitest";
import {
    createQueuedCommand,
    hasExceededRetryLimit,
    isExpired,
    markNeedsAttention,
    markRetryableFailure,
    markSending,
    MAX_RETRY_ATTEMPTS,
    nextBackoffDelayMs,
    resetForManualRetry,
    sortQueueForSend,
    toRequestPayload,
} from "@/lib/offline-clock-queue";

describe("offline clock queue", () => {
    it("never regenerates the idempotency key across retries", () => {
        const command = createQueuedCommand({
            id: "device-uuid-1",
            shiftId: "shift-1",
            type: "CLOCK_IN",
            occurredAt: "2026-08-18T08:00:00.000Z",
            isOffline: true,
        });

        expect(command.idempotencyKey).toBe("device-uuid-1");

        const afterOneFailure = markRetryableFailure(command, "Network error");
        const afterTwoFailures = markRetryableFailure(afterOneFailure, "Network error");
        const sent = markSending(afterTwoFailures);

        // The id and idempotencyKey must be identical to the original command
        // through every retry — this is what lets the server dedupe correctly.
        expect(afterOneFailure.idempotencyKey).toBe("device-uuid-1");
        expect(afterTwoFailures.idempotencyKey).toBe("device-uuid-1");
        expect(sent.idempotencyKey).toBe("device-uuid-1");
        expect(sent.id).toBe(command.id);
    });

    it("keeps retrying on network failure until the retry limit, then needs attention", () => {
        let command = createQueuedCommand({
            id: "device-uuid-2",
            shiftId: "shift-1",
            type: "CLOCK_IN",
            occurredAt: "2026-08-18T08:00:00.000Z",
            isOffline: true,
        });

        for (let attempt = 1; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
            command = markRetryableFailure(command, "Network error");
            expect(command.status).toBe("pending");
        }

        command = markRetryableFailure(command, "Network error");
        expect(command.retryCount).toBe(MAX_RETRY_ATTEMPTS);
        expect(hasExceededRetryLimit(command.retryCount)).toBe(true);
        expect(command.status).toBe("needs_attention");
    });

    it("treats a server validation rejection as needs_attention, not retryable", () => {
        const command = createQueuedCommand({
            id: "device-uuid-3",
            shiftId: "shift-1",
            type: "CLOCK_IN",
            occurredAt: "2026-08-18T08:00:00.000Z",
            isOffline: false,
        });

        const rejected = markNeedsAttention(command, "The shift is already closed.");

        expect(rejected.status).toBe("needs_attention");
        expect(rejected.retryCount).toBe(0);
        expect(rejected.idempotencyKey).toBe(command.idempotencyKey);
    });

    it("allows a needs_attention command to be manually retried", () => {
        const command = markNeedsAttention(
            createQueuedCommand({
                id: "device-uuid-4",
                shiftId: "shift-1",
                type: "CLOCK_IN",
                occurredAt: "2026-08-18T08:00:00.000Z",
                isOffline: false,
            }),
            "Temporary error"
        );

        const retried = resetForManualRetry(command);

        expect(retried.status).toBe("pending");
        expect(retried.lastError).toBeUndefined();
        expect(retried.idempotencyKey).toBe(command.idempotencyKey);
    });

    it("orders queued commands FIFO by creation time, not insertion order", () => {
        const first = createQueuedCommand({
            id: "a",
            shiftId: "shift-1",
            type: "CLOCK_IN",
            occurredAt: "2026-08-18T08:00:00.000Z",
            isOffline: true,
            now: "2026-08-18T08:00:00.000Z",
        });
        const second = createQueuedCommand({
            id: "b",
            shiftId: "shift-1",
            type: "BREAK_START",
            occurredAt: "2026-08-18T10:00:00.000Z",
            isOffline: true,
            now: "2026-08-18T10:00:00.000Z",
        });

        const sorted = sortQueueForSend([second, first]);

        expect(sorted.map((command) => command.id)).toEqual(["a", "b"]);
    });

    it("computes a bounded, increasing backoff delay", () => {
        const delays = [0, 1, 2, 3, 4, 5, 6].map((count) => nextBackoffDelayMs(count));

        expect(delays[0]).toBe(0);
        expect(delays[1]).toBeGreaterThan(delays[0]);
        expect(delays[4]).toBeGreaterThan(delays[3]);
        // Beyond the schedule length, the delay caps rather than growing forever.
        expect(delays[5]).toBe(delays[6]);
    });

    it("expires a command older than the configured window", () => {
        const command = createQueuedCommand({
            id: "device-uuid-5",
            shiftId: "shift-1",
            type: "CLOCK_IN",
            occurredAt: "2026-08-18T08:00:00.000Z",
            isOffline: true,
            now: "2026-08-18T08:00:00.000Z",
        });

        const stillFresh = new Date("2026-08-18T09:00:00.000Z");
        const wayLater = new Date("2026-08-20T08:00:00.000Z");

        expect(isExpired(command, stillFresh, 24 * 60 * 60 * 1000)).toBe(false);
        expect(isExpired(command, wayLater, 24 * 60 * 60 * 1000)).toBe(true);
    });

    it("builds a server payload that carries the persisted idempotency key", () => {
        const command = createQueuedCommand({
            id: "device-uuid-6",
            shiftId: "shift-9",
            type: "CLOCK_OUT",
            occurredAt: "2026-08-18T16:00:00.000Z",
            latitude: 40.4168,
            longitude: -3.7038,
            accuracyMeters: 12,
            isOffline: false,
        });

        expect(toRequestPayload(command)).toEqual({
            shiftId: "shift-9",
            type: "CLOCK_OUT",
            method: "MOBILE",
            occurredAt: "2026-08-18T16:00:00.000Z",
            idempotencyKey: "device-uuid-6",
            latitude: 40.4168,
            longitude: -3.7038,
            accuracyMeters: 12,
            isOffline: false,
        });
    });
});