import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import { logger } from '../../config/logger';

// Render every page of a PDF buffer to PNG buffers using pdfjs-dist + @napi-rs/canvas
async function pdfToImages(buffer: Buffer): Promise<Buffer[]> {
  // pdfjs-dist must be loaded as CJS in tsx environment
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist');

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false }).promise;
  const images: Buffer[] = [];
  const SCALE = 2.5; // higher = better OCR accuracy, slower

  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');

    // Fill white background (pdfjs renders transparent by default)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    images.push(canvas.toBuffer('image/png'));
  }
  return images;
}

export async function ocrPdf(buffer: Buffer): Promise<string> {
  logger.info('[ocr] starting OCR on scanned PDF');
  const images = await pdfToImages(buffer);
  if (!images.length) return '';

  const worker = await createWorker('eng', 1, {
    // suppress verbose tesseract logs
    logger: () => {},
  });

  const parts: string[] = [];
  for (const img of images) {
    const { data: { text } } = await worker.recognize(img);
    parts.push(text);
  }
  await worker.terminate();

  const combined = parts.join('\n');
  logger.info(`[ocr] extracted ${combined.length} chars from ${images.length} page(s)`);
  return combined;
}
