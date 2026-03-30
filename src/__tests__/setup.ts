/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Jest setup file – run before every test suite.
 *
 * Provides polyfills and mocks needed by jsdom environment.
 */

/* global globalThis */

// ── TextEncoder / TextDecoder polyfill ────────────────────────
// jsdom doesn't ship TextEncoder in older versions
if (typeof globalThis.TextEncoder === "undefined") {
    const { TextEncoder, TextDecoder } = require("util");
    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;
}

// ── Web Crypto (subtle) polyfill ──────────────────────────────
// jsdom exposes crypto.getRandomValues but not crypto.subtle
if (!globalThis.crypto?.subtle) {
    const { webcrypto } = require("crypto");
    Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        writable: true,
    });
}

// ── localStorage / sessionStorage mock ────────────────────────
// Zustand persist middleware needs localStorage
const storageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (index: number) => Object.keys(store)[index] ?? null,
    };
})();

Object.defineProperty(globalThis, "localStorage", { value: storageMock });
Object.defineProperty(globalThis, "sessionStorage", { value: storageMock });

// ── Suppress console.warn for zustand persist rehydration ─────
const originalWarn = console.warn;
beforeAll(() => {
    console.warn = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("[zustand persist middleware]")) return;
        originalWarn(...args);
    };
});
afterAll(() => {
    console.warn = originalWarn;
});
