import "server-only";

/**
 * Stage 5: a minimal, versioned template registry. Rendering only uses
 * the safe, minimal payload fields already stored on the outbox record —
 * never raw location, tokens, or anything not already meant to be shown
 * to the recipient.
 */
type TemplateContent = { subject: string; body: string };

function renderTemplate(template: string, payload: Record<string, unknown>): TemplateContent {
    switch (template) {
        case "coverage_confirmed": {
            const start = typeof payload.scheduledStart === "string" ? payload.scheduledStart : "";
            const end = typeof payload.scheduledEnd === "string" ? payload.scheduledEnd : "";
            return {
                subject: "You have been assigned to a shift",
                body:
                    `You have been assigned to cover a shift.\n\n` +
                    `Start: ${start}\nEnd: ${end}\n\n` +
                    `Open WIA Control to see the full details and confirm you have seen this message.`,
            };
        }
        default:
            return {
                subject: "WIA Control notification",
                body: "You have a new notification in WIA Control.",
            };
    }
}

export type DeliveryResult =
    | { success: true; providerReference: string }
    | { success: false; error: string };

/**
 * IN_APP delivery has no external provider to call — the message is
 * "delivered" the moment it is queryable through the app (see
 * listCommunicationOutbox). There is nothing that can fail here except a
 * missing recipient, which the caller already checked.
 */
export async function deliverInApp(): Promise<DeliveryResult> {
    return { success: true, providerReference: "in-app" };
}

/**
 * EMAIL delivery via Resend (https://resend.com). Uses the outbox
 * record's own id as the provider idempotency key (per playbook Section
 * 15: "Use a stable provider idempotency key based on the outbox record
 * ID"), so a retried HTTP call after a network blip can never cause two
 * emails to be sent for the same outbox record.
 *
 * If no provider is configured (no RESEND_API_KEY), this returns an
 * honest failure rather than pretending success — nothing is silently
 * lost, and the outbox item becomes visibly FAILED after retries, which
 * is the documented, correct behaviour for an unconfigured provider.
 */
export async function deliverEmail(
    outboxId: string,
    template: string,
    payload: Record<string, unknown>,
    recipientEmail: string
): Promise<DeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return {
            success: false,
            error: "No email provider is configured (RESEND_API_KEY is not set).",
        };
    }

    const content = renderTemplate(template, payload);
    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Idempotency-Key": outboxId,
            },
            body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL ?? "notifications@wia-control.app",
                to: recipientEmail,
                subject: content.subject,
                text: content.body,
            }),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            return {
                success: false,
                error: `Email provider returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
            };
        }
        const body = (await response.json().catch(() => ({}))) as { id?: string };
        return { success: true, providerReference: body.id ?? "sent" };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown email delivery error.",
        };
    }
}