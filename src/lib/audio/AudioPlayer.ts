export class AudioPlayer {
  private context: AudioContext | null = null;
  private queue: AudioBuffer[] = [];
  private nextStartTime = 0;
  private sourceNodes: AudioBufferSourceNode[] = [];
  public onPlayStateChange?: (isPlaying: boolean) => void;

  constructor() {
    this.context = new AudioContext({ sampleRate: 24000 });
  }

  async play(base64: string) {
    if (!this.context) return;
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    const audioBuffer = this.context.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    this.queue.push(audioBuffer);
    this.scheduleNext();
  }

  private scheduleNext() {
    if (!this.context || this.queue.length === 0) return;
    
    const currentTime = this.context.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.05;
    }

    const buffer = this.queue.shift()!;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(this.nextStartTime);
    
    this.sourceNodes.push(source);
    this.onPlayStateChange?.(true);
    
    source.onended = () => {
      const index = this.sourceNodes.indexOf(source);
      if (index > -1) {
        this.sourceNodes.splice(index, 1);
      }
      if (this.sourceNodes.length === 0 && this.queue.length === 0) {
        this.onPlayStateChange?.(false);
      }
    };

    this.nextStartTime += buffer.duration;
  }

  stop() {
    this.sourceNodes.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    this.sourceNodes = [];
    this.queue = [];
    this.nextStartTime = this.context ? this.context.currentTime : 0;
    this.onPlayStateChange?.(false);
  }
}
