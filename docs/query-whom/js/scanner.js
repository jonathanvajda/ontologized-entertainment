import { decodeGame } from './protocol.js';

export class QrScanner {
  constructor({ video, onCode, onMessage }) { Object.assign(this, { video, onCode, onMessage }); this.generation = 0; }
  async start() {
    this.stop(); const generation = this.generation;
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera scanning needs HTTPS or localhost. Enter the code instead.');
    if (typeof globalThis.jsQR !== 'function') throw new Error('The QR scanner could not load. Enter the code instead.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); }
    catch { throw new Error('Camera access is unavailable or was denied. Enter your friend’s code instead.'); }
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream; this.video.srcObject = stream; await this.video.play();
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
    const frame = async () => {
      if (generation !== this.generation) return;
      try {
        if (this.video.readyState >= 2) {
          const scale = Math.min(1, 640 / this.video.videoWidth); canvas.width = Math.round(this.video.videoWidth * scale); canvas.height = Math.round(this.video.videoHeight * scale);
          context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = globalThis.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
          if (result) {
            try {
              const { code } = await decodeGame(result.data);
              if (generation !== this.generation) return;
              this.stop(); this.onCode(code); return;
            } catch { this.onMessage('This isn’t a supported game QR. Point at the QR on your friend’s Share screen.'); }
          }
        }
      } catch { this.stop(); this.onMessage('The camera stopped. Close this panel and enter the code instead.'); return; }
      if (generation === this.generation) this.timer = setTimeout(frame, 120);
    };
    this.timer = setTimeout(frame, 120);
  }
  stop() { this.generation++; clearTimeout(this.timer); this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; this.video.srcObject = null; }
}
