// printer-service.js — ESC/POS printer service (Network TCP + Windows spooler RAW + Raw USB)
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
} = require('node-thermal-printer');
const { PNG } = require('pngjs');
const iconv = require('iconv-lite');
const { printRawToWindowsPrinter, testWindowsPrinter } = require('./winspool-raw');

const RECEIPT_RENDER_MODES = ['htmlDriver', 'htmlRaster', 'escposText'];
const ARABIC_CODE_PAGES = {
  pc864: {
    escposByte: 0x25,
    iconvEncoding: 'cp864',
  },
  wpc1256: {
    escposByte: 0x32,
    iconvEncoding: 'win1256',
  },
};

function parseUsbId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const normalized = raw.startsWith('0x') ? raw.slice(2) : raw;
  const radix = /[a-f]/.test(normalized) ? 16 : 10;
  const parsed = Number.parseInt(normalized, radix);
  return Number.isFinite(parsed) ? parsed : null;
}

class PrinterService {
  constructor(config = {}) {
    const normalized = PrinterService.normalizeConfig(config);

    this.mode = normalized.connectionType;
    this.receiptRenderMode = normalized.receiptRenderMode;
    this.arabicCodePage = normalized.arabicCodePage;
    this.networkIP = normalized.networkIP;
    this.networkPort = normalized.networkPort;
    this.windowsPrinterName = normalized.windowsPrinterName;
    this.usbVendorId = normalized.usbVendorId;
    this.usbProductId = normalized.usbProductId;
    this.usbSerialNumber = normalized.usbSerialNumber;
  }

  static normalizeConfig(config = {}) {
    const rawConnectionType = config.connectionType === 'usb'
      ? 'windows'
      : config.connectionType;
    const connectionType = ['network', 'windows', 'rawUsb'].includes(rawConnectionType)
      ? rawConnectionType
      : 'windows';
    const receiptRenderMode = RECEIPT_RENDER_MODES.includes(config.receiptRenderMode)
      ? config.receiptRenderMode
      : connectionType === 'windows'
        ? 'htmlDriver'
        : 'escposText';

    return {
      connectionType,
      receiptRenderMode,
      arabicCodePage: config.arabicCodePage === 'wpc1256' ? 'wpc1256' : 'pc864',
      networkIP: String(config.networkIP || '').trim(),
      networkPort: Number.parseInt(String(config.networkPort || ''), 10) || 9100,
      windowsPrinterName: String(
        config.windowsPrinterName || config.usbPrinterName || ''
      ).trim(),
      usbVendorId: parseUsbId(config.usbVendorId),
      usbProductId: parseUsbId(config.usbProductId),
      usbSerialNumber: String(config.usbSerialNumber || '').trim(),
      receiptMarginLeft: config.receiptMarginLeft != null ? Number(config.receiptMarginLeft) : 3,
      receiptMarginRight: config.receiptMarginRight != null ? Number(config.receiptMarginRight) : 5,
    };
  }

  static formatUsbId(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '0000';
    }
    return value.toString(16).toUpperCase().padStart(4, '0');
  }

  static loadUsbAdapter() {
    try {
      return require('@node-escpos/usb-adapter');
    } catch (error) {
      throw new Error(
        `Raw USB support is not available. Install Electron dependencies first. ${error.message}`
      );
    }
  }

  static getErrorMessage(error) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error || 'Unknown error');
  }

  static createBufferPrinter() {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: path.join(os.tmpdir(), 'bizarch-escpos-buffer.bin'),
      characterSet: CharacterSet.PC437_USA,
      width: 48, // 48 chars for 80mm / 3-inch paper
      removeSpecialCharacters: false,
      options: { timeout: 5000 },
    });
  }

  static getArabicCodePageConfig(codePage = 'pc864') {
    return ARABIC_CODE_PAGES[codePage] || ARABIC_CODE_PAGES.pc864;
  }

  buildReceiptBuffer(data) {
    const printer = PrinterService.createBufferPrinter();
    printer.initHardware();

    // Header
    printer.alignCenter();
    if (data.header) {
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.println(data.header.storeName || 'STORE');
      printer.setTextNormal();
      printer.bold(false);

      const arabicStoreName = data.header.storeNameAr || data.header.arabicName;
      if (arabicStoreName) {
        this._appendArabicLine(printer, arabicStoreName, 'center');
      }

      if (data.header.address) printer.println(data.header.address);
      if (data.header.phone) printer.println(`Tel: ${data.header.phone}`);
      if (data.header.vatNumber) printer.println(`VAT: ${data.header.vatNumber}`);
    }
    printer.drawLine();

    // Invoice info
    if (data.invoiceNo) {
      printer.alignLeft();
      printer.println(`Invoice: ${data.invoiceNo}`);
    }
    if (data.date) {
      printer.println(`Date: ${data.date}`);
    }
    if (data.cashier) {
      printer.println(`Cashier: ${data.cashier}`);
    }
    if (data.customerName) {
      printer.println(`Customer: ${data.customerName}`);
    }
    printer.drawLine();

    // Column headers
    printer.bold(true);
    printer.tableCustom([
      { text: 'Item', align: 'LEFT', width: 0.45 },
      { text: 'Qty', align: 'CENTER', width: 0.15 },
      { text: 'Price', align: 'RIGHT', width: 0.2 },
      { text: 'Total', align: 'RIGHT', width: 0.2 },
    ]);
    printer.bold(false);
    printer.drawLine();

    // Line items
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        const lineTotal = (
          item.total !== undefined
            ? item.total
            : ((item.qty || 1) * (item.price || 0))
        ).toFixed(2);

        printer.tableCustom([
          { text: item.name || '', align: 'LEFT', width: 0.45 },
          { text: String(item.qty || 1), align: 'CENTER', width: 0.15 },
          { text: (item.price || 0).toFixed(2), align: 'RIGHT', width: 0.2 },
          { text: lineTotal, align: 'RIGHT', width: 0.2 },
        ]);

        if (item.nameAr) {
          this._appendArabicLine(printer, `  ${item.nameAr}`, 'right');
        }
      }
    }

    // Totals
    printer.drawLine();
    if (data.totals) {
      if (data.totals.subtotal !== undefined) {
        printer.leftRight('Subtotal:', data.totals.subtotal.toFixed(2));
      }
      if (data.totals.discount) {
        printer.leftRight('Discount:', `-${data.totals.discount.toFixed(2)}`);
      }
      if (data.totals.tax !== undefined) {
        const taxLabel = data.taxLabel || 'Tax';
        printer.leftRight(`${taxLabel}:`, data.totals.tax.toFixed(2));
      }
      printer.drawLine();
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.leftRight('TOTAL:', (data.totals.total || 0).toFixed(2));
      printer.setTextNormal();
      printer.bold(false);
    }

    // Payment info
    if (data.payment) {
      printer.drawLine();
      if (Array.isArray(data.payment)) {
        for (const p of data.payment) {
          printer.leftRight(`${p.method}:`, p.amount.toFixed(2));
        }
      } else {
        printer.leftRight('Payment:', data.payment.method || 'Cash');
        if (data.payment.amount) {
          printer.leftRight('Paid:', data.payment.amount.toFixed(2));
        }
      }
      if (data.change) {
        printer.leftRight('Change:', data.change.toFixed(2));
      }
    }

    printer.drawLine();

    // Barcode
    if (data.barcode) {
      printer.alignCenter();
      printer.newLine();
      printer.code128(data.barcode, {
        width: 'MEDIUM',
        height: 60,
        text: 2,
      });
      printer.newLine();
    }

    // QR Code
    const qrValue =
      typeof data.qrcode === 'string' && !data.qrcode.startsWith('data:')
        ? data.qrcode
        : typeof data.qrCodeText === 'string'
          ? data.qrCodeText
          : null;

    if (qrValue) {
      printer.alignCenter();
      printer.printQR(qrValue, {
        cellSize: 4,
        correction: 'M',
        model: 2,
      });
      printer.newLine();
    }

    // Footer
    printer.alignCenter();
    if (data.footer) {
      printer.println(data.footer);
    }
    if (data.footerAr) {
      this._appendArabicLine(printer, data.footerAr, 'center');
    }
    printer.newLine();
    printer.newLine();

    if (data.cutPaper !== false) {
      printer.partialCut();
    }

    if (data.openDrawer) {
      printer.openCashDrawer();
    }

    return Buffer.from(printer.getBuffer());
  }

  buildCashDrawerBuffer() {
    const printer = PrinterService.createBufferPrinter();
    printer.openCashDrawer();
    return Buffer.from(printer.getBuffer());
  }

  async buildImageReceiptBuffer(
    imageBuffers,
    { cutPaper = true, openDrawer = false } = {}
  ) {
    if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
      throw new Error('No raster receipt image was generated');
    }

    const payload = [];
    payload.push(Buffer.from([0x1B, 0x40])); // ESC @ (Init)
    payload.push(Buffer.from([0x1B, 0x61, 0x01])); // ESC a 1 (Align Center)

    for (const imageBuffer of imageBuffers) {
      if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
        continue;
      }
      payload.push(this._buildEscStarImage(imageBuffer));
    }

    if (cutPaper) {
      payload.push(Buffer.from([0x1B, 0x64, 0x03])); // ESC d 3 (feed 3 lines)
      payload.push(Buffer.from([0x1D, 0x56, 0x42, 0x00])); // GS V B 0 (partial cut)
    }

    if (openDrawer) {
      payload.push(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])); // ESC p (pulse drawer)
    }

    return Buffer.concat(payload);
  }

  // Uses ESC * standard generic image printing compatible with 99% of clones (e.g. EZPOS)
  // Applies Floyd-Steinberg dithering for dramatically better text and image quality
  _buildEscStarImage(pngBuffer) {
    const png = PNG.sync.read(pngBuffer);
    const width = png.width;
    const height = png.height;
    const data = png.data;

    // Step 1: Convert RGBA → grayscale float buffer (transparent = white)
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i << 2;
      const a = data[idx + 3];
      if (a <= 126) {
        gray[i] = 255; // transparent → white
      } else {
        gray[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
      }
    }

    // Step 2: Floyd-Steinberg error-diffusion dithering (in-place)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        const oldVal = gray[pos];
        const newVal = oldVal < 128 ? 0 : 255;
        gray[pos] = newVal;
        const err = oldVal - newVal;

        if (x + 1 < width)                         gray[pos + 1]         += err * 7 / 16;
        if (y + 1 < height && x > 0)               gray[pos + width - 1] += err * 3 / 16;
        if (y + 1 < height)                         gray[pos + width]     += err * 5 / 16;
        if (y + 1 < height && x + 1 < width)       gray[pos + width + 1] += err * 1 / 16;
      }
    }

    // Step 3: Build ESC * column-stripe output from dithered 1-bit result
    let bytes = [];
    bytes.push(0x1B, 0x33, 24); // ESC 3 24 (set line spacing to 24 dots)

    const m = 33; // 24-dot double-density
    const nL = width & 0xFF;
    const nH = (width >> 8) & 0xFF;

    for (let y = 0; y < height; y += 24) {
      bytes.push(0x1B, 0x2A, m, nL, nH); // ESC * m nL nH
      for (let x = 0; x < width; x++) {
        for (let k = 0; k < 3; k++) {
          let sliceByte = 0;
          for (let b = 0; b < 8; b++) {
            const pixelY = y + k * 8 + b;
            if (pixelY < height && gray[pixelY * width + x] < 128) {
              sliceByte |= (1 << (7 - b));
            }
          }
          bytes.push(sliceByte);
        }
      }
      bytes.push(0x0A); // LF (print and line feed)
    }

    return Buffer.from(bytes);
  }

  async testConnection() {
    switch (this.mode) {
      case 'network':
        return PrinterService.testNetworkConnection(this.networkIP, this.networkPort);
      case 'windows':
        return testWindowsPrinter(this.windowsPrinterName);
      case 'rawUsb':
        return PrinterService.testRawUsbConnection(this);
      default:
        throw new Error(`Unsupported printer connection type: ${this.mode}`);
    }
  }

  async printReceipt(data) {
    const buffer = this.buildReceiptBuffer(data);
    await this.sendBuffer(buffer, 'BizArch Receipt');
  }

  async printRasterizedReceipt(imageBuffers, options = {}) {
    const buffer = await this.buildImageReceiptBuffer(imageBuffers, options);
    await this.sendBuffer(buffer, 'BizArch Receipt');
  }

  async openCashDrawer() {
    const buffer = this.buildCashDrawerBuffer();
    await this.sendBuffer(buffer, 'BizArch Cash Drawer');
  }

  async sendBuffer(buffer, jobName) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Nothing to send to printer');
    }

    switch (this.mode) {
      case 'network':
        if (!this.networkIP) {
          throw new Error('Enter the network printer IP address first');
        }
        await PrinterService.sendRawTCP(this.networkIP, this.networkPort, buffer);
        return;
      case 'windows':
        await printRawToWindowsPrinter(this.windowsPrinterName, buffer, jobName);
        return;
      case 'rawUsb':
        await PrinterService.sendRawUsb(this, buffer);
        return;
      default:
        throw new Error(`Unsupported printer connection type: ${this.mode}`);
    }
  }

  _appendArabicLine(printer, text, align = 'right') {
    const buffer = printer.getBuffer();
    const ESC = 0x1b;
    const arabicCodePage = PrinterService.getArabicCodePageConfig(this.arabicCodePage);

    const alignByte =
      align === 'center' ? 0x01 : align === 'right' ? 0x02 : 0x00;
    const alignCmd = Buffer.from([ESC, 0x61, alignByte]);
    const codepageCmd = Buffer.from([ESC, 0x74, arabicCodePage.escposByte]);
    const encoded = iconv.encode(text, arabicCodePage.iconvEncoding);
    const LF = Buffer.from([0x0a]);
    const resetCmd = Buffer.from([ESC, 0x74, 0x00]); // Reset to PC437

    const combined = Buffer.concat([
      alignCmd,
      codepageCmd,
      encoded,
      LF,
      resetCmd,
    ]);
    printer.setBuffer(Buffer.concat([buffer, combined]));
  }

  static async listRawUsbPrinters() {
    const USBAdapter = PrinterService.loadUsbAdapter();
    const devices = USBAdapter.findPrinter();

    return Promise.all(
      devices.map(async (device) => {
        const descriptor = device.deviceDescriptor || {};
        const vendorId = descriptor.idVendor ?? null;
        const productId = descriptor.idProduct ?? null;
        const manufacturer = await PrinterService.readUsbStringDescriptor(
          device,
          descriptor.iManufacturer
        );
        const product = await PrinterService.readUsbStringDescriptor(
          device,
          descriptor.iProduct
        );
        const serialNumber = await PrinterService.readUsbStringDescriptor(
          device,
          descriptor.iSerialNumber
        );

        const vendorHex = PrinterService.formatUsbId(vendorId);
        const productHex = PrinterService.formatUsbId(productId);

        return {
          id: `${vendorHex}:${productHex}:${serialNumber || 'auto'}`,
          vendorId,
          productId,
          serialNumber,
          manufacturer,
          product,
          displayName: [
            product || manufacturer || 'USB Printer',
            `${vendorHex}:${productHex}`,
            serialNumber ? `SN ${serialNumber}` : null,
          ]
            .filter(Boolean)
            .join(' • '),
        };
      })
    );
  }

  static async readUsbStringDescriptor(device, descriptorIndex) {
    if (!descriptorIndex || typeof device?.getStringDescriptor !== 'function') {
      return '';
    }

    let opened = false;

    try {
      device.open();
      opened = true;
    } catch (_error) {
      return '';
    }

    try {
      return await new Promise((resolve) => {
        device.getStringDescriptor(descriptorIndex, (error, value) => {
          resolve(error ? '' : String(value || ''));
        });
      });
    } finally {
      if (opened) {
        try {
          device.close();
        } catch (_error) {
          // Ignore close errors from devices already detached or claimed elsewhere.
        }
      }
    }
  }

  static async resolveRawUsbDevice(config) {
    const USBAdapter = PrinterService.loadUsbAdapter();
    const vendorId = parseUsbId(config.usbVendorId);
    const productId = parseUsbId(config.usbProductId);

    if (vendorId === null || productId === null) {
      throw new Error('Select a raw USB printer first');
    }

    const devices = USBAdapter.findPrinter().filter((device) => {
      const descriptor = device.deviceDescriptor || {};
      return descriptor.idVendor === vendorId && descriptor.idProduct === productId;
    });

    if (devices.length === 0) {
      const vendorHex = PrinterService.formatUsbId(vendorId);
      const productHex = PrinterService.formatUsbId(productId);
      throw new Error(`Raw USB printer ${vendorHex}:${productHex} was not found`);
    }

    if (config.usbSerialNumber) {
      for (const device of devices) {
        const serialNumber = await PrinterService.readUsbStringDescriptor(
          device,
          device.deviceDescriptor?.iSerialNumber
        );
        if (serialNumber === config.usbSerialNumber) {
          return device;
        }
      }

      throw new Error(
        `Raw USB printer was found by VID/PID but serial ${config.usbSerialNumber} did not match`
      );
    }

    return devices[0];
  }

  static async testRawUsbConnection(config) {
    const USBAdapter = PrinterService.loadUsbAdapter();
    const device = await PrinterService.resolveRawUsbDevice(config);
    const adapter = new USBAdapter(device);

    await PrinterService.openUsbAdapter(adapter);
    await PrinterService.closeUsbAdapter(adapter);
    return true;
  }

  static async sendRawUsb(config, buffer) {
    const USBAdapter = PrinterService.loadUsbAdapter();
    const device = await PrinterService.resolveRawUsbDevice(config);
    const adapter = new USBAdapter(device);

    await PrinterService.openUsbAdapter(adapter);
    try {
      await PrinterService.writeUsbAdapter(adapter, buffer);
    } finally {
      await PrinterService.closeUsbAdapter(adapter);
    }
  }

  static openUsbAdapter(adapter) {
    return new Promise((resolve, reject) => {
      adapter.open((error) => {
        if (error) {
          reject(
            new Error(
              `Failed to open raw USB printer. On Windows this usually means the device is still using the vendor print driver instead of a libusb/WinUSB driver. ${PrinterService.getErrorMessage(error)}`
            )
          );
          return;
        }
        resolve();
      });
    });
  }

  static writeUsbAdapter(adapter, buffer) {
    return new Promise((resolve, reject) => {
      adapter.write(buffer, (error) => {
        if (error) {
          reject(new Error(`Raw USB write failed: ${PrinterService.getErrorMessage(error)}`));
          return;
        }
        resolve();
      });
    });
  }

  static closeUsbAdapter(adapter) {
    return new Promise((resolve, reject) => {
      adapter.close((error) => {
        if (error) {
          reject(new Error(`Raw USB close failed: ${PrinterService.getErrorMessage(error)}`));
          return;
        }
        resolve();
      });
    });
  }

  static testNetworkConnection(ip, port) {
    if (!ip) {
      throw new Error('Enter the network printer IP address first');
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(port, ip, () => {
        client.destroy();
        resolve(true);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`TCP timeout connecting to ${ip}:${port}`));
      });

      client.on('error', (err) => {
        client.destroy();
        reject(new Error(`TCP error: ${err.message}`));
      });
    });
  }

  static sendRawTCP(ip, port, buffer) {
    if (!ip) {
      throw new Error('Enter the network printer IP address first');
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(port, ip, () => {
        client.write(buffer, () => {
          client.end();
        });
      });

      client.on('end', () => {
        resolve();
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`TCP timeout connecting to ${ip}:${port}`));
      });

      client.on('error', (err) => {
        client.destroy();
        reject(new Error(`TCP error: ${err.message}`));
      });
    });
  }
}

module.exports = PrinterService;
