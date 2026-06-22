// Procedural Space Game Audio Synthesizer using Web Audio API

class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.bgOscillators = [];
        this.bgGainNodes = [];
        this.bgMusicTimer = null;
        this.isBgMusicPlaying = false;
        
        // Cache noise buffer to save CPU
        this.noiseBuffer = null;
    }

    /**
     * Initialize AudioContext on user interaction to bypass browser autoplay blocks
     */
    init() {
        if (this.ctx) return;
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.warn("Web Audio API is not supported in this browser.");
            return;
        }

        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Pre-create the white noise buffer for explosions
        this.createNoiseBuffer();
    }

    createNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
    }

    setMute(mute) {
        this.isMuted = mute;
        if (this.masterGain && this.ctx) {
            // Smooth volume transition to prevent pops
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime, 0.05);
        }
    }

    toggleMute() {
        this.setMute(!this.isMuted);
        return this.isMuted;
    }

    resumeContext() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Play Laser sound (Frequency sweep downward)
     */
    playLaser() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Tech sound: Sawtooth wave
        osc.type = 'sawtooth';
        
        const now = this.ctx.currentTime;
        // Start frequency high and slide down rapidly
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    /**
     * Play Obstacle Explosion sound (White noise with low-pass filter decay)
     */
    playExplosion() {
        this.init();
        this.resumeContext();
        if (!this.ctx || !this.noiseBuffer || this.isMuted) return;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';

        const gainNode = this.ctx.createGain();

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        const now = this.ctx.currentTime;
        
        // Sweep filter cutoff frequency down to make it sound muffled/deep
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.6);

        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

        noise.start(now);
        noise.stop(now + 0.7);
    }

    /**
     * Play Shield Activation or Active Deflection sound (Slide pitch upwards)
     */
    playShieldUp() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.masterGain);

        osc.type = 'sine';
        osc2.type = 'triangle';

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);
        
        osc2.frequency.setValueAtTime(204, now); // Detune slightly for chorus effect
        osc2.frequency.exponentialRampToValueAtTime(906, now + 0.4);

        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.start(now);
        osc2.start(now);
        
        osc.stop(now + 0.45);
        osc2.stop(now + 0.45);
    }

    /**
     * Play hit sound when ship gets damaged
     */
    playHit() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGain);

        osc.type = 'sawtooth';
        
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.15);

        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    /**
     * Play Powerup Collect Sound (Ascending arpeggio)
     */
    playPowerUp() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const notes = [329.63, 392.00, 523.25, 659.25, 783.99]; // E4, G4, C5, E5, G5
        const noteDuration = 0.07;

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(this.masterGain);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * noteDuration);

            gainNode.gain.setValueAtTime(0, now + idx * noteDuration);
            gainNode.gain.linearRampToValueAtTime(0.25, now + idx * noteDuration + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + idx * noteDuration + noteDuration + 0.05);

            osc.start(now + idx * noteDuration);
            osc.stop(now + idx * noteDuration + noteDuration + 0.1);
        });
    }

    /**
     * Play UI Button hover/click sound
     */
    playClick() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.masterGain);

        osc.type = 'sine';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.start(now);
        osc.stop(now + 0.06);
    }

    /**
     * Play Game Over melody (Slow sliding downward chords)
     */
    playGameOver() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const freqs = [311.13, 277.18, 233.08, 196.00]; // Eb4, Db4, Bb3, G3
        const step = 0.35;

        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(this.masterGain);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + idx * step);
            osc.frequency.linearRampToValueAtTime(freq - 30, now + idx * step + step);

            // Add lowpass filter to make it sound dim/somber
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            
            osc.disconnect(gainNode);
            osc.connect(filter);
            filter.connect(gainNode);

            gainNode.gain.setValueAtTime(0, now + idx * step);
            gainNode.gain.linearRampToValueAtTime(0.2, now + idx * step + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + idx * step + step);

            osc.start(now + idx * step);
            osc.stop(now + idx * step + step + 0.1);
        });
    }

    /**
     * Start procedural cosmic background drone music
     */
    startBackgroundMusic() {
        this.init();
        this.resumeContext();
        if (!this.ctx || this.isBgMusicPlaying) return;

        this.isBgMusicPlaying = true;
        
        // Create low drone frequencies (C1 and G1, C2)
        const droneFreqs = [32.70, 48.99, 65.41]; 
        
        droneFreqs.forEach((freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(80, this.ctx.currentTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            // Subtle volume breathing
            gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
            
            osc.start();

            this.bgOscillators.push(osc);
            this.bgGainNodes.push(gain);
        });

        // Ambient track: periodically trigger deep synth pulses and sweeps
        this.playBgSynthPulse();
    }

    playBgSynthPulse() {
        if (!this.isBgMusicPlaying || !this.ctx || this.isMuted) {
            this.bgMusicTimer = setTimeout(() => this.playBgSynthPulse(), 4000);
            return;
        }

        const now = this.ctx.currentTime;
        const noteFreqs = [130.81, 164.81, 196.00, 261.63, 329.63, 392.00]; // Ambient chords: C, E, G variations
        const selectedFreq = noteFreqs[Math.floor(Math.random() * noteFreqs.length)];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(selectedFreq, now);
        
        // slow filter sweep
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, now);
        filter.frequency.exponentialRampToValueAtTime(1200, now + 2);
        filter.frequency.exponentialRampToValueAtTime(100, now + 4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 2); // 2 second fade in
        gain.gain.exponentialRampToValueAtTime(0.001, now + 5.8); // 3.8 second fade out

        osc.start(now);
        osc.stop(now + 6);

        // Schedule next random background note
        const interval = 4000 + Math.random() * 4000; // 4 to 8 seconds
        this.bgMusicTimer = setTimeout(() => this.playBgSynthPulse(), interval);
    }

    stopBackgroundMusic() {
        this.isBgMusicPlaying = false;
        
        if (this.bgMusicTimer) {
            clearTimeout(this.bgMusicTimer);
            this.bgMusicTimer = null;
        }

        // Fade out low drones to prevent harsh pops
        const now = this.ctx ? this.ctx.currentTime : 0;
        this.bgGainNodes.forEach((gainNode) => {
            if (this.ctx) {
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            }
        });

        // Stop oscillators after fade out finishes
        const oscsToStop = [...this.bgOscillators];
        this.bgOscillators = [];
        this.bgGainNodes = [];

        setTimeout(() => {
            oscsToStop.forEach((osc) => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch(e) {}
            });
        }, 600);
    }
}

// Export singleton instance
export const audio = new SoundManager();
export default audio;
