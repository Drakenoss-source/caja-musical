import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
    audioContextConstructor,
    createAudioContextStub,
    loadSoundInstrument
} from './helpers/loadScript.js';

const GESTURES = ['fist', 'open_hand', 'peace', 'thumbs_up', 'pointing'];
const INSTRUMENTS = ['piano', 'harp', 'synth', 'guitar', 'drums', 'xylophone'];

let SoundInstrument;

beforeEach(async () => {
    SoundInstrument = await loadSoundInstrument();
});

afterEach(() => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    vi.restoreAllMocks();
});

describe('SoundInstrument construction', () => {
    it('starts on piano with default volume and no audio context', () => {
        const instrument = new SoundInstrument();

        expect(instrument.currentInstrument).toBe('piano');
        expect(instrument.volume).toBe(0.7);
        expect(instrument.audioContext).toBeNull();
    });

    it('exposes every instrument with a wave type and the five gestures', () => {
        const instrument = new SoundInstrument();

        expect(Object.keys(instrument.instruments)).toEqual(INSTRUMENTS);
        INSTRUMENTS.forEach((name) => {
            const config = instrument.instruments[name];
            expect(typeof config.waveType).toBe('string');
            expect(Object.keys(config.gestures)).toEqual(GESTURES);
            GESTURES.forEach((gesture) => {
                expect(config.gestures[gesture].length).toBeGreaterThan(0);
            });
        });
    });

    it('maps every gesture note to a known frequency', () => {
        const instrument = new SoundInstrument();

        Object.values(instrument.instruments).forEach((config) => {
            Object.values(config.gestures)
                .flat()
                .forEach((noteName) => {
                    expect(instrument.notes[noteName]).toBeGreaterThan(0);
                });
        });
    });
});

describe('setVolume', () => {
    it.each([
        [0, 0],
        [50, 0.5],
        [100, 1],
        ['35', 0.35]
    ])('converts %o percent into %o', (input, expected) => {
        const instrument = new SoundInstrument();
        instrument.setVolume(input);
        expect(instrument.volume).toBeCloseTo(expected, 5);
    });

    it('clamps values outside the 0-100 range', () => {
        const instrument = new SoundInstrument();

        instrument.setVolume(500);
        expect(instrument.volume).toBe(1);

        instrument.setVolume(-500);
        expect(instrument.volume).toBe(0);
    });

    it('rejects values that are not numbers', () => {
        const instrument = new SoundInstrument();

        expect(() => instrument.setVolume('mucho')).toThrow(TypeError);
        expect(instrument.volume).toBe(0.7);
    });
});

describe('setInstrument', () => {
    it('switches to a known instrument', () => {
        const instrument = new SoundInstrument();
        instrument.setInstrument('drums');
        expect(instrument.currentInstrument).toBe('drums');
    });

    it('rejects unknown instruments', () => {
        const instrument = new SoundInstrument();

        expect(() => instrument.setInstrument('kazoo')).toThrow('Instrumento desconocido: kazoo');
        expect(instrument.currentInstrument).toBe('piano');
    });
});

describe('ensureAudioContext', () => {
    it('creates the context once and reuses it', () => {
        const { context } = createAudioContextStub();
        const AudioContextMock = audioContextConstructor(context);
        window.AudioContext = AudioContextMock;

        const instrument = new SoundInstrument();
        instrument.ensureAudioContext();
        instrument.ensureAudioContext();

        expect(AudioContextMock).toHaveBeenCalledTimes(1);
        expect(instrument.audioContext).toBe(context);
    });

    it('falls back to webkitAudioContext', () => {
        const { context } = createAudioContextStub();
        const WebkitMock = audioContextConstructor(context);
        window.AudioContext = undefined;
        window.webkitAudioContext = WebkitMock;

        const instrument = new SoundInstrument();
        instrument.ensureAudioContext();

        expect(WebkitMock).toHaveBeenCalledTimes(1);
    });

    it('resumes a suspended context', () => {
        const { context } = createAudioContextStub({ state: 'suspended' });
        window.AudioContext = audioContextConstructor(context);

        const instrument = new SoundInstrument();
        instrument.ensureAudioContext();

        expect(context.resume).toHaveBeenCalledTimes(1);
        expect(context.state).toBe('running');
    });

    it('reports a failed resume without rejecting', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { context } = createAudioContextStub({ state: 'suspended' });
        context.resume = vi.fn(() => Promise.reject(new Error('bloqueado')));
        window.AudioContext = audioContextConstructor(context);

        const instrument = new SoundInstrument();
        expect(() => instrument.ensureAudioContext()).not.toThrow();
        await Promise.resolve();

        expect(errorSpy).toHaveBeenCalled();
    });

    it('throws when the browser has no Web Audio API', () => {
        window.AudioContext = undefined;
        window.webkitAudioContext = undefined;

        const instrument = new SoundInstrument();

        expect(() => instrument.ensureAudioContext()).toThrow('Web Audio API no disponible');
    });
});

describe('playNote', () => {
    let stub;

    beforeEach(() => {
        stub = createAudioContextStub();
        window.AudioContext = audioContextConstructor(stub.context);
    });

    it('plays one oscillator per note of the gesture chord', () => {
        const instrument = new SoundInstrument();
        instrument.playNote('fist');

        const chord = instrument.instruments.piano.gestures.fist;
        expect(stub.oscillators).toHaveLength(chord.length);
        stub.oscillators.forEach((osc, index) => {
            expect(osc.type).toBe('triangle');
            expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(
                instrument.notes[chord[index]],
                10 + index * 0.09
            );
            expect(osc.start).toHaveBeenCalledWith(10 + index * 0.09);
            expect(osc.stop).toHaveBeenCalledWith(10 + index * 0.09 + 0.2);
        });
    });

    it('routes each oscillator through its own gain node into the destination', () => {
        const instrument = new SoundInstrument();
        instrument.playNote('fist');

        expect(stub.gains).toHaveLength(stub.oscillators.length);
        stub.oscillators.forEach((osc, index) => {
            expect(osc.connect).toHaveBeenCalledWith(stub.gains[index]);
            expect(stub.gains[index].connect).toHaveBeenCalledWith(stub.context.destination);
        });
    });

    it('uses the stored volume and fades every note out', () => {
        const instrument = new SoundInstrument();
        instrument.setVolume(40);
        instrument.playNote('fist');

        stub.gains.forEach((gain, index) => {
            expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.4, 10 + index * 0.09);
            expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
                0.001,
                10 + index * 0.09 + 0.2
            );
        });
    });

    it('prefers a numeric volume override and clamps it', () => {
        const instrument = new SoundInstrument();
        instrument.playNote('fist', 0.25);
        expect(stub.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.25, 10);

        instrument.playNote('fist', 9);
        expect(stub.gains[4].gain.setValueAtTime).toHaveBeenCalledWith(1, 10);
    });

    it('ignores a non numeric volume override', () => {
        const instrument = new SoundInstrument();
        instrument.playNote('fist', '0.1');
        expect(stub.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.7, 10);
    });

    it('uses the wave type of the selected instrument', () => {
        const instrument = new SoundInstrument();
        instrument.setInstrument('synth');
        instrument.playNote('peace');

        stub.oscillators.forEach((osc) => expect(osc.type).toBe('sawtooth'));
    });

    it('warns and reports failure for an unknown gesture', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const instrument = new SoundInstrument();

        expect(instrument.playNote('moonwalk')).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
        expect(window.AudioContext).not.toHaveBeenCalled();
        expect(stub.oscillators).toHaveLength(0);
    });

    it('throws when the current instrument is missing', () => {
        const instrument = new SoundInstrument();
        instrument.currentInstrument = 'kazoo';

        expect(() => instrument.playNote('fist')).toThrow('Instrumento actual no configurado');
        expect(window.AudioContext).not.toHaveBeenCalled();
    });

    it('reports failure when the gesture chord is empty', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const instrument = new SoundInstrument();
        instrument.instruments.piano.gestures.fist = [];

        expect(instrument.playNote('fist')).toBe(false);
        expect(window.AudioContext).not.toHaveBeenCalled();
    });

    it('skips notes without a known frequency', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const instrument = new SoundInstrument();
        instrument.instruments.piano.gestures.fist = ['C4', 'Z9'];

        expect(instrument.playNote('fist')).toBe(true);
        expect(stub.oscillators).toHaveLength(1);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('creates the audio context on first play', () => {
        const instrument = new SoundInstrument();
        expect(instrument.audioContext).toBeNull();

        instrument.playNote('fist');
        expect(instrument.audioContext).toBe(stub.context);
    });
});

