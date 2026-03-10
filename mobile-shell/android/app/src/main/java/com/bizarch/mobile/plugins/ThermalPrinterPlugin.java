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

                if (lastChunk) {
                    if (openCashDrawer) {
                        printer.printFormattedTextAndOpenCashBox(printData, 20f);
                    } else if (cutPaper) {
                        printer.printFormattedTextAndCut(printData, 20f);
                    } else {
                        printer.printFormattedText(printData, 20f);
                    }
                } else {
                    printer.printFormattedText(printData, 20f);
                }

                chunk.recycle();
            }

            bitmap.recycle();

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
