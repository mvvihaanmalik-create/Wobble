// Overlay drawn into clips and photos: the bar's name, the day and guest,
// tips so far, the last plate's stars and the short URL.
const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'Plex Mono', ui-monospace, Menlo, monospace";
const PAPER = '#f7efe2';

export function composeBar(ctx, W, H, glCanvas, crop, info) {
  const sx = glCanvas.width / glCanvas.clientWidth;
  ctx.drawImage(glCanvas, crop.x * sx, crop.y * sx, crop.w * sx, crop.h * sx, 0, 0, W, H);
  const m = Math.min(W, H);
  const pad = m * 0.05;
  // Soft shade under the text so it reads on any part of the bar.
  const top = ctx.createLinearGradient(0, 0, 0, m * 0.28);
  top.addColorStop(0, 'rgba(20,12,8,0.55)');
  top.addColorStop(1, 'rgba(20,12,8,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, m * 0.28);
  const bottom = ctx.createLinearGradient(0, H - m * 0.3, 0, H);
  bottom.addColorStop(0, 'rgba(20,12,8,0)');
  bottom.addColorStop(1, 'rgba(20,12,8,0.6)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H - m * 0.3, W, m * 0.3);

  ctx.fillStyle = PAPER;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `${m * 0.085}px ${SERIF}`;
  ctx.fillText('Squishi.', pad, pad + m * 0.07);
  mono(ctx, [info.day, info.guest].filter(Boolean).join('  ·  ').toUpperCase(), pad, pad + m * 0.11, m * 0.022);

  const base = H - pad;
  mono(ctx, 'TIPS TONIGHT', pad, base - m * 0.075, m * 0.022);
  ctx.font = `${m * 0.07}px ${SERIF}`;
  ctx.fillText(`¥${(info.tips || 0).toLocaleString('en-US')}`, pad, base);
  if (info.score != null) {
    const stars = Math.round(info.score / 20);
    ctx.font = `${m * 0.045}px ${SERIF}`;
    ctx.fillStyle = '#ff8a6a';
    ctx.fillText('★'.repeat(stars), pad + m * 0.32, base);
    ctx.fillStyle = 'rgba(247,239,226,0.35)';
    ctx.fillText('★'.repeat(5 - stars), pad + m * 0.32 + ctx.measureText('★'.repeat(stars)).width, base);
    ctx.fillStyle = PAPER;
  }
  ctx.textAlign = 'right';
  mono(ctx, info.url.toUpperCase(), W - pad, base, m * 0.02);
}

function mono(ctx, text, x, y, size) {
  ctx.font = `500 ${size}px ${MONO}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.08}px`;
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}
