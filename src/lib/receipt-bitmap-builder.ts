/**
 * ReceiptBitmapBuilder — Canvas-based receipt layout engine.
 *
 * Draws receipt content directly onto an HTML5 Canvas at the printer's native
 * resolution (576 px = 80 mm @ 203 DPI).  Arabic text is rendered via the
 * platform's ICU text shaping engine (ctx.fillText), giving perfect ligatures
 * that html-to-image / SVG foreignObject cannot match.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BitmapBuilderOptions {
  /** Left margin in pixels (default 17 — ~3 mm @ 203 DPI). */
  marginLeft?: number;
  /** Right margin in pixels (default 28 — ~5 mm @ 203 DPI). */
  marginRight?: number;
  /** Primary Latin font family. */
  fontFamily?: string;
  /** Primary Arabic font family. */
  arabicFontFamily?: string;
}

export interface DrawTextOptions {
  rtl?: boolean;
  color?: string;
  maxWidth?: number;
}

export interface TableColumn {
  text: string;
  /** Fraction of usable width (0–1). */
  widthFraction: number;
  align: "left" | "center" | "right";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MM_TO_PX_203DPI = 576 / 80; // 7.2 px per mm at 203 DPI
const DEFAULT_FONT = "Arial, Helvetica, sans-serif";
const DEFAULT_ARABIC_FONT = "'Noto Sans Arabic', 'Geeza Pro', 'Segoe UI', sans-serif";
const INITIAL_HEIGHT = 4000; // Start tall, trim at the end

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX_203DPI);
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function getContext(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Failed to get 2D canvas context");
  return ctx;
}

// ---------------------------------------------------------------------------
// ReceiptBitmapBuilder
// ---------------------------------------------------------------------------

export class ReceiptBitmapBuilder {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private _y: number;
  private readonly _width: number;
  private readonly _marginLeft: number;
  private readonly _marginRight: number;
  private readonly _fontFamily: string;
  private readonly _arabicFontFamily: string;

  constructor(widthPx: number, options?: BitmapBuilderOptions) {
    this._width = widthPx;
    this._marginLeft = options?.marginLeft ?? mmToPx(3);
    this._marginRight = options?.marginRight ?? mmToPx(5);
    this._fontFamily = options?.fontFamily ?? DEFAULT_FONT;
    this._arabicFontFamily = options?.arabicFontFamily ?? DEFAULT_ARABIC_FONT;
    this._y = 8; // small top padding

    this.canvas = createCanvas(widthPx, INITIAL_HEIGHT);
    this.ctx = getContext(this.canvas);

    // Fill white background
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, widthPx, INITIAL_HEIGHT);

    // Defaults
    this.ctx.fillStyle = "#000000";
    this.ctx.textBaseline = "top";
    this.ctx.imageSmoothingEnabled = false;
  }

  // ── Geometry helpers ────────────────────────────────────────────

  /** Usable content width (total minus margins). */
  get contentWidth(): number {
    return this._width - this._marginLeft - this._marginRight;
  }

  /** Left edge of the content area. */
  get contentLeft(): number {
    return this._marginLeft;
  }

  /** Right edge of the content area. */
  get contentRight(): number {
    return this._width - this._marginRight;
  }

  /** Current Y position. */
  get y(): number {
    return this._y;
  }

  /** Total canvas width. */
  get width(): number {
    return this._width;
  }

  // ── Font helpers ────────────────────────────────────────────────

  private _font(size: number, weight: number | string, rtl?: boolean): string {
    const family = rtl ? `${this._arabicFontFamily}, ${this._fontFamily}` : this._fontFamily;
    return `${weight} ${size}px ${family}`;
  }

  // ── Advance ─────────────────────────────────────────────────────

  /** Move the cursor down by `px` pixels. */
  advance(px: number): void {
    this._y += px;
  }

  // ── Text drawing ────────────────────────────────────────────────

  drawCenteredText(
    text: string,
    fontSize: number,
    fontWeight: number | string = 400,
    options?: DrawTextOptions,
  ): void {
    const ctx = this.ctx;
    const rtl = options?.rtl ?? false;
    ctx.save();
    ctx.font = this._font(fontSize, fontWeight, rtl);
    ctx.fillStyle = options?.color ?? "#000000";
    ctx.textAlign = "center";
    if (rtl) ctx.direction = "rtl";

    const cx = this._marginLeft + this.contentWidth / 2;
    ctx.fillText(text, cx, this._y, options?.maxWidth ?? this.contentWidth);
    ctx.restore();

    this._y += Math.ceil(fontSize * 1.5);
  }

  drawLeftText(
    text: string,
    fontSize: number,
    fontWeight: number | string = 400,
    options?: DrawTextOptions,
  ): void {
    const ctx = this.ctx;
    const rtl = options?.rtl ?? false;
    ctx.save();
    ctx.font = this._font(fontSize, fontWeight, rtl);
    ctx.fillStyle = options?.color ?? "#000000";
    ctx.textAlign = rtl ? "right" : "left";
    if (rtl) ctx.direction = "rtl";

    const x = rtl ? this.contentRight : this.contentLeft;
    ctx.fillText(text, x, this._y, options?.maxWidth ?? this.contentWidth);
    ctx.restore();

    this._y += Math.ceil(fontSize * 1.5);
  }

  drawRightText(
    text: string,
    fontSize: number,
    fontWeight: number | string = 400,
    options?: DrawTextOptions,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = this._font(fontSize, fontWeight);
    ctx.fillStyle = options?.color ?? "#000000";
    ctx.textAlign = "right";

    ctx.fillText(text, this.contentRight, this._y, options?.maxWidth ?? this.contentWidth);
    ctx.restore();

    this._y += Math.ceil(fontSize * 1.5);
  }

  /** Draw left-aligned + right-aligned text on the same line. */
  drawLeftRightRow(
    leftText: string,
    rightText: string,
    fontSize: number,
    fontWeight: number | string = 400,
    options?: { leftRtl?: boolean; rightRtl?: boolean; color?: string },
  ): void {
    const ctx = this.ctx;
    const color = options?.color ?? "#000000";

    // Left part
    ctx.save();
    ctx.font = this._font(fontSize, fontWeight, options?.leftRtl);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    if (options?.leftRtl) ctx.direction = "rtl";
    ctx.fillText(leftText, this.contentLeft, this._y, this.contentWidth * 0.65);
    ctx.restore();

    // Right part
    ctx.save();
    ctx.font = this._font(fontSize, fontWeight, options?.rightRtl);
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.fillText(rightText, this.contentRight, this._y, this.contentWidth * 0.45);
    ctx.restore();

    this._y += Math.ceil(fontSize * 1.5);
  }

  /** Draw a multi-column row (e.g. item table). */
  drawTableRow(
    columns: TableColumn[],
    fontSize: number,
    fontWeight: number | string = 400,
    options?: { color?: string; rtl?: boolean },
  ): void {
    const ctx = this.ctx;
    const color = options?.color ?? "#000000";
    let x = this.contentLeft;

    for (const col of columns) {
      const colWidth = this.contentWidth * col.widthFraction;
      ctx.save();
      ctx.font = this._font(fontSize, fontWeight, options?.rtl);
      ctx.fillStyle = color;

      let textX: number;
      if (col.align === "center") {
        ctx.textAlign = "center";
        textX = x + colWidth / 2;
      } else if (col.align === "right") {
        ctx.textAlign = "right";
        textX = x + colWidth;
      } else {
        ctx.textAlign = "left";
        textX = x;
      }

      ctx.fillText(col.text, textX, this._y, colWidth);
      ctx.restore();
      x += colWidth;
    }

    this._y += Math.ceil(fontSize * 1.5);
  }

  // ── Lines / Dividers ────────────────────────────────────────────

  drawSolidLine(color = "#dddddd", thickness = 1): void {
    const ctx = this.ctx;
    this._y += 6;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(this.contentLeft, this._y);
    ctx.lineTo(this.contentRight, this._y);
    ctx.stroke();
    ctx.restore();
    this._y += 6;
  }

  drawDashedLine(color = "#cccccc", thickness = 1): void {
    const ctx = this.ctx;
    this._y += 6;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(this.contentLeft, this._y);
    ctx.lineTo(this.contentRight, this._y);
    ctx.stroke();
    ctx.restore();
    this._y += 6;
  }

  drawDottedLine(color = "#eeeeee", thickness = 1): void {
    const ctx = this.ctx;
    this._y += 4;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(this.contentLeft, this._y);
    ctx.lineTo(this.contentRight, this._y);
    ctx.stroke();
    ctx.restore();
    this._y += 4;
  }

  drawGradientLine(color = "#1a1a2e", thickness = 2): void {
    const ctx = this.ctx;
    this._y += 8;
    ctx.save();
    const gradient = ctx.createLinearGradient(this.contentLeft, 0, this.contentRight, 0);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, "transparent");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(this.contentLeft, this._y);
    ctx.lineTo(this.contentRight, this._y);
    ctx.stroke();
    ctx.restore();
    this._y += 8;
  }

  // ── Rectangles ──────────────────────────────────────────────────

  drawFilledRect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.restore();
  }

  drawRoundedFilledRect(x: number, y: number, w: number, h: number, radius: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Image drawing ───────────────────────────────────────────────

  /**
   * Draw an image (logo, etc.) centered at the current Y position.
   * Accepts a data URL, blob URL, or external URL.
   */
  async drawImage(src: string, maxWidth: number, maxHeight: number): Promise<void> {
    try {
      const img = await this._loadImage(src);
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = this._marginLeft + (this.contentWidth - w) / 2;

      this.ctx.drawImage(img, x, this._y, w, h);
      this._y += h + 6;
    } catch {
      // Silently skip failed images (logo might not be reachable)
    }
  }

  private _loadImage(src: string): Promise<HTMLImageElement | ImageBitmap> {
    // Try ImageBitmap first (works in OffscreenCanvas contexts)
    if (typeof createImageBitmap !== "undefined" && src.startsWith("data:")) {
      return fetch(src)
        .then((r) => r.blob())
        .then((blob) => createImageBitmap(blob));
    }

    // Fallback to HTMLImageElement
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = src;
    });
  }

  // ── Measure text ────────────────────────────────────────────────

  measureText(text: string, fontSize: number, fontWeight: number | string = 400, rtl?: boolean): number {
    this.ctx.save();
    this.ctx.font = this._font(fontSize, fontWeight, rtl);
    const w = this.ctx.measureText(text).width;
    this.ctx.restore();
    return w;
  }

  // ── Output ──────────────────────────────────────────────────────

  /** Return the trimmed canvas ImageData (only the used height). */
  getImageData(): ImageData {
    const trimmedHeight = Math.ceil(this._y) + 16; // small bottom padding
    return this.ctx.getImageData(0, 0, this._width, trimmedHeight);
  }

  /** Return a PNG data URL of the trimmed receipt. */
  toPngDataUrl(): string {
    const trimmedHeight = Math.ceil(this._y) + 16;

    // Create a trimmed canvas
    const trimmed = createCanvas(this._width, trimmedHeight);
    const tCtx = getContext(trimmed);
    tCtx.drawImage(this.canvas, 0, 0);

    if (trimmed instanceof HTMLCanvasElement) {
      return trimmed.toDataURL("image/png");
    }

    // OffscreenCanvas — synchronous path not available, use convertToBlob workaround
    // For the sync case, copy to a regular canvas
    const fallback = document.createElement("canvas");
    fallback.width = this._width;
    fallback.height = trimmedHeight;
    const fbCtx = fallback.getContext("2d")!;
    fbCtx.drawImage(this.canvas, 0, 0);
    return fallback.toDataURL("image/png");
  }

  /** Return a PNG ArrayBuffer of the trimmed receipt (for Electron IPC). */
  async toPngBuffer(): Promise<ArrayBuffer> {
    const trimmedHeight = Math.ceil(this._y) + 16;

    const trimmed = createCanvas(this._width, trimmedHeight);
    const tCtx = getContext(trimmed);
    tCtx.drawImage(this.canvas, 0, 0);

    if (trimmed instanceof OffscreenCanvas) {
      const blob = await trimmed.convertToBlob({ type: "image/png" });
      return blob.arrayBuffer();
    }

    // HTMLCanvasElement fallback
    const dataUrl = (trimmed as HTMLCanvasElement).toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a builder sized for a standard thermal printer (80mm or 58mm). */
export function createReceiptBitmapBuilder(options?: {
  paperWidth?: 58 | 80;
  marginLeft?: number;
  marginRight?: number;
}): ReceiptBitmapBuilder {
  const paper = options?.paperWidth ?? 80;
  const widthPx = paper === 58 ? 384 : 576; // 203 DPI
  const mlPx = mmToPx(options?.marginLeft ?? 3);
  const mrPx = mmToPx(options?.marginRight ?? 5);

  return new ReceiptBitmapBuilder(widthPx, {
    marginLeft: mlPx,
    marginRight: mrPx,
  });
}
