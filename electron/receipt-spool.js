const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LATEST_FILE = 'latest.json';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function sanitizeKeyPart(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.slice(0, 120) || '';
}

function buildReceiptKey(receiptData = {}) {
  const invoicePart = sanitizeKeyPart(receiptData.invoiceNumber || '');
  if (invoicePart) {
    return invoicePart;
  }

  return `receipt-${Date.now()}`;
}

function serializeReceiptData(receiptData = {}) {
  const serialized = {
    ...receiptData,
  };

  if (receiptData?.date instanceof Date) {
    serialized.date = receiptData.date.toISOString();
  } else if (receiptData?.date != null) {
    serialized.date = String(receiptData.date);
  } else {
    serialized.date = new Date().toISOString();
  }

  return serialized;
}

function hashPrinterProfile(config = {}) {
  const hashInput = JSON.stringify({
    connectionType: config.connectionType || '',
    receiptRenderMode: config.receiptRenderMode || '',
    arabicCodePage: config.arabicCodePage || '',
    networkIP: config.networkIP || '',
    networkPort: config.networkPort || '',
    windowsPrinterName: config.windowsPrinterName || '',
    usbVendorId: config.usbVendorId ?? null,
    usbProductId: config.usbProductId ?? null,
    usbSerialNumber: config.usbSerialNumber || '',
    receiptMarginLeft: config.receiptMarginLeft ?? null,
    receiptMarginRight: config.receiptMarginRight ?? null,
  });

  return crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

function getLatestFilePath(baseDir) {
  return path.join(baseDir, LATEST_FILE);
}

function getReceiptFilePaths(baseDir, key) {
  return {
    meta: path.join(baseDir, `${key}.meta.json`),
    snapshot: path.join(baseDir, `${key}.snapshot.json`),
    html: path.join(baseDir, `${key}.html`),
    buffer: path.join(baseDir, `${key}.bin`),
  };
}

function relativeFile(baseDir, filePath) {
  return path.relative(baseDir, filePath);
}

function absoluteFile(baseDir, maybeRelativePath) {
  if (!maybeRelativePath) {
    return null;
  }

  if (path.isAbsolute(maybeRelativePath)) {
    return maybeRelativePath;
  }

  return path.join(baseDir, maybeRelativePath);
}

function saveReceiptArtifact(
  baseDir,
  {
    normalizedConfig = {},
    renderMode,
    receiptData,
    html,
    buffer,
    key,
  }
) {
  ensureDir(baseDir);

  const serializedReceiptData = serializeReceiptData(receiptData || {});
  const receiptKey = sanitizeKeyPart(key) || buildReceiptKey(serializedReceiptData);
  const files = getReceiptFilePaths(baseDir, receiptKey);

  fs.writeFileSync(
    files.snapshot,
    JSON.stringify(serializedReceiptData, null, 2),
    'utf-8'
  );

  const meta = {
    key: receiptKey,
    invoiceNumber: serializedReceiptData.invoiceNumber || null,
    cachedAt: new Date().toISOString(),
    renderMode: renderMode || normalizedConfig.receiptRenderMode || 'htmlRaster',
    printerProfileHash: hashPrinterProfile(normalizedConfig),
    files: {
      snapshot: relativeFile(baseDir, files.snapshot),
      html: null,
      buffer: null,
    },
  };

  if (typeof html === 'string' && html.trim()) {
    fs.writeFileSync(files.html, html, 'utf-8');
    meta.files.html = relativeFile(baseDir, files.html);
  }

  if (Buffer.isBuffer(buffer) && buffer.length > 0) {
    fs.writeFileSync(files.buffer, buffer);
    meta.files.buffer = relativeFile(baseDir, files.buffer);
  }

  fs.writeFileSync(files.meta, JSON.stringify(meta, null, 2), 'utf-8');
  fs.writeFileSync(
    getLatestFilePath(baseDir),
    JSON.stringify(
      {
        key: receiptKey,
        cachedAt: meta.cachedAt,
      },
      null,
      2
    ),
    'utf-8'
  );

  return {
    ...meta,
    receiptData: serializedReceiptData,
  };
}

function loadReceiptArtifact(baseDir, key) {
  if (!key) {
    return null;
  }

  const safeKey = sanitizeKeyPart(key);
  if (!safeKey) {
    return null;
  }

  const files = getReceiptFilePaths(baseDir, safeKey);
  const meta = readJson(files.meta);
  const receiptData = readJson(files.snapshot);

  if (!meta || !receiptData) {
    return null;
  }

  return {
    ...meta,
    receiptData,
  };
}

function loadLatestReceiptArtifact(baseDir) {
  const latest = readJson(getLatestFilePath(baseDir));
  if (!latest?.key) {
    return null;
  }

  return loadReceiptArtifact(baseDir, latest.key);
}

function readReceiptHtml(baseDir, receiptArtifact) {
  const filePath = absoluteFile(baseDir, receiptArtifact?.files?.html);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

function readReceiptBuffer(baseDir, receiptArtifact) {
  const filePath = absoluteFile(baseDir, receiptArtifact?.files?.buffer);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath);
}

module.exports = {
  buildReceiptKey,
  hashPrinterProfile,
  loadLatestReceiptArtifact,
  loadReceiptArtifact,
  readReceiptBuffer,
  readReceiptHtml,
  saveReceiptArtifact,
  serializeReceiptData,
};
