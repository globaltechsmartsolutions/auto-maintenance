"use client";

/**
 * IndexedDB storage adapter for the offline clock queue.
 *
 * Only the minimum attendance command is stored here (see
 * `QueuedClockCommand` in `offline-clock-queue.ts`): shift id, event type,
 * timestamps, a generated idempotency key, optional coordinates, and
 * retry/status bookkeeping. No passwords, tokens, or full employee records
 * are ever written to this store, per the playbook's offline-design rules.
 *
 * This file is browser-only (IndexedDB is not available in the Node test
 * environment) — the pure decision logic it wraps is unit tested separately
 * in `offline-clock-queue.test.ts`.
 */

import type { QueuedClockCommand } from "@/lib/offline-clock-queue";

const DB_NAME = "wiacontrol-offline-clock";
const DB_VERSION = 1;
const STORE_NAME = "commands";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is not available in this environment."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(request.error ?? new Error("Failed to open the offline clock queue database."));
    });
}

export async function putQueuedCommand(command: QueuedClockCommand): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(command);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(transaction.error ?? new Error("Failed to save the queued clock command."));
    });
}

export async function removeQueuedCommand(id: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(transaction.error ?? new Error("Failed to remove the queued clock command."));
    });
}

export async function listQueuedCommands(): Promise<QueuedClockCommand[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as QueuedClockCommand[]);
        request.onerror = () =>
            reject(request.error ?? new Error("Failed to read the offline clock queue."));
    });
}