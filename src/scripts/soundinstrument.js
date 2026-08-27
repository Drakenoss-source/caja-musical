class SoundInstrument {
    constructor() {
        this.currentInstrument = 'piano';
        this.audioContext = null;
        this.volume = 0.7;
        this.initializeInstruments();
    }

    initializeInstruments() {
        this.notes = {
            C3: 130.81,
            D3: 146.83,
            E3: 164.81,
            F3: 174.61,
            G3: 196.0,
            A3: 220.0,
            B3: 246.94,
            C4: 261.63,
            D4: 293.66,
            E4: 329.63,
            F4: 349.23,
            G4: 392.0,
            A4: 440.0,
            B4: 493.88,
            C5: 523.25,
            D5: 587.33,
            E5: 659.25,
            F5: 698.46,
            G5: 783.99,
            A5: 880.0,
            B5: 987.77,
            C6: 1046.5,
            D6: 1174.66
        };

        this.instruments = {
            piano: {
                waveType: 'triangle',
                gestures: {
                    fist: ['C4', 'E4', 'G4', 'C5'],
                    open_hand: ['D4', 'F4', 'A4', 'D5'],
                    peace: ['E4', 'G4', 'B4', 'E5'],
                    thumbs_up: ['F4', 'A4', 'C5', 'F5'],
                    pointing: ['G4', 'B4', 'D5', 'G5']
                }
            },
            harp: {
                waveType: 'sine',
                gestures: {
                    fist: ['C4', 'G4', 'E4', 'C5'],
                    open_hand: ['D4', 'A4', 'F4', 'D5'],
                    peace: ['E4', 'B4', 'G4', 'E5'],
                    thumbs_up: ['F4', 'C5', 'A4', 'F5'],
                    pointing: ['G4', 'D5', 'B4', 'G5']
                }
            },
            synth: {
                waveType: 'sawtooth',
                gestures: {
                    fist: ['C4', 'C5', 'G4', 'E4'],
                    open_hand: ['D4', 'D5', 'A4', 'F4'],
                    peace: ['E4', 'E5', 'B4', 'G4'],
                    thumbs_up: ['F4', 'F5', 'C5', 'A4'],
                    pointing: ['G4', 'G5', 'D5', 'B4']
                }
            },
            guitar: {
                waveType: 'square',
                gestures: {
                    fist: ['C4', 'E4', 'G4'],
                    open_hand: ['D4', 'F4', 'A4'],
                    peace: ['E4', 'G4', 'B4'],
                    thumbs_up: ['F4', 'A4', 'C5'],
                    pointing: ['G4', 'B4', 'D5']
                }
            },
            drums: {
                waveType: 'square',
                gestures: {
                    fist: ['C3', 'C4'],
                    open_hand: ['D3', 'D4'],
                    peace: ['E3', 'E4'],
                    thumbs_up: ['F3', 'F4'],
                    pointing: ['G3', 'G4']
                }
            },
            xylophone: {
                waveType: 'sine',
                gestures: {
                    fist: ['C5', 'E5', 'G5'],
                    open_hand: ['D5', 'F5', 'A5'],
                    peace: ['E5', 'G5', 'B5'],
                    thumbs_up: ['F5', 'A5', 'C6'],
                    pointing: ['G5', 'B5', 'D6']
                }
            }
        };
    }

    ensureAudioContext() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (typeof AudioContextClass !== 'function') {
                throw new Error('Web Audio API no disponible en este navegador.');
            }
            this.audioContext = new AudioContextClass();
        }
        if (this.audioContext.state === 'suspended') {
            const resumed = this.audioContext.resume();
            if (resumed && typeof resumed.catch === 'function') {
                resumed.catch((error) => {
                    console.error('No se pudo reanudar el contexto de audio:', error);
                });
            }
        }
        return this.audioContext;
    }

    setVolume(volumeValue) {
        const normalized = Number(volumeValue) / 100;
        if (!Number.isFinite(normalized)) {
            throw new TypeError(`Volumen invalido: ${volumeValue}`);
        }
        this.volume = Math.max(0, Math.min(1, normalized));
    }

    setInstrument(instrumentName) {
        if (!this.instruments[instrumentName]) {
            throw new Error(`Instrumento desconocido: ${instrumentName}`);
        }
        this.currentInstrument = instrumentName;
    }

    playNote(gesture, volumeOverride) {
        const instrument = this.instruments[this.currentInstrument];
        if (!instrument) {
            throw new Error(`Instrumento actual no configurado: ${this.currentInstrument}`);
        }

        const notes = instrument.gestures[gesture];
        if (!notes || notes.length === 0) {
            console.warn(`Gesto sin notas asignadas (${this.currentInstrument}): ${gesture}`);
            return false;
        }

        this.ensureAudioContext();
        const volume = typeof volumeOverride === 'number' && Number.isFinite(volumeOverride)
            ? volumeOverride
            : this.volume;
        const safeVolume = Math.max(0, Math.min(1, volume));
        const now = this.audioContext.currentTime;
        const step = 0.09;
        const duration = 0.2;

        notes.forEach((noteName, index) => {
            const freq = this.notes[noteName];
            if (!freq) {
                console.warn(`Nota desconocida ignorada: ${noteName}`);
                return;
            }

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const start = now + index * step;
            const end = start + duration;

            osc.type = instrument.waveType;
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(safeVolume, start);
            gain.gain.exponentialRampToValueAtTime(0.001, end);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.start(start);
            osc.stop(end);
        });

        return true;
    }
}

window.SoundInstrument = SoundInstrument;
