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
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
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

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printImage(PluginCall call) {
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
                    try {
                        connection = new BluetoothConnection(device);
                    } catch (Exception e) {
                        connection = new ReflectionBluetoothConnection(device);
                    }
                } else {
                    connection = createConnection(call);
                }
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
            } catch (EscPosConnectionException e) {
                // If Bluetooth, retry with reflection fallback
                if (isBluetooth(call)) {
                    try {
                        String address = call.getString("address", "").trim();
                        BluetoothDevice device = BluetoothAdapter.getDefaultAdapter()
                                .getRemoteDevice(address);
                        DeviceConnection fallback = new ReflectionBluetoothConnection(device);
                        EscPosPrinter fallbackPrinter = createPrinter(call, fallback);
                        // Re-run the image print logic with fallback
                        // (simplified: just re-print the image)
                        String base64Image2 = call.getString("base64Image", "");
                        byte[] imageBytes2 = Base64.decode(base64Image2, Base64.DEFAULT);
                        Bitmap bitmap2 = BitmapFactory.decodeByteArray(imageBytes2, 0, imageBytes2.length);
                        if (bitmap2 != null) {
                            List<Bitmap> chunks2 = splitBitmap(bitmap2);
                            for (int i = 0; i < chunks2.size(); i++) {
                                Bitmap chunk = chunks2.get(i);
                                String hexImage = PrinterTextParserImg.bitmapToHexadecimalString(
                                        fallbackPrinter, chunk, false);
                                String printData = "[C]<img>" + hexImage + "</img>\n";
                                if (i == chunks2.size() - 1) {
                                    boolean cutPaper2 = call.getBoolean("cutPaper", true);
                                    if (cutPaper2) {
                                        fallbackPrinter.printFormattedTextAndCut(printData, 20f);
                                    } else {
                                        fallbackPrinter.printFormattedText(printData, 20f);
                                    }
                                } else {
                                    fallbackPrinter.printFormattedText(printData, 20f);
                                }
                                chunk.recycle();
                            }
                            bitmap2.recycle();
                        }
                        fallbackPrinter.disconnectPrinter();
                        JSObject result = new JSObject();
                        result.put("success", true);
                        call.resolve(result);
                        return;
                    } catch (Exception e2) {
                        call.reject("Image print failed after BT reflection retry: " + e2.getMessage());
                        return;
                    }
                }
                call.reject("Image print failed: " + e.getMessage());
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
