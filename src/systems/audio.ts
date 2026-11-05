export class AudioManager {
    private ctx: AudioContext | null = null;
    private droneOscillator: OscillatorNode | null = null;
    private droneGain: GainNode | null = null;

    private lastHeartbeatTime: number = 0;
    private heartbeatInterval: number = 1000;

    public init(): void {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    public startDrone(): void {
        if (!this.ctx) return;
        this.stopAll();
        this.droneOscillator = this.ctx.createOscillator();
        this.droneGain = this.ctx.createGain();
        this.droneOscillator.type = 'sine';
        this.droneOscillator.frequency.value = 55;
        this.droneGain.gain.value = 0.5;
        this.droneOscillator.connect(this.droneGain);
        this.droneGain.connect(this.ctx.destination);
        this.droneOscillator.start();
    }

    public stopAll(): void {
        if (this.droneOscillator) {
            this.droneOscillator.stop();
            this.droneOscillator.disconnect();
            this.droneOscillator = null;
        }
    }

    public updateHeartbeat(distanceToPredator: number, currentTime: number): void {
        if (!this.ctx) return;
        const clampedDist = Math.max(50, Math.min(600, distanceToPredator));
        this.heartbeatInterval = 250 + ((clampedDist - 50) / 550) * 750;
        if (currentTime - this.lastHeartbeatTime > this.heartbeatInterval) {
            this.playHeartbeatThump();
            this.lastHeartbeatTime = currentTime;
        }
    }

    private playHeartbeatThump(): void {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 'sine' or 'square' wave for a clean electronic sound
        osc.type = 'sine';

        // High-pitched clear pip (850Hz) instead of a low thump
        osc.frequency.setValueAtTime(850, this.ctx.currentTime);

        // Volume envelope: sharp attack, quick fade
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.01); // Quick snap on
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1); // Quick fade out

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // NEW: Procedural Thunder Crash
    public playThunder(): void {
        if (!this.ctx) return;

        // Create 3 seconds of white noise for the thunder
        const bufferSize = this.ctx.sampleRate * 3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // White noise
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter to make it sound like a deep boom instead of static
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime); // High freq for the crack
        filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5); // Drop to low rumble

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1.5, this.ctx.currentTime + 0.05); // Sharp attack (crack)
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 3); // Long fade out (rumble)

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start();
    }
}
