import { RECORD } from './config.js';

const VIDEO_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
// With sound, only take mp4 when the audio is AAC. Chrome's plain video/mp4
// would put Opus in it, which a lot of players and upload forms reject.
const AV_TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2'];
const WEBM_AV = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'];

export function pickMimeType(withAudio) {
  if (typeof MediaRecorder === 'undefined') return null;
  const ok = (t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  };
  if (withAudio) {
    const av = AV_TYPES.find(ok);
    if (av) return { type: av, audio: true };
  }
  const mp4 = VIDEO_TYPES.slice(0, 3).find(ok);
  if (mp4) return { type: mp4, audio: false };
  if (withAudio) {
    const wav = WEBM_AV.find(ok);
    if (wav) return { type: wav, audio: true };
  }
  const webm = VIDEO_TYPES.slice(3).find(ok);
  return webm ? { type: webm, audio: false } : null;
}

export function outputSize(aspect) {
  const a = typeof aspect === 'number' ? aspect : RECORD.aspects[aspect] || 9 / 16;
  const long = RECORD.longSide;
  let w;
  let h;
  if (a < 1) {
    h = long;
    w = long * a;
  } else if (a > 1) {
    w = long;
    h = long / a;
  } else {
    w = h = 1080;
  }
  return { w: Math.round(w / 2) * 2, h: Math.round(h / 2) * 2 };
}

// The largest centered crop of the canvas with the given aspect, CSS pixels.
export function cropRect(canvasW, canvasH, aspect) {
  const a = typeof aspect === 'number' ? aspect : RECORD.aspects[aspect] || 9 / 16;
  let w = canvasW;
  let h = w / a;
  if (h > canvasH) {
    h = canvasH;
    w = h * a;
  }
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
}

// The plain frame: just the WebGL crop. The bar swaps in its own overlay.
function composite(ctx, W, H, glCanvas, crop) {
  const sx = glCanvas.width / glCanvas.clientWidth;
  ctx.drawImage(glCanvas, crop.x * sx, crop.y * sx, crop.w * sx, crop.h * sx, 0, 0, W, H);
}

export class Recorder {
  constructor(glCanvas) {
    this.gl = glCanvas;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle';
    this.pendingShot = null;
    // Swap this to draw a different overlay (same signature as composite).
    this.compose = composite;
  }

  get busy() {
    return this.state !== 'idle';
  }

  // Resolves with { blob, type, ext } when the clip is done.
  start(aspect, audioStream, crop) {
    const { w, h } = outputSize(aspect);
    this.canvas.width = w;
    this.canvas.height = h;
    this.crop = crop;
    const pick = pickMimeType(!!audioStream);
    if (!pick || !this.canvas.captureStream) return Promise.reject(new Error('Recording is not supported in this browser.'));
    const stream = this.canvas.captureStream(RECORD.fps);
    if (pick.audio && audioStream) for (const t of audioStream.getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, { mimeType: pick.type, videoBitsPerSecond: RECORD.bitrate });
    const chunks = [];
    this.state = 'recording';
    this.startedAt = performance.now();
    return new Promise((resolve, reject) => {
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      rec.onerror = (e) => {
        this.state = 'idle';
        reject(e.error || new Error('Recording failed.'));
      };
      rec.onstop = () => {
        this.state = 'idle';
        for (const t of stream.getVideoTracks()) t.stop();
        const type = pick.type.split(';')[0];
        const blob = new Blob(chunks, { type });
        if (!blob.size) reject(new Error('Recording came out empty. Try again.'));
        else resolve({ blob, type, ext: type === 'video/mp4' ? 'mp4' : 'webm' });
      };
      rec.start(250);
      this.rec = rec;
      this.timer = setTimeout(() => this.stop(), RECORD.seconds * 1000);
    });
  }

  stop() {
    clearTimeout(this.timer);
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
  }

  progress() {
    return this.state === 'recording' ? Math.min(1, (performance.now() - this.startedAt) / (RECORD.seconds * 1000)) : 0;
  }

  // Next rendered frame becomes a PNG.
  screenshot(aspect, crop) {
    return new Promise((resolve) => {
      this.pendingShot = { aspect, crop, resolve };
    });
  }

  // Call right after rendering, while the WebGL buffer is still valid.
  capture(info) {
    if (this.state === 'recording') this.compose(this.ctx, this.canvas.width, this.canvas.height, this.gl, this.crop, info);
    if (this.pendingShot) {
      const { aspect, crop, resolve } = this.pendingShot;
      this.pendingShot = null;
      const { w, h } = outputSize(aspect);
      const c = document.createElement('canvas');
      const scale = 1.5;
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      this.compose(c.getContext('2d'), c.width, c.height, this.gl, crop, info);
      c.toBlob((blob) => resolve({ blob, type: 'image/png', ext: 'png' }), 'image/png');
    }
  }
}

export async function shareOrDownload(file, preferShare) {
  if (preferShare && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Squish' });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  download(file);
  return 'downloaded';
}

export function canShareFile(file) {
  return !!(navigator.canShare && navigator.canShare({ files: [file] }));
}

export function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
