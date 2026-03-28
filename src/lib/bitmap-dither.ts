/**
 * bitmap-dither.ts — Floyd-Steinberg dithering and ESC/POS command builders.
 *
 * Portable TypeScript module that works in both browser (ImageData from Canvas)
 * and can be adapted for Node.js (pngjs).  Extracted and generalised from the
 * Electron printer-service.js `_buildEscStarImage` implementation.
 */

// ---------------------------------------------------------------------------
// Floyd-Steinberg Dithering
// ---------------------------------------------------------------------------

/**
 * Convert RGBA ImageData to a monochrome (0 or 255) Uint8Array.
 * Uses Floyd-Steinberg error-diffusion dithering with an optional contrast
 * boost for sharper text on thermal printers.
 *
 * @returns One byte per pixel (0 = black, 255 = white).
 */
export function ditherToMonochrome(
  imageData: ImageData,
  contrastGain = 1.3,
): Uint8Array {
  const { width, height, data } = imageData;
  const size = width * height;

  // Step 1: RGBA → grayscale float buffer (transparent = white)
  const gray = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const idx = i << 2;
    const a = data[idx + 3];
    if (a <= 126) {
      gray[i] = 255; // transparent → white
    } else {
      gray[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
    }
  }

  // Step 2: Contrast boost — push near-black toward 0, near-white toward 255
  for (let i = 0; i < size; i++) {
    gray[i] = Math.max(0, Math.min(255, (gray[i] - 128) * contrastGain + 128));
  }

  // Step 3: Floyd-Steinberg error-diffusion dithering (in-place)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x;
      const oldVal = gray[pos];
      const newVal = oldVal < 128 ? 0 : 255;
      gray[pos] = newVal;
      const err = oldVal - newVal;

      if (x + 1 < width) gray[pos + 1] += (err * 7) / 16;
      if (y + 1 < height && x > 0) gray[pos + width - 1] += (err * 3) / 16;
      if (y + 1 < height) gray[pos + width] += (err * 5) / 16;
      if (y + 1 < height && x + 1 < width) gray[pos + width + 1] += (err * 1) / 16;
    }
  }

  // Convert to Uint8Array
  const mono = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    mono[i] = gray[i] < 128 ? 0 : 255;
  }
  return mono;
}

// ---------------------------------------------------------------------------
// ESC * (column-stripe) — maximum compatibility
// ---------------------------------------------------------------------------

/**
 * Build ESC * 24-dot double-density column-stripe image commands.
 * Compatible with 99% of thermal printer clones.
 *
 * @param mono  One byte per pixel (0 = black, 255 = white)
 * @param width  Image width in pixels
 * @param height Image height in pixels
 */
export function buildEscStarCommands(
  mono: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const bytes: number[] = [];
  bytes.push(0x1b, 0x33, 24); // ESC 3 24 — set line spacing to 24 dots

  const m = 33; // 24-dot double-density
  const nL = width & 0xff;
  const nH = (width >> 8) & 0xff;

  for (let y = 0; y < height; y += 24) {
    bytes.push(0x1b, 0x2a, m, nL, nH); // ESC * m nL nH
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 3; k++) {
        let sliceByte = 0;
        for (let b = 0; b < 8; b++) {
          const pixelY = y + k * 8 + b;
          if (pixelY < height && mono[pixelY * width + x] < 128) {
            sliceByte |= 1 << (7 - b);
          }
        }
        bytes.push(sliceByte);
      }
    }
    bytes.push(0x0a); // LF
  }

  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// GS v 0 (raster bit image) — faster transfer for modern printers
// ---------------------------------------------------------------------------

/**
 * Build GS v 0 raster bit image command.
 * Sends the entire image in one block — significantly faster than ESC *
 * column-stripe format.
 *
 * @param mono  One byte per pixel (0 = black, 255 = white)
 * @param width  Image width in pixels
 * @param height Image height in pixels
 */
export function buildGsV0Commands(
  mono: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  // GS v 0 requires width in bytes (8 pixels per byte)
  const bytesPerRow = Math.ceil(width / 8);
  const totalBytes = bytesPerRow * height;

  // Pack mono pixels into bit-packed rows (MSB first, 1 = black, 0 = white)
  const raster = new Uint8Array(totalBytes);
  for (let y = 0; y < height; y++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < width && mono[y * width + x] < 128) {
          byte |= 1 << (7 - bit);
        }
      }
      raster[y * bytesPerRow + byteIdx] = byte;
    }
  }

  // Command header: GS v 0 m xL xH yL yH [data]
  //   m = 0 (normal density)
  //   xL xH = bytes per row (little-endian)
  //   yL yH = number of rows (little-endian)
  const header = new Uint8Array([
    0x1d,
    0x76,
    0x30,
    0x00, // GS v 0, m=0 (normal)
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ]);

  const result = new Uint8Array(header.length + raster.length);
  result.set(header, 0);
  result.set(raster, header.length);
  return result;
}

// ---------------------------------------------------------------------------
// Native QR Code ESC/POS Command (GS ( k)
// ---------------------------------------------------------------------------

/**
 * Build a native ESC/POS QR code command sequence.
 * The printer generates the QR code internally — fastest and sharpest output.
 *
 * @param data  The QR code payload string (e.g. ZATCA TLV base64)
 * @param moduleSize  Dot size per QR module (1-16, default 5)
 * @param ecLevel  Error correction level (default "M")
 */
export function buildNativeQRCommand(
  data: string,
  moduleSize = 5,
  ecLevel: "L" | "M" | "Q" | "H" = "M",
): Uint8Array {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const dataLen = dataBytes.length + 3; // +3 for function bytes (fn, m, d-header)
  const pL = dataLen & 0xff;
  const pH = (dataLen >> 8) & 0xff;

  const ecMap: Record<string, number> = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 };

  const parts: Uint8Array[] = [
    // 1. Select QR model — Model 2
    new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // 2. Set module size
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]),
    // 3. Set error correction level
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecMap[ecLevel]]),
    // 4. Store QR data: GS ( k pL pH 31 50 30 [data]
    new Uint8Array([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    dataBytes,
    // 5. Print stored QR code
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ];

  // Calculate total length
  let totalLen = 0;
  for (const p of parts) totalLen += p.length;

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Full bitmap receipt buffer builder (for direct use in renderer)
// ---------------------------------------------------------------------------

export interface BitmapReceiptBufferOptions {
  /** Send QR code as native ESC/POS command after the image. */
  qrCodeText?: string | null;
  /** QR module size in dots (default 5). */
  qrModuleSize?: number;
  /** Use GS v 0 raster format instead of ESC * column-stripe (default false). */
  useGsV0?: boolean;
  /** Append partial paper cut command (default true). */
  cutPaper?: boolean;
  /** Append cash drawer pulse (default false). */
  openDrawer?: boolean;
}

/**
 * Build a complete ESC/POS buffer from Canvas ImageData.
 * Dithers the image, appends optional native QR, cut, and drawer commands.
 */
export function buildBitmapReceiptEscPos(
  imageData: ImageData,
  options?: BitmapReceiptBufferOptions,
): Uint8Array {
  const { width, height } = imageData;
  const mono = ditherToMonochrome(imageData);

  const parts: Uint8Array[] = [];

  // Init + center align
  parts.push(new Uint8Array([0x1b, 0x40])); // ESC @
  parts.push(new Uint8Array([0x1b, 0x61, 0x01])); // ESC a 1 (center)

  // Image data
  if (options?.useGsV0) {
    parts.push(buildGsV0Commands(mono, width, height));
  } else {
    parts.push(buildEscStarCommands(mono, width, height));
  }

  // Native QR code
  if (options?.qrCodeText) {
    parts.push(new Uint8Array([0x1b, 0x61, 0x01])); // Ensure center align
    parts.push(buildNativeQRCommand(options.qrCodeText, options.qrModuleSize ?? 5));
    parts.push(new Uint8Array([0x0a])); // LF after QR
  }

  // Paper cut
  if (options?.cutPaper !== false) {
    parts.push(new Uint8Array([0x1b, 0x64, 0x03])); // Feed 3 lines
    parts.push(new Uint8Array([0x1d, 0x56, 0x42, 0x00])); // GS V B 0 (partial cut)
  }

  // Cash drawer
  if (options?.openDrawer) {
    parts.push(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa])); // ESC p pulse
  }

  // Concat
  let totalLen = 0;
  for (const p of parts) totalLen += p.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}
