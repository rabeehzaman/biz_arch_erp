// printer-service.js — Dual-mode ESC/POS printer service (Network TCP + USB via Windows spooler)
const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
} = require('node-thermal-printer');
const net = require('node:net');
const iconv = require('iconv-lite');

class PrinterService {
  /**
   * @param {string|null} printerIP - IP for network mode (null for USB)
   * @param {number|null} printerPort - Port for network mode (null for USB)
   * @param {string} [interfaceOverride] - Direct interface string, e.g. "printer:Epson TM-T88VI"
   */
  constructor(printerIP, printerPort = 9100, interfaceOverride) {
    this.printerIP = printerIP;
    this.printerPort = printerPort;

    if (interfaceOverride) {
      // USB mode: "printer:PrinterName" uses Windows print spooler
      this.interface = interfaceOverride;
      this.mode = 'usb';
    } else {
      // Network mode: raw TCP to port 9100
      this.interface = `tcp://${printerIP}:${printerPort}`;
      this.mode = 'network';
    }
  }

  // ─── Create a fresh printer instance per print job ──────────────
  _createPrinter() {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: this.interface,
      characterSet: CharacterSet.PC437_USA,
      width: 48, // 48 chars for 80mm paper
      removeSpecialCharacters: false,
      options: { timeout: 5000 },
    });
  }

  // ─── Test Connection ────────────────────────────────────────────
  async testConnection() {
    const printer = this._createPrinter();
    return await printer.isPrinterConnected();
  }

  // ─── Print Full Receipt ─────────────────────────────────────────
  async printReceipt(data) {
    const printer = this._createPrinter();
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      throw new Error(`Printer not reachable at ${this.interface}`);
    }

    // ── Header ──
    printer.alignCenter();
    if (data.header) {
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.println(data.header.storeName || 'STORE');
      printer.setTextNormal();
      printer.bold(false);

      if (data.header.storeNameAr) {
        this._appendArabicLine(printer, data.header.storeNameAr, 'center');
      }

      if (data.header.address) printer.println(data.header.address);
      if (data.header.phone) printer.println(`Tel: ${data.header.phone}`);
      if (data.header.vatNumber) printer.println(`VAT: ${data.header.vatNumber}`);
    }
    printer.drawLine();

    // ── Invoice Info ──
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

    // ── Column Headers ──
    printer.bold(true);
    printer.tableCustom([
      { text: 'Item', align: 'LEFT', width: 0.45 },
      { text: 'Qty', align: 'CENTER', width: 0.15 },
      { text: 'Price', align: 'RIGHT', width: 0.2 },
      { text: 'Total', align: 'RIGHT', width: 0.2 },
    ]);
    printer.bold(false);
    printer.drawLine();

    // ── Line Items ──
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        const lineTotal = ((item.qty || 1) * (item.price || 0)).toFixed(2);
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

    // ── Totals ──
    printer.drawLine();
    if (data.totals) {
      if (data.totals.subtotal !== undefined) {
        printer.leftRight('Subtotal:', data.totals.subtotal.toFixed(2));
      }
      if (data.totals.discount) {
        printer.leftRight('Discount:', `-${data.totals.discount.toFixed(2)}`);
      }
      if (data.totals.tax !== undefined) {
        printer.leftRight('Tax (VAT):', data.totals.tax.toFixed(2));
      }
      printer.drawLine();
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.leftRight('TOTAL:', (data.totals.total || 0).toFixed(2));
      printer.setTextNormal();
      printer.bold(false);
    }

    // ── Payment Info ──
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

    // ── Barcode ──
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

    // ── QR Code ──
    if (data.qrcode) {
      printer.alignCenter();
      printer.printQR(data.qrcode, {
        cellSize: 4,
        correction: 'M',
        model: 2,
      });
      printer.newLine();
    }

    // ── Footer ──
    printer.alignCenter();
    if (data.footer) {
      printer.println(data.footer);
    }
    if (data.footerAr) {
      this._appendArabicLine(printer, data.footerAr, 'center');
    }
    printer.newLine();
    printer.newLine();

    // ── Cut Paper ──
    if (data.cutPaper !== false) {
      printer.partialCut();
    }

    // ── Cash Drawer ──
    if (data.openDrawer) {
      printer.openCashDrawer();
    }

    // ── Execute ──
    await printer.execute();
    printer.clear();
  }

  // ─── Arabic Text via WPC1256 Code Page ──────────────────────────
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

  // ─── Open Cash Drawer Only ──────────────────────────────────────
  async openCashDrawer() {
    if (this.mode === 'usb') {
      // For USB, send via printer instance
      const printer = this._createPrinter();
      printer.openCashDrawer();
      await printer.execute();
      printer.clear();
    } else {
      // For network, send raw TCP
      const cmd = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xff]);
      await PrinterService.sendRawTCP(
        this.printerIP,
        this.printerPort,
        cmd
      );
    }
  }

  // ─── Raw TCP Socket Send ────────────────────────────────────────
  static sendRawTCP(ip, port, buffer) {
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
