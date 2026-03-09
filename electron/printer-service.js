// printer-service.js — ESC/POS printer service (Network TCP + Windows spooler RAW + Raw USB)
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
} = require('node-thermal-printer');
const iconv = require('iconv-lite');
const { printRawToWindowsPrinter, testWindowsPrinter } = require('./winspool-raw');

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

    return {
      connectionType: ['network', 'windows', 'rawUsb'].includes(rawConnectionType)
        ? rawConnectionType
        : 'windows',
      networkIP: String(config.networkIP || '').trim(),
      networkPort: Number.parseInt(String(config.networkPort || ''), 10) || 9100,
      windowsPrinterName: String(
        config.windowsPrinterName || config.usbPrinterName || ''
      ).trim(),
      usbVendorId: parseUsbId(config.usbVendorId),
      usbProductId: parseUsbId(config.usbProductId),
      usbSerialNumber: String(config.usbSerialNumber || '').trim(),
      receiptMarginLeft: Number(config.receiptMarginLeft) || 3,
      receiptMarginRight: Number(config.receiptMarginRight) || 5,
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

  buildReceiptBuffer(data) {
    const printer = PrinterService.createBufferPrinter();

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

    const alignByte =
      align === 'center' ? 0x01 : align === 'right' ? 0x02 : 0x00;
    const alignCmd = Buffer.from([ESC, 0x61, alignByte]);
    const codepageCmd = Buffer.from([ESC, 0x74, 0x32]); // WPC1256
    const encoded = iconv.encode(text, 'win1256');
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
          client.destroy();
          resolve();
        });
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
