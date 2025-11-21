export class AudioManager {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgm = document.getElementById('bgm');
        this.isMusicActive = false;
    }

    resumeContext() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    toggleMusic() {
        if (this.bgm.paused) {
            return this.bgm.play().then(() => {
                this.isMusicActive = true;
                return true;
            }).catch(e => {
                console.log("Audio play failed:", e);
                return false;
            });
        } else {
            this.bgm.pause();
            this.isMusicActive = false;
            return Promise.resolve(false);
        }
    }

    playMusic() {
        this.bgm.volume = 0.02;
        return this.bgm.play().then(() => {
            this.isMusicActive = true;
            return true;
        }).catch(e => {
            console.log("Auto-play blocked:", e);
            return false;
        });
    }

    playMoveSound() {
        this.resumeContext();
        const t = this.audioCtx.currentTime;
        // High click
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.frequency.setValueAtTime(1200, t);
        osc1.frequency.exponentialRampToValueAtTime(100, t + 0.05);
        gain1.gain.setValueAtTime(0.1, t);
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(t);
        osc1.stop(t + 0.05);
        // Low thud
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.frequency.setValueAtTime(300, t);
        osc2.frequency.exponentialRampToValueAtTime(50, t + 0.15);
        gain2.gain.setValueAtTime(0.1, t);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(t);
        osc2.stop(t + 0.15);
    }

    playSkillSound(type) {
        this.resumeContext();
        const t = this.audioCtx.currentTime;

        if (type === 'sand') {
            const bufferSize = this.audioCtx.sampleRate * 0.5;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 800;
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);
            noise.start(t);
        } else if (type === 'mist') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.exponentialRampToValueAtTime(440, t + 1.0);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(t);
            osc.stop(t + 1.5);
        } else if (type === 'skip') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.5);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.5);
        } else if (type === 'swap') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.linearRampToValueAtTime(800, t + 0.2);
            osc.frequency.linearRampToValueAtTime(200, t + 0.4);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.4);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        }
    }

    playDraftSound() {
        this.resumeContext();
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.5);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 1.0);
    }
}
