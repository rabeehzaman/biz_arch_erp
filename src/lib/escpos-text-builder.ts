/**
 * escpos-text-builder.ts — Portable ESC/POS text command builder.
 *
 * Works in browser / Capacitor WebView (no Node.js dependencies).
 * Mirrors the node-thermal-printer API used by electron/printer-service.js
 * but outputs Uint8Array instead of Node.js Buffer.
 */

import { buildNativeQRCommand } from "@/lib/bitmap-dither";

// ---------------------------------------------------------------------------
// CP437 box-drawing character map (Unicode → CP437 byte)
// ---------------------------------------------------------------------------

const CP437_MAP: Record<string, number> = {
  "═": 0xcd,
  "╔": 0xc9,
  "╗": 0xbb,
  "╚": 0xc8,
  "╝": 0xbc,
  "║": 0xba,
  "─": 0xc4,
  "│": 0xb3,
  "┌": 0xda,
  "┐": 0xbf,
  "└": 0xc0,
  "┘": 0xd9,
  "├": 0xc3,
  "┤": 0xb4,
  "┬": 0xc2,
  "┴": 0xc1,
  "┼": 0xc5,
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface TableColumn {
  text: string;
  align: "LEFT" | "CENTER" | "RIGHT";
  width: number; // fraction 0–1
}

export class EscPosTextBuilder {
  private chunks: Uint8Array[] = [];
  private paperWidth: number;

  constructor(paperWidth: 48 | 32 = 48) {
    this.paperWidth = paperWidth;
  }

  // ── Core commands ────────────────────────────────────────────

  init(): this {
    // ESC @ (initialize) + ESC t 0 (select CP437 code page)
    this.raw([0x1b, 0x40, 0x1b, 0x74, 0x00]);
    return this;
  }

  alignLeft(): this {
    this.raw([0x1b, 0x61, 0x00]);
    return this;
  }

  alignCenter(): this {
    this.raw([0x1b, 0x61, 0x01]);
    return this;
  }

  alignRight(): this {
    this.raw([0x1b, 0x61, 0x02]);
    return this;
  }

  bold(on: boolean): this {
    this.raw([0x1b, 0x45, on ? 0x01 : 0x00]);
    return this;
  }

  doubleHeight(on: boolean): this {
    // ESC ! n — bit 4 = double height
    this.raw([0x1b, 0x21, on ? 0x10 : 0x00]);
    return this;
  }

  doubleSize(on: boolean): this {
    // ESC ! n — bit 4 = double height, bit 5 = double width (both = 4x size)
    this.raw([0x1b, 0x21, on ? 0x30 : 0x00]);
    return this;
  }

  inverseColors(on: boolean): this {
    // GS B n — 1 = white-on-black, 0 = normal
    this.raw([0x1d, 0x42, on ? 0x01 : 0x00]);
    return this;
  }

  underline(on: boolean): this {
    // ESC - n — 1 = underline on, 0 = off
    this.raw([0x1b, 0x2d, on ? 0x01 : 0x00]);
    return this;
  }

  setNormal(): this {
    this.raw([0x1b, 0x21, 0x00]);
    return this;
  }

  newLine(): this {
    this.raw([0x0a]);
    return this;
  }

  // ── Text output ──────────────────────────────────────────────

  println(text: string): this {
    this.appendText(text);
    this.raw([0x0a]);
    return this;
  }

  leftRight(left: string, right: string): this {
    const gap = this.paperWidth - left.length - right.length;
    if (gap > 0) {
      this.println(left + " ".repeat(gap) + right);
    } else {
      // If too long, truncate left side
      const maxLeft = this.paperWidth - right.length - 1;
      this.println(left.substring(0, maxLeft) + " " + right);
    }
    return this;
  }

  drawLine(char = "-"): this {
    this.println(char.repeat(this.paperWidth));
    return this;
  }

  tableCustom(cols: TableColumn[]): this {
    let line = "";
    for (const col of cols) {
      const colWidth = Math.max(1, Math.floor(this.paperWidth * col.width));
      const text = col.text.substring(0, colWidth);
      const pad = colWidth - text.length;

      if (col.align === "RIGHT") {
        line += " ".repeat(pad) + text;
      } else if (col.align === "CENTER") {
        const left = Math.floor(pad / 2);
        const right = pad - left;
        line += " ".repeat(left) + text + " ".repeat(right);
      } else {
        line += text + " ".repeat(pad);
      }
    }
    this.println(line);
    return this;
  }

  // ── Box-drawing helpers ──────────────────────────────────────

  printDoubleLine(): this {
    // ═ repeated across paper width
    const byte = CP437_MAP["═"];
    const bytes = new Uint8Array(this.paperWidth + 1);
    bytes.fill(byte, 0, this.paperWidth);
    bytes[this.paperWidth] = 0x0a; // LF
    this.chunks.push(bytes);
    return this;
  }

  printBoxFrame(label: string): this {
    const inner = label.length + 2;
    const pad = Math.max(0, Math.floor((this.paperWidth - inner - 2) / 2));
    const sp = " ".repeat(pad);

    // Top: ╔═══╗
    const topLine = new Uint8Array(this.paperWidth + 1);
    topLine.fill(0x20, 0, this.paperWidth); // spaces
    let pos = pad;
    topLine[pos++] = CP437_MAP["╔"];
    for (let i = 0; i < inner; i++) topLine[pos++] = CP437_MAP["═"];
    topLine[pos++] = CP437_MAP["╗"];
    topLine[this.paperWidth] = 0x0a;
    this.alignCenter();
    this.chunks.push(topLine);

    // Mid: ║ LABEL ║
    const midLine = new Uint8Array(this.paperWidth + 1);
    midLine.fill(0x20, 0, this.paperWidth);
    pos = pad;
    midLine[pos++] = CP437_MAP["║"];
    midLine[pos++] = 0x20; // space
    const encoder = new TextEncoder();
    const labelBytes = encoder.encode(label);
    for (let i = 0; i < labelBytes.length; i++) midLine[pos++] = labelBytes[i];
    midLine[pos++] = 0x20; // space
    midLine[pos++] = CP437_MAP["║"];
    midLine[this.paperWidth] = 0x0a;
    this.chunks.push(midLine);

    // Bottom: ╚═══╝
    const botLine = new Uint8Array(this.paperWidth + 1);
    botLine.fill(0x20, 0, this.paperWidth);
    pos = pad;
    botLine[pos++] = CP437_MAP["╚"];
    for (let i = 0; i < inner; i++) botLine[pos++] = CP437_MAP["═"];
    botLine[pos++] = CP437_MAP["╝"];
    botLine[this.paperWidth] = 0x0a;
    this.chunks.push(botLine);

    return this;
  }

  // ── Printer control ──────────────────────────────────────────

  partialCut(): this {
    // Feed 3 lines + partial cut
    this.raw([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x42, 0x00]);
    return this;
  }

  openCashDrawer(): this {
    this.raw([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    return this;
  }

  printQR(data: string, moduleSize = 5): this {
    const qrCmd = buildNativeQRCommand(data, moduleSize);
    this.chunks.push(qrCmd);
    return this;
  }

  // ── Output ───────────────────────────────────────────────────

  toUint8Array(): Uint8Array {
    let totalLength = 0;
    for (const chunk of this.chunks) totalLength += chunk.length;

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  toBase64(): string {
    const bytes = this.toUint8Array();
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ── Internal helpers ─────────────────────────────────────────

  private raw(bytes: number[]): void {
    this.chunks.push(new Uint8Array(bytes));
  }

  private appendText(text: string): void {
    // Encode text, mapping box-drawing chars to CP437 bytes
    const result: number[] = [];
    for (const char of text) {
      if (CP437_MAP[char] !== undefined) {
        result.push(CP437_MAP[char]);
      } else {
        const code = char.charCodeAt(0);
        // ASCII printable range + common chars
        result.push(code <= 0x7f ? code : 0x3f); // '?' for unsupported
      }
    }
    this.chunks.push(new Uint8Array(result));
  }
}
