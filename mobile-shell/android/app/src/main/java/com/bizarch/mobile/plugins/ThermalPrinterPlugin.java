package com.bizarch.mobile.plugins;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.dantsu.escposprinter.EscPosPrinter;
import com.dantsu.escposprinter.connection.DeviceConnection;
import com.dantsu.escposprinter.connection.tcp.TcpConnection;
import com.dantsu.escposprinter.textparser.PrinterTextParserImg;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "ThermalPrinter")
public class ThermalPrinterPlugin extends Plugin {
    private static final int DEFAULT_PORT = 9100;
    private static final int DEFAULT_TIMEOUT_SECONDS = 10;
    private static final int DEFAULT_DPI = 203;
    private static final float DEFAULT_WIDTH_MM = 72f;
    private static final int DEFAULT_CHARS_PER_LINE = 48;
    private static final int MAX_IMAGE_CHUNK_HEIGHT = 256;

    /**
     * Build a native ESC/POS QR code command sequence (GS ( k).
     * The printer generates the QR code internally — fastest and sharpest output.
     */
    private byte[] buildNativeQRCommand(String data, int moduleSize) {
        byte[] dataBytes = data.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        int dataLen = dataBytes.length + 3;
        byte pL = (byte) (dataLen & 0xFF);
        byte pH = (byte) ((dataLen >> 8) & 0xFF);

        // Assemble command parts
        byte[][] parts = {
            // 1. Select QR model — Model 2
            {0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00},
            // 2. Set module size
            {0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, (byte) moduleSize},
            // 3. Set error correction level — M (0x31)
            {0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31},
            // 4. Store QR data header
            {0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30},
        };

        // Calculate total length
        int total = 0;
        for (byte[] part : parts) total += part.length;
        total += dataBytes.length;
        // 5. Print stored QR code
        byte[] printCmd = {0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30};
        total += printCmd.length;
        // Center align before QR
        byte[] alignCmd = {0x1B, 0x61, 0x01};
        total += alignCmd.length;
        // LF after QR
        total += 1;

        byte[] result = new byte[total];
        int offset = 0;

        System.arraycopy(alignCmd, 0, result, offset, alignCmd.length);
        offset += alignCmd.length;

        for (byte[] part : parts) {
            System.arraycopy(part, 0, result, offset, part.length);
            offset += part.length;
        }
        System.arraycopy(dataBytes, 0, result, offset, dataBytes.length);
        offset += dataBytes.length;
        System.arraycopy(printCmd, 0, result, offset, printCmd.length);
        offset += printCmd.length;
        result[offset] = 0x0A; // LF

        return result;
    }

    private DeviceConnection createConnection(PluginCall call) throws Exception {
        String host = call.getString("host", "").trim();
        if (host.isEmpty()) {
            throw new Exception("Printer host is required");
        }

        int port = call.getInt("port", DEFAULT_PORT);
        int timeoutSeconds = call.getInt("timeoutSeconds", DEFAULT_TIMEOUT_SECONDS);
        return new TcpConnection(host, port, timeoutSeconds);
    }

    private EscPosPrinter createPrinter(PluginCall call, DeviceConnection connection) throws Exception {
        int printerDpi = call.getInt("printerDpi", DEFAULT_DPI);
        float printerWidthMM = call.getFloat("printerWidthMM", DEFAULT_WIDTH_MM);
        int charsPerLine = printerWidthMM <= 48f ? 32 : DEFAULT_CHARS_PER_LINE;
        return new EscPosPrinter(connection, printerDpi, printerWidthMM, charsPerLine);
    }

    private List<Bitmap> splitBitmap(Bitmap source) {
        List<Bitmap> chunks = new ArrayList<>();
        int y = 0;

        while (y < source.getHeight()) {
            int height = Math.min(MAX_IMAGE_CHUNK_HEIGHT, source.getHeight() - y);
            chunks.add(Bitmap.createBitmap(source, 0, y, source.getWidth(), height));
            y += height;
        }

        return chunks;
    }

    @PluginMethod
    public void printImage(PluginCall call) {
        DeviceConnection connection = null;
        EscPosPrinter printer = null;

        try {
            connection = createConnection(call);
            printer = createPrinter(call, connection);

            String base64Image = call.getString("base64Image", "");
            if (base64Image.isEmpty()) {
                throw new Exception("Receipt image is required");
            }

            boolean cutPaper = call.getBoolean("cutPaper", true);
            boolean openCashDrawer = call.getBoolean("openCashDrawer", false);
            String qrCodeText = call.getString("qrCodeText", "");
            boolean hasNativeQR = qrCodeText != null && !qrCodeText.isEmpty();

            byte[] imageBytes = Base64.decode(base64Image, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            if (bitmap == null) {
                throw new Exception("Failed to decode receipt image");
            }

            List<Bitmap> chunks = splitBitmap(bitmap);
            for (int i = 0; i < chunks.size(); i++) {
                Bitmap chunk = chunks.get(i);
                String hexImage = PrinterTextParserImg.bitmapToHexadecimalString(printer, chunk, false);
                String printData = "[C]<img>" + hexImage + "</img>\n";
                boolean lastChunk = i == chunks.size() - 1;

                if (lastChunk && !hasNativeQR) {
                    // No native QR — let EscPosPrinter handle cut/drawer on last chunk
                    if (openCashDrawer) {
                        printer.printFormattedTextAndOpenCashBox(printData, 20f);
                    } else if (cutPaper) {
                        printer.printFormattedTextAndCut(printData, 20f);
                    } else {
                        printer.printFormattedText(printData, 20f);
                    }
                } else {
                    // More chunks follow, or native QR will be appended — no cut yet
                    printer.printFormattedText(printData, 20f);
                }

                chunk.recycle();
            }

            bitmap.recycle();

            // Native QR code via raw ESC/POS commands (GS ( k), then cut/drawer
            if (hasNativeQR) {
                byte[] qrCmd = buildNativeQRCommand(qrCodeText, 5);
                connection.write(qrCmd);

                // Paper cut after QR
                if (cutPaper) {
                    connection.write(new byte[]{0x1B, 0x64, 0x03});             // Feed 3 lines
                    connection.write(new byte[]{0x1D, 0x56, 0x42, 0x00});       // Partial cut
                }

                // Cash drawer
                if (openCashDrawer) {
                    connection.write(new byte[]{0x1B, 0x70, 0x00, 0x19, (byte) 0xFA}); // Pulse
                }
            }

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Image print failed: " + e.getMessage());
        } finally {
            try {
                if (printer != null) {
                    printer.disconnectPrinter();
                } else if (connection != null) {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
            }
        }
    }

    @PluginMethod
    public void testConnection(PluginCall call) {
        DeviceConnection connection = null;

        try {
            connection = createConnection(call);
            connection.connect();
            connection.disconnect();

            JSObject result = new JSObject();
            result.put("connected", true);
            result.put("message", "Connection successful");
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("connected", false);
            result.put("message", "Connection failed: " + e.getMessage());
            call.resolve(result);
        } finally {
            try {
                if (connection != null) {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
            }
        }
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        DeviceConnection connection = null;

        try {
            String dataBase64 = call.getString("data", "");
            if (dataBase64.isEmpty()) {
                call.reject("Print data is required", "MISSING_DATA");
                return;
            }

            byte[] bytes;
            try {
                bytes = Base64.decode(dataBase64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                call.reject("Invalid Base64: " + e.getMessage(), "INVALID_DATA");
                return;
            }

            connection = createConnection(call);
            connection.connect();
            connection.write(bytes);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("bytesSent", bytes.length);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Raw print failed: " + e.getMessage(), "PRINT_ERROR");
        } finally {
            try {
                if (connection != null) {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
            }
        }
    }

    @PluginMethod
    public void openCashDrawer(PluginCall call) {
        DeviceConnection connection = null;
        EscPosPrinter printer = null;

        try {
            connection = createConnection(call);
            printer = createPrinter(call, connection);
            printer.printFormattedTextAndOpenCashBox("\n", 20f);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Cash drawer failed: " + e.getMessage());
        } finally {
            try {
                if (printer != null) {
                    printer.disconnectPrinter();
                } else if (connection != null) {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
            }
        }
    }
}
