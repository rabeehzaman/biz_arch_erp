package com.bizarch.mobile.plugins;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import com.dantsu.escposprinter.EscPosPrinter;
import com.dantsu.escposprinter.connection.DeviceConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.tcp.TcpConnection;
import com.dantsu.escposprinter.exceptions.EscPosConnectionException;
import com.dantsu.escposprinter.textparser.PrinterTextParserImg;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(
            strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN },
            alias = "bluetooth"
        ),
        @Permission(
            strings = { Manifest.permission.ACCESS_FINE_LOCATION },
            alias = "location"
        )
    }
)
public class ThermalPrinterPlugin extends Plugin {
    private static final String TAG = "ThermalPrinter";
    private static final int DEFAULT_PORT = 9100;
    private static final int DEFAULT_TIMEOUT_SECONDS = 10;
    private static final int DEFAULT_DPI = 203;
    private static final float DEFAULT_WIDTH_MM = 72f;
    private static final int DEFAULT_CHARS_PER_LINE = 48;
    private static final int MAX_IMAGE_CHUNK_HEIGHT = 256;

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int BT_CHUNK_SIZE = 1024;
    private static final int BT_CHUNK_DELAY_MS = 20;
    private static final int BT_POST_FLUSH_DELAY_MS = 300;

    private final ExecutorService printExecutor = Executors.newSingleThreadExecutor();

    private static final String[] PRINTER_KEYWORDS = {
        "printer", "print", "pos", "xprinter", "mht", "milestone",
        "hoin", "rongta", "munbyn", "gprinter", "thermal", "receipt",
        "label", "tsc", "bixolon", "star", "epson"
    };

    // ── Bluetooth helpers ───────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private BluetoothSocket createAndConnectSocket(BluetoothDevice device) throws IOException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        BluetoothSocket socket = null;

        // Attempt 1: Standard SDP-based connection
        try {
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            if (adapter != null) adapter.cancelDiscovery();
            socket.connect();
            return socket;
        } catch (IOException e) {
            try { if (socket != null) socket.close(); } catch (IOException ignored) {}
            Log.d(TAG, "SDP connect failed, trying reflection fallback: " + e.getMessage());
        }

        // Attempt 2: Reflection fallback — bypasses SDP, connects to RFCOMM channel 1
        try {
            socket = (BluetoothSocket) device.getClass()
                    .getMethod("createRfcommSocket", new Class[]{int.class})
                    .invoke(device, 1);
            if (adapter != null) adapter.cancelDiscovery();
            socket.connect();
            return socket;
        } catch (Exception e) {
            try { if (socket != null) socket.close(); } catch (IOException ignored) {}
            throw new IOException("Bluetooth connect failed after SDP and reflection: " + e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void sendRawBluetooth(String macAddress, byte[] data) throws IOException {
        BluetoothDevice device = BluetoothAdapter.getDefaultAdapter().getRemoteDevice(macAddress);
        BluetoothSocket socket = createAndConnectSocket(device);

        try {
            OutputStream os = socket.getOutputStream();
            // Chunked writes to prevent overwhelming printer buffer
            for (int offset = 0; offset < data.length; offset += BT_CHUNK_SIZE) {
                int len = Math.min(BT_CHUNK_SIZE, data.length - offset);
                os.write(data, offset, len);
                os.flush();
                if (data.length > BT_CHUNK_SIZE) {
                    Thread.sleep(BT_CHUNK_DELAY_MS);
                }
            }
            os.flush();
            Thread.sleep(BT_POST_FLUSH_DELAY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            try { socket.close(); } catch (IOException ignored) {}
        }
    }

    private boolean isBluetooth(PluginCall call) {
        return "bluetooth".equals(call.getString("connectionType", "tcp"));
    }

    /**
     * Permission gate — checks BT permissions before running action.
     * For TCP calls, runs immediately.
     */
    private void withBluetoothPermission(PluginCall call, Runnable action) {
        if (!isBluetooth(call)) {
            action.run();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                pendingAction = action;
                requestPermissionForAlias("bluetooth", call, "onBtPermResult");
                return;
            }
        } else {
            if (getPermissionState("location") != PermissionState.GRANTED) {
                pendingAction = action;
                requestPermissionForAlias("location", call, "onBtPermResult");
                return;
            }
        }
        action.run();
    }

    private Runnable pendingAction;

    @PermissionCallback
    private void onBtPermResult(PluginCall call) {
        boolean granted;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            granted = getPermissionState("bluetooth") == PermissionState.GRANTED;
        } else {
            granted = getPermissionState("location") == PermissionState.GRANTED;
        }
        if (granted && pendingAction != null) {
            pendingAction.run();
            pendingAction = null;
        } else {
            call.reject("Bluetooth permission is required", "PERMISSION_DENIED");
            pendingAction = null;
        }
    }

    // ── Direct TCP helpers (bypass DantSu for reliability) ──────────

    /**
     * Send raw bytes to a network printer via direct java.net.Socket.
     * Handles TCP_NODELAY, SO_LINGER, shutdownOutput, WiFi binding.
     */
    private void sendOnce(String ip, int port, byte[] data) throws IOException {
        Socket socket = null;
        try {
            // Bind to WiFi network (prevents Android routing through cellular)
            Network wifi = getWifiNetwork();
            if (wifi != null) {
                socket = wifi.getSocketFactory().createSocket();
            } else {
                socket = new Socket();
            }

            // Configure BEFORE connecting
            socket.setTcpNoDelay(true);
            socket.setSoLinger(true, 5);
            socket.setSoTimeout(5000);

            // Connect with 4-second timeout
            socket.connect(new InetSocketAddress(ip, port), 4000);

            // Write all data
            OutputStream out = socket.getOutputStream();
            out.write(data);
            out.flush();

            // Graceful shutdown — guarantees all data sent before FIN
            socket.shutdownOutput();

            // Brief delay for printer to receive + TCP retransmissions
            Thread.sleep(300);

            // Drain printer status bytes (prevents RST on close)
            try {
                socket.setSoTimeout(200);
                byte[] drain = new byte[256];
                while (socket.getInputStream().read(drain) > 0) {
                    // discard
                }
            } catch (IOException ignored) {
                // Timeout or EOF — expected
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Print interrupted");
        } finally {
            if (socket != null) {
                try { socket.close(); } catch (IOException ignored) {}
            }
        }
    }

    private Network getWifiNetwork() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext()
                .getSystemService(Context.CONNECTIVITY_SERVICE);
            for (Network network : cm.getAllNetworks()) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    return network;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not get WiFi network: " + e.getMessage());
        }
        return null;
    }

    // ── ESC/POS QR code builder ─────────────────────────────────────

    private byte[] buildNativeQRCommand(String data, int moduleSize) {
        byte[] dataBytes = data.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        int dataLen = dataBytes.length + 3;
        byte pL = (byte) (dataLen & 0xFF);
        byte pH = (byte) ((dataLen >> 8) & 0xFF);

        byte[][] parts = {
            {0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00},
            {0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, (byte) moduleSize},
            {0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31},
            {0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30},
        };

        int total = 0;
        for (byte[] part : parts) total += part.length;
        total += dataBytes.length;
        byte[] printCmd = {0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30};
        total += printCmd.length;
        byte[] alignCmd = {0x1B, 0x61, 0x01};
        total += alignCmd.length;
        total += 1; // LF

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
        result[offset] = 0x0A;

        return result;
    }

    // ── DantSu helpers (for printImage) ─────────────────────────────

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

    // ── Plugin methods ──────────────────────────────────────────────

    @PluginMethod
    public void printRaw(PluginCall call) {
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

        withBluetoothPermission(call, () -> printExecutor.execute(() -> {
            int maxRetries = call.getInt("retries", 3);

            if (isBluetooth(call)) {
                String address = call.getString("address", "").trim();
                if (address.isEmpty()) {
                    call.reject("Bluetooth address is required", "MISSING_ADDRESS");
                    return;
                }
                IOException lastError = null;
                for (int attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        Log.d(TAG, "printRaw BT attempt " + attempt + "/" + maxRetries
                                + " -> " + address + " (" + bytes.length + " bytes)");
                        sendRawBluetooth(address, bytes);
                        Log.d(TAG, "printRaw BT succeeded on attempt " + attempt);
                        JSObject result = new JSObject();
                        result.put("success", true);
                        result.put("bytesSent", bytes.length);
                        result.put("attempts", attempt);
                        call.resolve(result);
                        return;
                    } catch (IOException e) {
                        lastError = e;
                        Log.w(TAG, "printRaw BT attempt " + attempt + " failed: " + e.getMessage());
                        if (attempt < maxRetries) {
                            try { Thread.sleep(500L * (1 << (attempt - 1))); }
                            catch (InterruptedException ie) {
                                Thread.currentThread().interrupt();
                                call.reject("Print interrupted", "PRINT_ERROR");
                                return;
                            }
                        }
                    }
                }
                call.reject("Bluetooth print failed after " + maxRetries + " attempts: "
                        + (lastError != null ? lastError.getMessage() : "unknown"), "PRINT_ERROR");
            } else {
                // Existing TCP path — unchanged
                String ip = call.getString("host", "").trim();
                int port = call.getInt("port", DEFAULT_PORT);
                if (ip.isEmpty()) {
                    call.reject("Printer host is required", "MISSING_HOST");
                    return;
                }
                IOException lastError = null;
                for (int attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        Log.d(TAG, "printRaw TCP attempt " + attempt + "/" + maxRetries
                                + " -> " + ip + ":" + port + " (" + bytes.length + " bytes)");
                        sendOnce(ip, port, bytes);
                        Log.d(TAG, "printRaw TCP succeeded on attempt " + attempt);
                        JSObject result = new JSObject();
                        result.put("success", true);
                        result.put("bytesSent", bytes.length);
                        result.put("attempts", attempt);
                        call.resolve(result);
                        return;
                    } catch (IOException e) {
                        lastError = e;
                        Log.w(TAG, "printRaw TCP attempt " + attempt + " failed: " + e.getMessage());
                        if (attempt < maxRetries) {
                            try { Thread.sleep(500L * (1 << (attempt - 1))); }
                            catch (InterruptedException ie) {
                                Thread.currentThread().interrupt();
                                call.reject("Print interrupted", "PRINT_ERROR");
                                return;
                            }
                        }
                    }
                }
                call.reject("Print failed after " + maxRetries + " attempts: "
                        + (lastError != null ? lastError.getMessage() : "unknown"), "PRINT_ERROR");
            }
        }));
    }

    @PluginMethod
    public void testConnection(PluginCall call) {
        withBluetoothPermission(call, () -> printExecutor.execute(() -> {
            if (isBluetooth(call)) {
                String address = call.getString("address", "").trim();
                if (address.isEmpty()) {
                    JSObject result = new JSObject();
                    result.put("connected", false);
                    result.put("message", "Bluetooth address is required");
                    call.resolve(result);
                    return;
                }
                BluetoothSocket socket = null;
                try {
                    BluetoothDevice device = BluetoothAdapter.getDefaultAdapter()
                            .getRemoteDevice(address);
                    socket = createAndConnectSocket(device);
                    socket.close();
                    socket = null;
                    JSObject result = new JSObject();
                    result.put("connected", true);
                    result.put("message", "Bluetooth connection successful");
                    call.resolve(result);
                } catch (Exception e) {
                    JSObject result = new JSObject();
                    result.put("connected", false);
                    result.put("message", "Bluetooth connection failed: " + e.getMessage());
                    call.resolve(result);
                } finally {
                    if (socket != null) {
                        try { socket.close(); } catch (IOException ignored) {}
                    }
                }
            } else {
                String ip = call.getString("host", "").trim();
                int port = call.getInt("port", DEFAULT_PORT);
                if (ip.isEmpty()) {
                    JSObject result = new JSObject();
                    result.put("connected", false);
                    result.put("message", "Printer host is required");
                    call.resolve(result);
                    return;
                }
                Socket socket = null;
                try {
                    Network wifi = getWifiNetwork();
                    if (wifi != null) {
                        socket = wifi.getSocketFactory().createSocket();
                    } else {
                        socket = new Socket();
                    }
                    socket.setTcpNoDelay(true);
                    socket.connect(new InetSocketAddress(ip, port), 4000);
                    socket.close();
                    socket = null;
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
                    if (socket != null) {
                        try { socket.close(); } catch (IOException ignored) {}
                    }
                }
            }
        }));
    }

    // ── ESC/POS raster image builder (for Bluetooth) ──────────────

    private byte[] buildRasterImageCommand(Bitmap bitmap) {
        // Convert bitmap to monochrome ESC/POS raster format
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int bytesPerRow = (width + 7) / 8;

        // ESC/POS GS v 0 command: print raster bit image
        // GS v 0 m xL xH yL yH [data]
        byte[] header = new byte[]{
                0x1D, 0x76, 0x30, 0x00,
                (byte) (bytesPerRow & 0xFF), (byte) ((bytesPerRow >> 8) & 0xFF),
                (byte) (height & 0xFF), (byte) ((height >> 8) & 0xFF)
        };

        byte[] imageData = new byte[bytesPerRow * height];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = bitmap.getPixel(x, y);
                int gray = (int) (0.299 * ((pixel >> 16) & 0xFF) +
                        0.587 * ((pixel >> 8) & 0xFF) +
                        0.114 * (pixel & 0xFF));
                if (gray < 128) {
                    imageData[y * bytesPerRow + (x / 8)] |= (byte) (0x80 >> (x % 8));
                }
            }
        }

        byte[] result = new byte[header.length + imageData.length];
        System.arraycopy(header, 0, result, 0, header.length);
        System.arraycopy(imageData, 0, result, header.length, imageData.length);
        return result;
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printImage(PluginCall call) {
        withBluetoothPermission(call, () -> printExecutor.execute(() -> {
            // For Bluetooth: build raw ESC/POS raster and send via direct socket
            if (isBluetooth(call)) {
                try {
                    String address = call.getString("address", "").trim();
                    if (address.isEmpty()) {
                        call.reject("Bluetooth address is required", "MISSING_ADDRESS");
                        return;
                    }

                    String base64Image = call.getString("base64Image", "");
                    if (base64Image.isEmpty()) {
                        call.reject("Receipt image is required", "MISSING_DATA");
                        return;
                    }

                    boolean cutPaper = call.getBoolean("cutPaper", true);
                    boolean openCashDrawer = call.getBoolean("openCashDrawer", false);
                    String qrCodeText = call.getString("qrCodeText", "");

                    byte[] imageBytes = Base64.decode(base64Image, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
                    if (bitmap == null) {
                        call.reject("Failed to decode receipt image", "INVALID_IMAGE");
                        return;
                    }

                    // Scale to printer width (384 dots for 80mm at 203 DPI)
                    float printerWidthMM = call.getFloat("printerWidthMM", DEFAULT_WIDTH_MM);
                    int printerDots = (int) (printerWidthMM / 25.4f * DEFAULT_DPI);
                    if (bitmap.getWidth() != printerDots) {
                        int scaledHeight = (int) ((float) bitmap.getHeight() / bitmap.getWidth() * printerDots);
                        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, printerDots, scaledHeight, true);
                        bitmap.recycle();
                        bitmap = scaled;
                    }

                    // Build ESC/POS commands
                    java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();

                    // Initialize printer
                    baos.write(new byte[]{0x1B, 0x40}); // ESC @

                    // Print image in chunks (max 256 rows to avoid buffer overflow)
                    int y = 0;
                    while (y < bitmap.getHeight()) {
                        int chunkHeight = Math.min(MAX_IMAGE_CHUNK_HEIGHT, bitmap.getHeight() - y);
                        Bitmap chunk = Bitmap.createBitmap(bitmap, 0, y, bitmap.getWidth(), chunkHeight);
                        baos.write(buildRasterImageCommand(chunk));
                        chunk.recycle();
                        y += chunkHeight;
                    }

                    // QR code via native ESC/POS
                    if (qrCodeText != null && !qrCodeText.isEmpty()) {
                        baos.write(buildNativeQRCommand(qrCodeText, 5));
                    }

                    // Feed + cut
                    if (cutPaper) {
                        baos.write(new byte[]{0x1B, 0x64, 0x03}); // feed 3 lines
                        baos.write(new byte[]{0x1D, 0x56, 0x42, 0x00}); // partial cut
                    }

                    // Cash drawer
                    if (openCashDrawer) {
                        baos.write(new byte[]{0x1B, 0x70, 0x00, 0x19, (byte) 0xFA});
                    }

                    bitmap.recycle();

                    // Send via reliable direct socket with chunked writes
                    sendRawBluetooth(address, baos.toByteArray());

                    JSObject result = new JSObject();
                    result.put("success", true);
                    call.resolve(result);
                } catch (Exception e) {
                    call.reject("Bluetooth image print failed: " + e.getMessage(), "PRINT_ERROR");
                }
                return;
            }

            // TCP path — unchanged, uses DantSu
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

            // Native QR code via raw ESC/POS then cut/drawer
            if (hasNativeQR) {
                byte[] qrCmd = buildNativeQRCommand(qrCodeText, 5);
                connection.write(qrCmd);
                connection.send();

                if (cutPaper) {
                    connection.write(new byte[]{0x1B, 0x64, 0x03});
                    connection.write(new byte[]{0x1D, 0x56, 0x42, 0x00});
                    connection.send();
                }

                if (openCashDrawer) {
                    connection.write(new byte[]{0x1B, 0x70, 0x00, 0x19, (byte) 0xFA});
                    connection.send();
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
        }));
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void openCashDrawer(PluginCall call) {
        withBluetoothPermission(call, () -> printExecutor.execute(() -> {
            DeviceConnection connection = null;
            EscPosPrinter printer = null;

            try {
                if (isBluetooth(call)) {
                    String address = call.getString("address", "").trim();
                    if (address.isEmpty()) {
                        call.reject("Bluetooth address is required", "MISSING_ADDRESS");
                        return;
                    }
                    BluetoothDevice device = BluetoothAdapter.getDefaultAdapter()
                            .getRemoteDevice(address);
                    connection = new BluetoothConnection(device);
                } else {
                    connection = createConnection(call);
                }
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
        }));
    }

    // ── PDF to thermal printer (PdfRenderer pipeline) ─────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printPdfToThermal(PluginCall call) {
        withBluetoothPermission(call, () -> printExecutor.execute(() -> {
            String base64Pdf = call.getString("base64Pdf", "");
            int paperWidth = call.getInt("paperWidth", 576);
            boolean cutPaper = call.getBoolean("cutPaper", true);

            if (base64Pdf.isEmpty()) {
                call.reject("PDF data is required", "MISSING_DATA");
                return;
            }

            File tempFile = null;
            PdfRenderer renderer = null;
            ParcelFileDescriptor fd = null;

            try {
                byte[] pdfBytes = Base64.decode(base64Pdf, Base64.DEFAULT);

                tempFile = File.createTempFile("print_", ".pdf", getContext().getCacheDir());
                FileOutputStream fos = new FileOutputStream(tempFile);
                fos.write(pdfBytes);
                fos.close();

                fd = ParcelFileDescriptor.open(tempFile, ParcelFileDescriptor.MODE_READ_ONLY);
                renderer = new PdfRenderer(fd);
                fd = null; // renderer now owns the FD

                int pageCount = renderer.getPageCount();
                ByteArrayOutputStream allData = new ByteArrayOutputStream();

                // Initialize printer
                allData.write(new byte[]{0x1B, 0x40});

                for (int i = 0; i < pageCount; i++) {
                    PdfRenderer.Page page = renderer.openPage(i);
                    try {
                        float scale = (float) paperWidth / (float) page.getWidth();
                        int bitmapHeight = Math.round(page.getHeight() * scale);

                        Bitmap bitmap = Bitmap.createBitmap(
                                paperWidth, bitmapHeight, Bitmap.Config.ARGB_8888);
                        bitmap.eraseColor(Color.WHITE);

                        Matrix matrix = new Matrix();
                        matrix.setScale(scale, scale);
                        page.render(bitmap, null, matrix,
                                PdfRenderer.Page.RENDER_MODE_FOR_PRINT);

                        floydSteinbergDither(bitmap);

                        byte[] rasterData = buildStripRasterCommands(
                                bitmap, paperWidth, bitmapHeight, MAX_IMAGE_CHUNK_HEIGHT);
                        allData.write(rasterData);

                        bitmap.recycle();

                        if (i < pageCount - 1) {
                            allData.write(new byte[]{0x1B, 0x64, 0x03});
                        }
                    } finally {
                        page.close();
                    }
                }

                allData.write(new byte[]{0x1B, 0x64, 0x04});

                if (cutPaper) {
                    allData.write(new byte[]{0x1D, 0x56, 0x42, 0x00});
                }

                if (isBluetooth(call)) {
                    String address = call.getString("address", "").trim();
                    if (address.isEmpty()) {
                        call.reject("Bluetooth address is required", "MISSING_ADDRESS");
                        return;
                    }
                    sendRawBluetooth(address, allData.toByteArray());
                } else {
                    String host = call.getString("host", "").trim();
                    int port = call.getInt("port", DEFAULT_PORT);
                    if (host.isEmpty()) {
                        call.reject("Printer host is required", "MISSING_HOST");
                        return;
                    }
                    sendOnce(host, port, allData.toByteArray());
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("pages", pageCount);
                call.resolve(result);

            } catch (Exception e) {
                call.reject("PDF print failed: " + e.getMessage(), "PRINT_ERROR");
            } finally {
                if (renderer != null) {
                    renderer.close();
                } else if (fd != null) {
                    try { fd.close(); } catch (IOException ignored) {}
                }
                if (tempFile != null) {
                    tempFile.delete();
                }
            }
        }));
    }

    private void floydSteinbergDither(Bitmap bitmap) {
        int w = bitmap.getWidth(), h = bitmap.getHeight();
        float[] curRow = new float[w];
        float[] nxtRow = new float[w];
        int[] pixels = new int[w];

        for (int y = 0; y < h; y++) {
            bitmap.getPixels(pixels, 0, w, 0, y, w, 1);

            for (int x = 0; x < w; x++) {
                int c = pixels[x];
                float lum = 0.299f * ((c >> 16) & 0xFF)
                          + 0.587f * ((c >> 8) & 0xFF)
                          + 0.114f * (c & 0xFF);
                float oldVal = Math.min(255f, Math.max(0f, curRow[x] + lum));
                int newVal = oldVal < 128f ? 0 : 255;
                pixels[x] = newVal == 0 ? 0xFF000000 : 0xFFFFFFFF;
                float err = oldVal - newVal;

                if (x + 1 < w)  curRow[x + 1] += err * 7f / 16f;
                if (x > 0)      nxtRow[x - 1] += err * 3f / 16f;
                                 nxtRow[x]     += err * 5f / 16f;
                if (x + 1 < w)  nxtRow[x + 1] += err * 1f / 16f;
            }

            bitmap.setPixels(pixels, 0, w, 0, y, w, 1);
            float[] tmp = curRow;
            curRow = nxtRow;
            nxtRow = tmp;
            Arrays.fill(nxtRow, 0f);
        }
    }

    private byte[] buildStripRasterCommands(Bitmap mono, int w, int h, int maxStripH) {
        int widthBytes = (w + 7) / 8;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] rowPixels = new int[w];

        for (int y = 0; y < h; y += maxStripH) {
            int stripH = Math.min(maxStripH, h - y);

            out.write(0x1D);
            out.write(0x76);
            out.write(0x30);
            out.write(0x00);
            out.write(widthBytes & 0xFF);
            out.write((widthBytes >> 8) & 0xFF);
            out.write(stripH & 0xFF);
            out.write((stripH >> 8) & 0xFF);

            for (int row = y; row < y + stripH; row++) {
                mono.getPixels(rowPixels, 0, w, 0, row, w, 1);
                for (int col = 0; col < widthBytes; col++) {
                    int b = 0;
                    for (int bit = 0; bit < 8; bit++) {
                        int px = col * 8 + bit;
                        if (px < w && (rowPixels[px] & 0xFF) == 0) {
                            b |= (0x80 >> bit);
                        }
                    }
                    out.write(b);
                }
            }
        }
        return out.toByteArray();
    }

    // ── HTML to thermal printer (WebView capture pipeline) ────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printHtmlToThermal(PluginCall call) {
        String html = call.getString("html", "");
        int paperWidth = call.getInt("paperWidth", 576);
        boolean cutPaper = call.getBoolean("cutPaper", true);

        if (html.isEmpty()) {
            call.reject("HTML content is required", "MISSING_DATA");
            return;
        }

        // Replace mm-based widths with 100% so body fills the WebView viewport
        String adjustedHtml = html
                .replace("width: 80mm", "width: 100%")
                .replace("width:80mm", "width: 100%");

        final float density = getActivity().getResources().getDisplayMetrics().density;
        final int layoutWidth = Math.round(paperWidth * density); // e.g. 576 * 2.625 = 1512

        getActivity().runOnUiThread(() -> {
            try {
                android.webkit.WebView.enableSlowWholeDocumentDraw();

                android.webkit.WebView webView = new android.webkit.WebView(getActivity());
                webView.setVisibility(android.view.View.INVISIBLE);
                webView.setBackgroundColor(Color.WHITE);

                webView.getSettings().setJavaScriptEnabled(false);
                webView.getSettings().setLoadWithOverviewMode(false);
                webView.getSettings().setUseWideViewPort(false);
                webView.getSettings().setTextZoom(100);

                // Layout at density-scaled width so CSS viewport = paperWidth CSS pixels
                android.widget.FrameLayout rootView = getActivity().findViewById(android.R.id.content);
                rootView.addView(webView, new android.widget.FrameLayout.LayoutParams(
                        layoutWidth, android.widget.FrameLayout.LayoutParams.WRAP_CONTENT));

                webView.setWebViewClient(new android.webkit.WebViewClient() {
                    private boolean captured = false;

                    @Override
                    public void onPageFinished(android.webkit.WebView view, String url) {
                        if (captured) return;
                        captured = true;

                        // Wait for layout + rendering to complete
                        view.postDelayed(() -> {
                            try {
                                // Measure at density-scaled width
                                view.measure(
                                        android.view.View.MeasureSpec.makeMeasureSpec(layoutWidth,
                                                android.view.View.MeasureSpec.EXACTLY),
                                        android.view.View.MeasureSpec.makeMeasureSpec(0,
                                                android.view.View.MeasureSpec.UNSPECIFIED));

                                int measuredH = view.getMeasuredHeight();
                                if (measuredH <= 0) {
                                    measuredH = (int) (view.getContentHeight() * density);
                                }
                                if (measuredH <= 0) measuredH = (int) (800 * density);

                                view.layout(0, 0, layoutWidth, measuredH);

                                // Create bitmap at target printer width, scale down from density-sized render
                                int bitmapH = Math.round(measuredH / density);
                                Bitmap bitmap = Bitmap.createBitmap(
                                        paperWidth, bitmapH, Bitmap.Config.ARGB_8888);
                                bitmap.eraseColor(Color.WHITE);
                                android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
                                canvas.scale(1f / density, 1f / density);
                                view.draw(canvas);

                                // Remove WebView from hierarchy
                                rootView.removeView(view);
                                view.destroy();

                                final Bitmap capturedBitmap = bitmap;
                                printExecutor.execute(() -> {
                                    try {
                                        floydSteinbergDither(capturedBitmap);

                                        ByteArrayOutputStream allData = new ByteArrayOutputStream();
                                        allData.write(new byte[]{0x1B, 0x40});

                                        byte[] rasterData = buildStripRasterCommands(
                                                capturedBitmap, paperWidth, capturedBitmap.getHeight(),
                                                MAX_IMAGE_CHUNK_HEIGHT);
                                        allData.write(rasterData);
                                        capturedBitmap.recycle();

                                        allData.write(new byte[]{0x1B, 0x64, 0x04});
                                        if (cutPaper) {
                                            allData.write(new byte[]{0x1D, 0x56, 0x42, 0x00});
                                        }

                                        if (isBluetooth(call)) {
                                            String address = call.getString("address", "").trim();
                                            sendRawBluetooth(address, allData.toByteArray());
                                        } else {
                                            String host = call.getString("host", "").trim();
                                            int port = call.getInt("port", DEFAULT_PORT);
                                            sendOnce(host, port, allData.toByteArray());
                                        }

                                        JSObject result = new JSObject();
                                        result.put("success", true);
                                        call.resolve(result);
                                    } catch (Exception e) {
                                        call.reject("HTML thermal print failed: " + e.getMessage(), "PRINT_ERROR");
                                    }
                                });
                            } catch (Exception e) {
                                rootView.removeView(view);
                                view.destroy();
                                call.reject("WebView capture failed: " + e.getMessage(), "CAPTURE_ERROR");
                            }
                        }, 800);
                    }
                });

                webView.loadDataWithBaseURL(null, adjustedHtml, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("Failed to create WebView: " + e.getMessage(), "WEBVIEW_ERROR");
            }
        });
    }

    // ── Bluetooth device listing ────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void listBluetoothDevices(PluginCall call) {
        // Always check BT permissions (not gated by connectionType)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                pendingAction = () -> executeListDevices(call);
                requestPermissionForAlias("bluetooth", call, "onBtPermResult");
                return;
            }
        }
        executeListDevices(call);
    }

    @SuppressLint("MissingPermission")
    private void executeListDevices(PluginCall call) {
        {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not available on this device", "BT_UNAVAILABLE");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("Bluetooth is disabled", "BT_DISABLED");
                return;
            }

            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSArray devices = new JSArray();

            for (BluetoothDevice device : bonded) {
                String name = device.getName();
                boolean isPrinter = false;

                // Check Bluetooth device class
                if (device.getBluetoothClass() != null) {
                    int majorClass = device.getBluetoothClass().getMajorDeviceClass();
                    if (majorClass == BluetoothClass.Device.Major.IMAGING) {
                        isPrinter = true;
                    }
                }

                // Check name heuristics
                if (!isPrinter && name != null) {
                    String lowerName = name.toLowerCase();
                    for (String keyword : PRINTER_KEYWORDS) {
                        if (lowerName.contains(keyword)) {
                            isPrinter = true;
                            break;
                        }
                    }
                }

                JSObject d = new JSObject();
                d.put("name", name != null ? name : "Unknown");
                d.put("address", device.getAddress());
                d.put("isPrinter", isPrinter);
                devices.put(d);
            }

            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        }
    }
}
