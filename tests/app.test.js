import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cleanupLoadedApps,
    createCanvasContextStub,
    flushAsync,
    loadApp,
    loadIndexHtmlBody,
    stubCanvasContext
} from './helpers/loadScript.js';
import { GESTURE_LANDMARKS } from './helpers/landmarks.js';

let ctx;
let handsInstance;
let cameraInstance;
let HandsMock;
let CameraMock;
let SoundInstrumentMock;
let sound;

function createSoundInstrumentStub() {
    return {
        setVolume: vi.fn(),
        setInstrument: vi.fn(),
        playNote: vi.fn(),
        stop: vi.fn(),
        stopAllSounds: vi.fn()
    };
}

function installGlobals() {
    ctx = createCanvasContextStub();
    stubCanvasContext(ctx);

    handsInstance = {
        setOptions: vi.fn(),
        onResults: vi.fn(),
        send: vi.fn().mockResolvedValue(undefined)
    };
    cameraInstance = {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn()
    };
    HandsMock = vi.fn(function Hands() {
        return handsInstance;
    });
    CameraMock = vi.fn(function Camera() {
        return cameraInstance;
    });
    SoundInstrumentMock = vi.fn(createSoundInstrumentStub);

    window.Hands = HandsMock;
    window.Camera = CameraMock;
    window.drawConnectors = vi.fn();
    window.drawLandmarks = vi.fn();
    window.SoundInstrument = SoundInstrumentMock;
}

/** Loads app.js and runs its DOMContentLoaded bootstrap. */
async function bootstrapApp() {
    await loadApp();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    sound = SoundInstrumentMock.mock.results[0]?.value;
}

/** Feeds a MediaPipe result frame through the callback the app registered. */
function sendFrame(landmarkLists, image = { id: 'frame' }) {
    const onResults = handsInstance.onResults.mock.calls[0][0];
    onResults({ image, multiHandLandmarks: landmarkLists });
}

function el(id) {
    return document.getElementById(id);
}

function actionText() {
    return document.querySelector('#current-action .action-text').textContent;
}

function cameraLabel() {
    return document.querySelector('#camera-status span').textContent;
}

function dispatch(element, type) {
    element.dispatchEvent(new Event(type, { bubbles: true }));
}

async function startCamera() {
    el('startBtn').click();
    await flushAsync();
}

function stopCamera() {
    const stopBtn = el('stopBtn');
    stopBtn.disabled = false;
    stopBtn.click();
}

beforeEach(() => {
    loadIndexHtmlBody();
    installGlobals();
});

afterEach(() => {
    cleanupLoadedApps();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('bootstrap', () => {
    it('creates the sound engine, wires MediaPipe and resets the UI', async () => {
        el('volume').value = '55';

        await bootstrapApp();

        expect(SoundInstrumentMock).toHaveBeenCalledTimes(1);
        expect(sound.setVolume).toHaveBeenCalledWith(55);
        expect(HandsMock).toHaveBeenCalledTimes(1);
        expect(handsInstance.setOptions).toHaveBeenCalledWith({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });
        expect(handsInstance.onResults).toHaveBeenCalledTimes(1);
        expect(cameraLabel()).toBe('Cámara Detenida');
        expect(actionText()).toBe("Listo para comenzar. Haz clic en 'Iniciar Cámara'.");
    });

    it('resolves MediaPipe assets from the CDN', async () => {
        await bootstrapApp();

        const { locateFile } = HandsMock.mock.calls[0][0];
        expect(locateFile('hands_solution.wasm')).toBe(
            'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands_solution.wasm'
        );
    });

    it('marks the first instrument card as active', async () => {
        await bootstrapApp();

        const cards = [...document.querySelectorAll('.instrument-card')];
        expect(cards.filter((card) => card.classList.contains('active'))).toEqual([cards[0]]);
    });

    it('provides a HAND_CONNECTIONS fallback when MediaPipe did not load it', async () => {
        delete window.HAND_CONNECTIONS;

        await bootstrapApp();

        expect(window.HAND_CONNECTIONS).toHaveLength(20);
        expect(window.HAND_CONNECTIONS[0]).toEqual([0, 1]);
        expect(window.HAND_CONNECTIONS.at(-1)).toEqual([19, 20]);
    });

    it('keeps the MediaPipe connections when they already exist', async () => {
        window.HAND_CONNECTIONS = [[0, 1]];

        await bootstrapApp();

        expect(window.HAND_CONNECTIONS).toEqual([[0, 1]]);
        delete window.HAND_CONNECTIONS;
    });

    it('does nothing when the required elements are missing', async () => {
        document.body.innerHTML = '';

        await bootstrapApp();

        expect(SoundInstrumentMock).not.toHaveBeenCalled();
        expect(HandsMock).not.toHaveBeenCalled();
    });
});

describe('frame rendering', () => {
    beforeEach(async () => {
        await bootstrapApp();
    });

    it('repaints the canvas with the camera frame', () => {
        const image = { id: 'frame' };

        sendFrame([], image);

        expect(ctx.save).toHaveBeenCalledTimes(1);
        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
        expect(ctx.drawImage).toHaveBeenCalledWith(image, 0, 0, 640, 480);
        expect(ctx.restore).toHaveBeenCalledTimes(1);
        expect(window.drawConnectors).not.toHaveBeenCalled();
    });

    it('draws each detected hand in its own colour', () => {
        sendFrame([GESTURE_LANDMARKS.open_hand, GESTURE_LANDMARKS.pointing]);

        expect(window.drawConnectors).toHaveBeenCalledTimes(2);
        expect(window.drawLandmarks).toHaveBeenCalledTimes(2);
        expect(window.drawConnectors.mock.calls[0][2]).toBe(window.HAND_CONNECTIONS);
        expect(window.drawConnectors.mock.calls[0][3]).toEqual({ color: '#00FF00', lineWidth: 2 });
        expect(window.drawConnectors.mock.calls[1][3]).toEqual({ color: '#FF66C4', lineWidth: 2 });
    });

    it('tolerates a frame without landmarks', () => {
        expect(() => sendFrame(undefined)).not.toThrow();
        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    });
});

describe('gesture detection', () => {
    beforeEach(async () => {
        await bootstrapApp();
    });

    it.each([
        ['open_hand', 'Mano abierta'],
        ['peace', 'Paz y amor'],
        ['pointing', 'Señalar']
    ])('plays %s and reports it', (gesture, label) => {
        sendFrame([GESTURE_LANDMARKS[gesture]]);

        expect(sound.playNote).toHaveBeenCalledWith(gesture, 0.7);
        expect(actionText()).toBe(`Gesto detectado (Mano 1): ${label}`);
    });

    it('plays a fist when every fingertip is folded', () => {
        sendFrame([GESTURE_LANDMARKS.fist]);

        expect(sound.playNote).toHaveBeenCalledWith('fist', 0.7);
        expect(actionText()).toBe('Gesto detectado (Mano 1): Puño cerrado');
    });

    it('reports thumbs-up landmarks as a fist, since the fist rule matches first', () => {
        sendFrame([GESTURE_LANDMARKS.thumbs_up]);

        expect(sound.playNote).toHaveBeenCalledWith('fist', 0.7);
    });

    it('uses the current volume slider value', () => {
        el('volume').value = '30';

        sendFrame([GESTURE_LANDMARKS.open_hand]);

        expect(sound.playNote).toHaveBeenCalledWith('open_hand', 0.3);
    });

    it('ignores hands whose pose matches no gesture', () => {
        sendFrame([GESTURE_LANDMARKS.unknown]);

        expect(sound.playNote).not.toHaveBeenCalled();
        expect(actionText()).toBe("Listo para comenzar. Haz clic en 'Iniciar Cámara'.");
    });

    it('tracks both hands independently', () => {
        sendFrame([GESTURE_LANDMARKS.open_hand, GESTURE_LANDMARKS.pointing]);

        expect(sound.playNote).toHaveBeenNthCalledWith(1, 'open_hand', 0.7);
        expect(sound.playNote).toHaveBeenNthCalledWith(2, 'pointing', 0.7);
        expect(actionText()).toBe('Gesto detectado (Mano 2): Señalar');
    });

    it('does not repeat the same gesture on the same hand', () => {
        sendFrame([GESTURE_LANDMARKS.open_hand]);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);

        sendFrame([GESTURE_LANDMARKS.open_hand]);

        expect(sound.playNote).toHaveBeenCalledTimes(1);
    });

    it('ignores a new gesture while the cooldown is running', () => {
        sendFrame([GESTURE_LANDMARKS.open_hand]);
        sound.playNote.mockClear();

        sendFrame([GESTURE_LANDMARKS.pointing]);

        expect(sound.playNote).not.toHaveBeenCalled();
    });

    it('accepts a new gesture once the cooldown expired', () => {
        sendFrame([GESTURE_LANDMARKS.open_hand]);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);

        sendFrame([GESTURE_LANDMARKS.pointing]);

        expect(sound.playNote).toHaveBeenLastCalledWith('pointing', 0.7);
    });

    it('shortens the cooldown when sensitivity increases', () => {
        const sensitivity = el('sensitivity');
        sensitivity.value = '10';
        dispatch(sensitivity, 'input');

        sendFrame([GESTURE_LANDMARKS.open_hand]);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 150);
        sendFrame([GESTURE_LANDMARKS.pointing]);

        expect(el('sensitivity-value').textContent).toBe('10');
        expect(sound.playNote).toHaveBeenCalledTimes(2);
    });

    it('lengthens the cooldown when sensitivity decreases', () => {
        const sensitivity = el('sensitivity');
        sensitivity.value = '1';
        dispatch(sensitivity, 'input');

        sendFrame([GESTURE_LANDMARKS.open_hand]);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600);
        sendFrame([GESTURE_LANDMARKS.pointing]);

        expect(sound.playNote).toHaveBeenCalledTimes(1);
    });
});

describe('camera control', () => {
    beforeEach(async () => {
        await bootstrapApp();
    });

    it('starts the camera and updates buttons, indicator and status', async () => {
        await startCamera();

        expect(CameraMock).toHaveBeenCalledTimes(1);
        expect(CameraMock.mock.calls[0][0]).toBe(el('input_video'));
        expect(CameraMock.mock.calls[0][1]).toMatchObject({ width: 640, height: 480 });
        expect(cameraInstance.start).toHaveBeenCalledTimes(1);
        expect(el('startBtn').disabled).toBe(true);
        expect(el('stopBtn').disabled).toBe(false);
        expect(cameraLabel()).toBe('Cámara Activada');
        expect(actionText()).toBe('Cámara activa - Realiza gestos con ambas manos');
    });

    it('forwards frames to MediaPipe while running', async () => {
        await startCamera();

        await CameraMock.mock.calls[0][1].onFrame();

        expect(handsInstance.send).toHaveBeenCalledWith({ image: el('input_video') });
    });

    it('stops forwarding frames after the camera is stopped', async () => {
        await startCamera();
        const { onFrame } = CameraMock.mock.calls[0][1];

        stopCamera();
        await onFrame();

        expect(handsInstance.send).not.toHaveBeenCalled();
    });

    it('stops the camera and silences the instrument', async () => {
        await startCamera();

        stopCamera();

        expect(cameraInstance.stop).toHaveBeenCalledTimes(1);
        expect(sound.stop).toHaveBeenCalledTimes(1);
        expect(el('startBtn').disabled).toBe(false);
        expect(el('stopBtn').disabled).toBe(true);
        expect(cameraLabel()).toBe('Cámara Detenida');
        expect(actionText()).toBe('Cámara detenida.');
    });

    it('stops cleanly when the camera was never started', () => {
        stopCamera();

        expect(actionText()).toBe('Cámara detenida.');
        expect(sound.stop).toHaveBeenCalledTimes(1);
    });

    it('logs but does not rethrow when stopping the camera fails', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await startCamera();
        cameraInstance.stop.mockImplementation(() => {
            throw new Error('already gone');
        });

        expect(() => stopCamera()).not.toThrow();
        expect(errorSpy).toHaveBeenCalled();
    });

    it('skips a camera object without a stop method', async () => {
        CameraMock.mockImplementation(function Camera() {
            return { start: vi.fn().mockResolvedValue(undefined) };
        });
        await startCamera();

        stopCamera();

        expect(actionText()).toBe('Cámara detenida.');
    });

    it('reports a camera permission failure and keeps the UI usable', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        cameraInstance.start.mockRejectedValue(new Error('denied'));

        await startCamera();

        expect(errorSpy).toHaveBeenCalled();
        expect(actionText()).toBe('Error: No se pudo acceder a la cámara.');
        expect(cameraLabel()).toBe('Cámara Detenida');
        expect(el('startBtn').disabled).toBe(false);
    });
});

describe('instrument selection', () => {
    beforeEach(async () => {
        await bootstrapApp();
    });

    it('activates only the clicked card and forwards the instrument', () => {
        const cards = [...document.querySelectorAll('.instrument-card')];
        const target = cards[3];

        target.click();

        expect(sound.setInstrument).toHaveBeenCalledWith('guitar');
        expect(cards.filter((card) => card.classList.contains('active'))).toEqual([target]);
        expect(actionText()).toBe('Instrumento seleccionado: Guitarra Rock');
    });

    it('offers every instrument of the sound engine', () => {
        const instruments = [...document.querySelectorAll('.instrument-card')].map(
            (card) => card.dataset.instrument
        );

        expect(instruments).toEqual(['piano', 'harp', 'synth', 'guitar', 'drums', 'xylophone']);
    });
});

describe('settings', () => {
    beforeEach(async () => {
        await bootstrapApp();
    });

    it('applies the volume slider to the engine and the label', () => {
        const slider = el('volume');
        slider.value = '25';

        dispatch(slider, 'input');

        expect(sound.setVolume).toHaveBeenLastCalledWith(25);
        expect(el('volume-value').textContent).toBe('25%');
    });

    it('reports the selected effect', () => {
        const select = el('effects');
        select.value = 'reverb';

        dispatch(select, 'change');

        expect(actionText()).toBe('Efecto seleccionado: Reverb Espacial');
    });
});

describe('recording and clearing', () => {
    beforeEach(async () => {
        await bootstrapApp();
    });

    it('toggles the record button between both states', () => {
        const button = el('record-btn');

        button.click();
        expect(button.textContent).toContain('Parar Grabación');
        expect(actionText()).toBe('Grabando tu canción mágica...');

        button.click();
        expect(button.textContent).toContain('Grabar Canción');
        expect(actionText()).toBe('Grabación detenida.');
    });

    it('silences all sounds when clearing', () => {
        el('clear-btn').click();

        expect(sound.stopAllSounds).toHaveBeenCalledTimes(1);
        expect(actionText()).toBe('Todo limpiado. Listo para nueva magia.');
    });
});

describe('status panel', () => {
    it('falls back to the container text when the action node is missing', async () => {
        await bootstrapApp();
        el('current-action').innerHTML = '';

        el('clear-btn').click();

        expect(el('current-action').textContent).toBe('Todo limpiado. Listo para nueva magia.');
    });

    it('survives a missing camera indicator', async () => {
        el('camera-status').remove();

        await expect(bootstrapApp()).resolves.not.toThrow();
        expect(actionText()).toBe("Listo para comenzar. Haz clic en 'Iniciar Cámara'.");
    });
});
