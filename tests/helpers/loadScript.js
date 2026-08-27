import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { vi } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSource(relativePath) {
    return readFileSync(resolve(rootDir, relativePath), 'utf8');
}

/** Renders the real markup of index.html (without its script tags) into the jsdom document. */
export function loadIndexHtmlBody() {
    const html = readSource('index.html');
    const body = html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '');
    document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

export function createCanvasContextStub() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn()
    };
}

export function stubCanvasContext(context) {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => context);
}

export function createAudioContextStub({ state = 'running' } = {}) {
    const oscillators = [];
    const gains = [];

    const context = {
        state,
        currentTime: 10,
        destination: { id: 'destination' },
        resume: vi.fn(() => {
            context.state = 'running';
        }),
        createOscillator: vi.fn(() => {
            const osc = {
                type: null,
                frequency: { setValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn()
            };
            oscillators.push(osc);
            return osc;
        }),
        createGain: vi.fn(() => {
            const gain = {
                gain: {
                    setValueAtTime: vi.fn(),
                    exponentialRampToValueAtTime: vi.fn()
                },
                connect: vi.fn()
            };
            gains.push(gain);
            return gain;
        })
    };

    return { context, oscillators, gains };
}

/** Constructor stub usable with `new`, always returning the given context. */
export function audioContextConstructor(context) {
    return vi.fn(function AudioContextStub() {
        return context;
    });
}

/** Loads soundinstrument.js as a fresh module and returns the exposed global class. */
export async function loadSoundInstrument() {
    vi.resetModules();
    await import('../../src/scripts/soundinstrument.js');
    return window.SoundInstrument;
}

const documentListeners = [];

/**
 * Loads app.js as a fresh module against the current DOM. Listeners it registers
 * on `document` are tracked so `cleanupLoadedApps` can detach them afterwards.
 */
export async function loadApp() {
    const original = document.addEventListener.bind(document);
    document.addEventListener = (type, listener, options) => {
        documentListeners.push({ type, listener, options });
        original(type, listener, options);
    };
    try {
        vi.resetModules();
        await import('../../src/scripts/app.js');
    } finally {
        document.addEventListener = original;
    }
}

export function cleanupLoadedApps() {
    documentListeners.splice(0).forEach(({ type, listener, options }) => {
        document.removeEventListener(type, listener, options);
    });
}

/** Lets pending promise callbacks and timers run. */
export function flushAsync() {
    return new Promise((done) => setTimeout(done, 0));
}
