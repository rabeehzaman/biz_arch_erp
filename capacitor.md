# Capacitor Android app for ESC/POS thermal printing over Bluetooth, TCP, and USB

**Capacitor v7/v8 can wrap your remote web ERP in a native Android shell and bridge JavaScript calls to the DantSu ESCPOS-ThermalPrinter-Android library for receipt printing over Bluetooth, TCP/IP, and USB.** This guide covers every step—from `npm init` to signed APK—with production-ready code targeting a multi-branch candy/toy trading operation in Saudi Arabia. The critical design choice: Arabic text must be rendered as bitmaps (not code pages) because ESC/POS printers lack native RTL shaping. All code below targets **Capacitor 8.1.0** (latest stable, February 2026) with **DantSu ESCPOS v3.4.0** and **Android SDK 36**.

---

## Complete project setup from scratch

### Initialize the project and install dependencies

Start with a minimal web project directory containing at least one `index.html` (Capacitor requires a `webDir` even when loading a remote URL):

```bash
mkdir erp-pos-app && cd erp-pos-app
npm init -y

# Core Capacitor packages (v8 latest)
npm i @capacitor/core@8.1.0
npm i -D @capacitor/cli@8.1.0

# Initialize Capacitor config
npx cap init "ERP POS" "com.yourcompany.erppos" --web-dir www

# Create minimal web shell (fallback page)
mkdir www
cat > www/index.html << 'EOF'
<!DOCTYPE html>
<html><head><title>Loading...</title></head>
<body><p>Loading ERP...</p></body></html>
EOF

# Add Android platform
npm i @capacitor/android@8.1.0
npx cap add android
```

For Capacitor 7 instead, replace version tags with `@7.5.0` and adjust SDK targets accordingly (compileSdk 35, minSdk 23, targetSdk 35).

### Configure the remote URL in `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.erppos',
  appName: 'ERP POS',
  webDir: 'www',
  server: {
    url: 'https://erp.yourcompany.com',       // Your remote ERP URL
    cleartext: false,                          // Set true only if using HTTP
    allowNavigation: ['*.yourcompany.com'],    // Allow navigation within your domain
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
```

**Key detail:** even with `server.url` set, the `www/index.html` must exist with a `<head>` tag—Capacitor injects its bridge script there as a fallback. When `server.url` is configured, Capacitor loads that remote URL inside its managed WebView and **injects the native bridge**, so plugin calls work. This differs from navigating to an external URL after load, where the bridge may be lost.

### Android project structure after setup

```
erp-pos-app/
├── android/
│   ├── app/
│   │   ├── build.gradle                         ← Add DantSu dependency here
│   │   └── src/main/
│   │       ├── AndroidManifest.xml              ← Permissions here
│   │       ├── java/com/yourcompany/erppos/
│   │       │   ├── MainActivity.java            ← Register plugin here
│   │       │   └── plugins/
│   │       │       └── ThermalPrinterPlugin.java ← Your custom plugin
│   │       ├── res/
│   │       └── assets/public/                   ← Synced from www/
│   ├── build.gradle                             ← Add JitPack repo here
│   ├── settings.gradle
│   └── variables.gradle                         ← SDK version variables
├── capacitor.config.ts
├── package.json
├── www/index.html
└── src/plugins/
    └── ThermalPrinter.ts                        ← TypeScript definitions
```

### Gradle dependencies: add JitPack and DantSu library

In **`android/build.gradle`** (root level), add the JitPack repository:

```groovy
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}
```

In **`android/app/build.gradle`**, add the DantSu library:

```groovy
dependencies {
    implementation project(':capacitor-android')
    // DantSu ESC/POS Thermal Printer — v3.4.0 (Oct 2024, latest)
    implementation 'com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.4.0'
}
```

### AndroidManifest.xml — full permissions block

Place these inside the `<manifest>` tag in **`android/app/src/main/AndroidManifest.xml`**:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Internet (remote ERP loading) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Bluetooth Legacy (Android 11 and below) -->
    <uses-permission android:name="android.permission.BLUETOOTH"
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"
        android:maxSdkVersion="30" />

    <!-- Bluetooth Android 12+ (API 31+) -->
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation"
        tools:targetApi="s" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

    <!-- Location for BLE scanning on Android 6-11 only -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"
        android:maxSdkVersion="30" />

    <!-- USB Host -->
    <uses-feature android:name="android.hardware.usb.host"
        android:required="false" />

    <!-- Optional: BLE hardware feature -->
    <uses-feature android:name="android.hardware.bluetooth_le"
        android:required="false" />

    <application
        android:allowBackup="true"
        android:usesCleartextTraffic="${useCleartextTraffic}"
        ... >

        <activity android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <!-- Auto-detect USB printers -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            <meta-data
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/usb_device_filter" />
        </activity>
    </application>
</manifest>
```

Create **`android/app/src/main/res/xml/usb_device_filter.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Match USB printer class (class 7) -->
    <usb-device class="7" />
    <!-- Or target specific vendor/product IDs -->
    <!-- <usb-device vendor-id="1208" product-id="2163" /> -->
</resources>
```

---

## Custom Capacitor plugin for thermal printing

### TypeScript definitions — `src/plugins/ThermalPrinter.ts`

This file defines every method your web app can call. Create it in your web project source:

```typescript
import { registerPlugin } from '@capacitor/core';

export interface PrinterDevice {
  name: string;
  address: string;  // MAC address for BT, IP for TCP, device path for USB
  type: 'bluetooth' | 'tcp' | 'usb';
}

export interface PrintOptions {
  connectionType: 'bluetooth' | 'tcp' | 'usb';
  address: string;           // MAC address, IP:port, or "usb"
  port?: number;             // TCP port, default 9100
  printerDpi?: number;       // Default 203
  printerWidthMM?: number;   // Default 48 (58mm paper) or 72 (80mm paper)
  printerNbrCharPerLine?: number; // Default 32 (58mm) or 48 (80mm)
  text: string;              // DantSu formatted text markup
  cutPaper?: boolean;        // Auto-cut after printing
  openCashDrawer?: boolean;  // Kick cash drawer after printing
}

export interface PrintImageOptions {
  connectionType: 'bluetooth' | 'tcp' | 'usb';
  address: string;
  port?: number;
  printerDpi?: number;
  printerWidthMM?: number;
  printerNbrCharPerLine?: number;
  base64Image: string;       // Base64-encoded image (receipt rendered as image)
  cutPaper?: boolean;
  openCashDrawer?: boolean;
}

export interface ThermalPrinterPlugin {
  // Permissions
  requestBluetoothPermissions(): Promise<{ granted: boolean }>;

  // Discovery
  scanBluetoothPrinters(): Promise<{ devices: PrinterDevice[] }>;
  getPairedBluetoothPrinters(): Promise<{ devices: PrinterDevice[] }>;
  getUsbPrinters(): Promise<{ devices: PrinterDevice[] }>;

  // Printing
  printFormatted(options: PrintOptions): Promise<{ success: boolean }>;
  printImage(options: PrintImageOptions): Promise<{ success: boolean }>;

  // Utility
  cutPaper(options: { connectionType: string; address: string; port?: number }): Promise<void>;
  openCashDrawer(options: { connectionType: string; address: string; port?: number }): Promise<void>;
  testConnection(options: { connectionType: string; address: string; port?: number }): Promise<{ connected: boolean; message: string }>;
}

const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter');
export default ThermalPrinter;
```

### Java implementation — `ThermalPrinterPlugin.java`

Create this at **`android/app/src/main/java/com/yourcompany/erppos/plugins/ThermalPrinterPlugin.java`**:

```java
package com.yourcompany.erppos.plugins;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.Base64;
import android.util.Log;

import com.dantsu.escposprinter.EscPosPrinter;
import com.dantsu.escposprinter.EscPosCharsetEncoding;
import com.dantsu.escposprinter.connection.DeviceConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.dantsu.escposprinter.connection.tcp.TcpConnection;
import com.dantsu.escposprinter.connection.usb.UsbConnection;
import com.dantsu.escposprinter.connection.usb.UsbPrintersConnections;
import com.dantsu.escposprinter.textparser.PrinterTextParserImg;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.HashMap;
import java.util.Set;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            }
        ),
        @Permission(
            alias = "bluetoothLegacy",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN
            }
        ),
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        )
    }
)
public class ThermalPrinterPlugin extends Plugin {

    private static final String TAG = "ThermalPrinter";

    // ───── Permissions ─────

    @PluginMethod()
    public void requestBluetoothPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                requestPermissionForAlias("bluetooth", call, "btPermCallback");
                return;
            }
        } else {
            if (getPermissionState("location") != PermissionState.GRANTED) {
                requestPermissionForAlias("location", call, "btPermCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void btPermCallback(PluginCall call) {
        boolean granted;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            granted = getPermissionState("bluetooth") == PermissionState.GRANTED;
        } else {
            granted = getPermissionState("location") == PermissionState.GRANTED;
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    // ───── Bluetooth Discovery ─────

    @PluginMethod()
    public void getPairedBluetoothPrinters(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not available on this device");
                return;
            }
            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            JSArray devices = new JSArray();
            if (bondedDevices != null) {
                for (BluetoothDevice device : bondedDevices) {
                    JSObject d = new JSObject();
                    d.put("name", device.getName() != null ? device.getName() : "Unknown");
                    d.put("address", device.getAddress());
                    d.put("type", "bluetooth");
                    devices.put(d);
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Bluetooth permission required: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void scanBluetoothPrinters(PluginCall call) {
        try {
            BluetoothPrintersConnections btConnections = new BluetoothPrintersConnections();
            BluetoothConnection[] printers = btConnections.getList();
            JSArray devices = new JSArray();
            if (printers != null) {
                for (BluetoothConnection conn : printers) {
                    BluetoothDevice device = conn.getDevice();
                    JSObject d = new JSObject();
                    d.put("name", device.getName() != null ? device.getName() : "Unknown");
                    d.put("address", device.getAddress());
                    d.put("type", "bluetooth");
                    devices.put(d);
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Scan failed: " + e.getMessage());
        }
    }

    // ───── USB Discovery ─────

    @PluginMethod()
    public void getUsbPrinters(PluginCall call) {
        try {
            UsbManager usbManager = (UsbManager) getContext()
                    .getSystemService(Context.USB_SERVICE);
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            JSArray devices = new JSArray();
            for (UsbDevice device : deviceList.values()) {
                JSObject d = new JSObject();
                d.put("name", device.getProductName() != null
                        ? device.getProductName() : "USB Device");
                d.put("address", device.getDeviceName());
                d.put("type", "usb");
                devices.put(d);
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("USB scan failed: " + e.getMessage());
        }
    }

    // ───── Connection Factory ─────

    private DeviceConnection createConnection(PluginCall call) throws Exception {
        String type = call.getString("connectionType", "bluetooth");
        String address = call.getString("address", "");

        switch (type) {
            case "bluetooth": {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                BluetoothDevice device = adapter.getRemoteDevice(address);
                return new BluetoothConnection(device);
            }
            case "tcp": {
                int port = call.getInt("port", 9100);
                int timeout = call.getInt("timeout", 15);
                return new TcpConnection(address, port, timeout);
            }
            case "usb": {
                UsbManager usbManager = (UsbManager) getContext()
                        .getSystemService(Context.USB_SERVICE);
                UsbPrintersConnections usbConnections =
                        new UsbPrintersConnections(usbManager);
                UsbConnection firstUsb = usbConnections.selectFirstConnected();
                if (firstUsb == null) {
                    throw new Exception("No USB printer found or permission not granted");
                }
                return firstUsb;
            }
            default:
                throw new Exception("Unknown connection type: " + type);
        }
    }

    private EscPosPrinter createPrinter(PluginCall call, DeviceConnection conn)
            throws Exception {
        int dpi = call.getInt("printerDpi", 203);
        float widthMM = call.getFloat("printerWidthMM", 48f);
        int charsPerLine = call.getInt("printerNbrCharPerLine", 32);

        return new EscPosPrinter(conn, dpi, widthMM, charsPerLine);
    }

    // ───── Print Formatted Text ─────

    @PluginMethod()
    public void printFormatted(PluginCall call) {
        // Plugin methods already run on background thread in Capacitor
        try {
            DeviceConnection conn = createConnection(call);
            EscPosPrinter printer = createPrinter(call, conn);
            String text = call.getString("text", "");
            boolean cut = call.getBoolean("cutPaper", false);
            boolean cashDrawer = call.getBoolean("openCashDrawer", false);

            if (cashDrawer) {
                printer.printFormattedTextAndOpenCashBox(text, 20f);
            } else if (cut) {
                printer.printFormattedTextAndCut(text, 20f);
            } else {
                printer.printFormattedText(text, 20f);
            }

            printer.disconnectPrinter();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Print failed", e);
            call.reject("Print failed: " + e.getMessage());
        }
    }

    // ───── Print Base64 Image (for Arabic receipts) ─────

    @PluginMethod()
    public void printImage(PluginCall call) {
        try {
            DeviceConnection conn = createConnection(call);
            EscPosPrinter printer = createPrinter(call, conn);
            String base64 = call.getString("base64Image", "");
            boolean cut = call.getBoolean("cutPaper", false);
            boolean cashDrawer = call.getBoolean("openCashDrawer", false);

            byte[] imageBytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);

            String hexImage = PrinterTextParserImg
                    .bitmapToHexadecimalString(printer, bitmap, false);
            String printData = "[C]<img>" + hexImage + "</img>\n";

            if (cashDrawer) {
                printer.printFormattedTextAndOpenCashBox(printData, 20f);
            } else if (cut) {
                printer.printFormattedTextAndCut(printData, 20f);
            } else {
                printer.printFormattedText(printData, 20f);
            }

            printer.disconnectPrinter();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Image print failed", e);
            call.reject("Image print failed: " + e.getMessage());
        }
    }

    // ───── Utility Commands ─────

    @PluginMethod()
    public void cutPaper(PluginCall call) {
        try {
            DeviceConnection conn = createConnection(call);
            EscPosPrinter printer = createPrinter(call, conn);
            printer.printFormattedTextAndCut("\n", 0f);
            printer.disconnectPrinter();
            call.resolve();
        } catch (Exception e) {
            call.reject("Cut failed: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void openCashDrawer(PluginCall call) {
        try {
            DeviceConnection conn = createConnection(call);
            EscPosPrinter printer = createPrinter(call, conn);
            printer.printFormattedTextAndOpenCashBox("\n", 0f);
            printer.disconnectPrinter();
            call.resolve();
        } catch (Exception e) {
            call.reject("Cash drawer failed: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void testConnection(PluginCall call) {
        try {
            DeviceConnection conn = createConnection(call);
            conn.connect();
            conn.disconnect();
            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("message", "Connection successful");
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("connected", false);
            ret.put("message", "Connection failed: " + e.getMessage());
            call.resolve(ret);
        }
    }
}
```

### Register the plugin in `MainActivity.java`

Edit **`android/app/src/main/java/com/yourcompany/erppos/MainActivity.java`**:

```java
package com.yourcompany.erppos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.yourcompany.erppos.plugins.ThermalPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPrinterPlugin.class); // MUST be before super.onCreate()
        super.onCreate(savedInstanceState);
    }
}
```

**This registration pattern is identical across Capacitor 3 through 8.** Only local (non-npm) plugins need manual registration; npm-installed plugins are auto-discovered.

---

## Bluetooth Classic is the right choice for thermal printers

**Virtually all ESC/POS thermal receipt printers use Bluetooth Classic SPP (Serial Port Profile)**, not BLE. SPP provides higher throughput (up to 3 Mbps) and operates like a serial connection—ideal for streaming print data. BLE is designed for low-power configuration exchanges and lacks the bandwidth for receipt-sized payloads. Popular brands like Epson, HOIN, MUNBYN, XPrinter, and Bixolon all use Bluetooth Classic. The standard SPP UUID is `00001101-0000-1000-8000-00805F9B34FB`.

### Android 12+ permission changes for Bluetooth

Android 12 (API 31) replaced the old `BLUETOOTH` and `BLUETOOTH_ADMIN` permissions with three new **runtime** permissions: **`BLUETOOTH_SCAN`** (discover devices), **`BLUETOOTH_CONNECT`** (connect and access names/MACs), and `BLUETOOTH_ADVERTISE` (make device visible). On Android 6–11, `ACCESS_FINE_LOCATION` was required for scanning because BLE scan results could reveal physical location. On Android 12+, adding `android:usesPermissionFlags="neverForLocation"` to `BLUETOOTH_SCAN` eliminates the location requirement entirely—thermal printer scanning has no location purpose. The `maxSdkVersion="30"` cap on the location and legacy Bluetooth permissions in the manifest means those permissions are requested only on older devices.

### Pairing and remembering printers

When a user selects a Bluetooth printer for the first time, Android handles pairing at the OS level. After pairing, the device appears in `BluetoothAdapter.getBondedDevices()` indefinitely (survives reboots). Your app should **save the MAC address** (e.g., in localStorage or your ERP database) and reconnect directly without scanning:

```java
// Reconnect to saved printer—no scan needed
BluetoothDevice device = adapter.getRemoteDevice("AA:BB:CC:DD:EE:FF");
BluetoothConnection btConn = new BluetoothConnection(device);
EscPosPrinter printer = new EscPosPrinter(btConn, 203, 48f, 32);
```

The `getPairedBluetoothPrinters()` plugin method returns all bonded devices so the user can pick from a list without initiating a full scan. This is faster and requires only `BLUETOOTH_CONNECT` (not `BLUETOOTH_SCAN`).

---

## USB printing with permission handling

USB Host Mode (OTG) has been supported since Android 3.1 and works on most modern devices with a USB-C to USB-A adapter. The DantSu library's `UsbConnection` and `UsbPrintersConnections` classes handle the low-level USB communication, but **USB permission must be explicitly requested** each time a device is connected (permissions are not persistent across reconnections).

The `usb_device_filter.xml` in the manifest triggers an auto-launch dialog when a matching USB printer is plugged in. If the user checks "Always open with this app," permission is granted automatically for that device. For programmatic permission requests, the flow uses `UsbManager.requestPermission()` with a `PendingIntent`:

```java
// Inside a plugin method that needs USB permission
UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
for (UsbDevice device : devices.values()) {
    if (!usbManager.hasPermission(device)) {
        PendingIntent pi = PendingIntent.getBroadcast(
            getContext(), 0,
            new Intent("com.yourcompany.erppos.USB_PERMISSION"),
            PendingIntent.FLAG_IMMUTABLE  // Required on API 31+
        );
        usbManager.requestPermission(device, pi);
    }
}
```

**`PendingIntent.FLAG_IMMUTABLE`** is mandatory on API 31+; omitting it causes a crash. The DantSu `UsbPrintersConnections.selectFirstConnected()` method handles all of this internally for the simple case—it returns the first USB printer that already has permission granted.

---

## TCP/WiFi printing to port 9100

Network printing is the simplest connection type. ESC/POS network printers listen on **TCP port 9100** (the JetDirect/RAW protocol port). The DantSu `TcpConnection` class opens a raw TCP socket and streams ESC/POS bytes directly:

```java
TcpConnection conn = new TcpConnection("192.168.1.100", 9100, 15); // 15s timeout
EscPosPrinter printer = new EscPosPrinter(conn, 203, 48f, 32);
printer.printFormattedTextAndCut(
    "[C]<font size='big'>RECEIPT</font>\n" +
    "[L]Item 1[R]25.00 SAR\n"
);
printer.disconnectPrinter();
```

Since Capacitor plugin methods run on a background thread (`CapacitorPlugins` thread) by default, network calls work without additional threading. The `timeout` parameter (in seconds) prevents the app from hanging if a printer is unreachable. For network discovery, printers can be found via mDNS/Bonjour or simple IP range scanning, but most branch deployments use static IPs configured in the ERP system—this is the more practical approach for fixed retail installations.

---

## Arabic text requires the bitmap approach

### Why code pages fail for Arabic

ESC/POS printers are fundamentally left-to-right, fixed-width-glyph devices. The code page approach (`ESC t 0x28` for WPC1256/Windows-1256) technically maps Arabic Unicode codepoints to printer glyphs, but it fails in three critical ways: **no RTL reordering** (text prints reversed), **no contextual shaping** (Arabic letters have four forms—isolated, initial, medial, final—and the printer cannot select the correct form), and **inconsistent support across manufacturers** (the code page ID varies between Epson, Star, and Chinese clones). The DantSu library supports `EscPosCharsetEncoding("windows-1256", 50)` but the results are unreliable.

### The bitmap approach: render on Android, print as image

**Render the entire receipt as a bitmap on Android** and send it as a raster image. Android's text rendering engine handles RTL, BiDi, and contextual glyph shaping perfectly. This produces pixel-perfect Arabic output on any printer that supports image printing (all modern ESC/POS printers do). Here is a helper method to add to your plugin:

```java
/**
 * Renders Arabic (or mixed Arabic/English) text as a Bitmap.
 * Android handles RTL, BiDi, and Arabic glyph shaping natively.
 */
private Bitmap renderTextToBitmap(String text, int widthPx, float textSizePx) {
    TextPaint paint = new TextPaint();
    paint.setColor(Color.BLACK);
    paint.setTextSize(textSizePx);
    paint.setAntiAlias(true);
    paint.setTypeface(android.graphics.Typeface.DEFAULT);

    // StaticLayout handles RTL, line-wrapping, and Arabic shaping
    StaticLayout layout = StaticLayout.Builder
            .obtain(text, 0, text.length(), paint, widthPx)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setLineSpacing(0f, 1.0f)
            .build();

    Bitmap bitmap = Bitmap.createBitmap(widthPx, layout.getHeight(),
            Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(bitmap);
    canvas.drawColor(Color.WHITE);
    layout.draw(canvas);
    return bitmap;
}
```

Usage inside a `@PluginMethod`:

```java
@PluginMethod()
public void printArabicReceipt(PluginCall call) {
    try {
        DeviceConnection conn = createConnection(call);
        int dpi = call.getInt("printerDpi", 203);
        float widthMM = call.getFloat("printerWidthMM", 48f);
        int charsPerLine = call.getInt("printerNbrCharPerLine", 32);
        EscPosPrinter printer = new EscPosPrinter(conn, dpi, widthMM, charsPerLine);

        String receiptText = call.getString("text", "");
        // 384px = 58mm at 203 DPI; 576px = 80mm at 203 DPI
        int widthPx = (int)(widthMM / 25.4f * dpi);
        Bitmap bmp = renderTextToBitmap(receiptText, widthPx, 28f);

        String hex = PrinterTextParserImg
                .bitmapToHexadecimalString(printer, bmp, false);
        printer.printFormattedTextAndCut("[C]<img>" + hex + "</img>\n");
        printer.disconnectPrinter();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    } catch (Exception e) {
        call.reject("Arabic print failed: " + e.getMessage());
    }
}
```

**For tall receipts** with many lines, split the bitmap into horizontal strips of ~200px height and send each strip sequentially. This prevents buffer overflow on cheaper printers with limited memory.

### Practical printer width reference

| Paper Width | Printable Width | Pixels at 203 DPI | Chars/Line |
|---|---|---|---|
| 58mm | ~48mm | **384px** | 32 |
| 80mm | ~72mm | **576px** | 48 |

---

## How the web ERP calls the native plugin

### Detecting the Capacitor environment

Your remote web app needs to check whether it's running inside the Capacitor shell or a regular browser. The Capacitor bridge is injected into the WebView when using `server.url`, making `window.Capacitor` available:

```typescript
import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform(); // true on Android/iOS
}

export function getPlatform(): string {
  return Capacitor.getPlatform(); // 'android', 'ios', or 'web'
}

// More defensive check (works even if @capacitor/core isn't loaded)
export function hasNativeBridge(): boolean {
  return typeof (window as any).Capacitor !== 'undefined'
      && (window as any).Capacitor.isNativePlatform?.() === true;
}
```

### Complete receipt printing example from React/Vue/Angular

This example works with any framework. Create a printer service:

```typescript
// src/services/printer.service.ts
import { Capacitor } from '@capacitor/core';
import ThermalPrinter, { type PrintOptions } from '../plugins/ThermalPrinter';

interface ReceiptItem {
  name: string;
  nameAr?: string;  // Arabic name
  qty: number;
  price: number;
}

interface ReceiptData {
  invoiceNo: string;
  date: string;
  items: ReceiptItem[];
  total: number;
  vatAmount: number;
  companyNameAr: string;  // e.g. "شركة الحلويات والألعاب"
  branchNameAr: string;
  vatNumber: string;
}

// Saved printer config (store in localStorage or ERP settings)
interface PrinterConfig {
  connectionType: 'bluetooth' | 'tcp' | 'usb';
  address: string;
  port?: number;
  paperWidth: 58 | 80;
}

export class PrinterService {
  private config: PrinterConfig | null = null;

  setConfig(config: PrinterConfig) {
    this.config = config;
    localStorage.setItem('printerConfig', JSON.stringify(config));
  }

  getConfig(): PrinterConfig | null {
    if (!this.config) {
      const saved = localStorage.getItem('printerConfig');
      if (saved) this.config = JSON.parse(saved);
    }
    return this.config;
  }

  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    const result = await ThermalPrinter.requestBluetoothPermissions();
    return result.granted;
  }

  async discoverPrinters() {
    if (!Capacitor.isNativePlatform()) return [];
    const [bt, usb] = await Promise.all([
      ThermalPrinter.getPairedBluetoothPrinters(),
      ThermalPrinter.getUsbPrinters(),
    ]);
    return [...bt.devices, ...usb.devices];
  }

  async testPrinter(): Promise<{ connected: boolean; message: string }> {
    const cfg = this.getConfig();
    if (!cfg) return { connected: false, message: 'No printer configured' };
    return ThermalPrinter.testConnection({
      connectionType: cfg.connectionType,
      address: cfg.address,
      port: cfg.port,
    });
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // Browser fallback
      window.print();
      return;
    }

    const cfg = this.getConfig();
    if (!cfg) throw new Error('No printer configured');

    const is80mm = cfg.paperWidth === 80;
    const chars = is80mm ? 48 : 32;
    const widthMM = is80mm ? 72 : 48;

    // Build formatted text using DantSu markup
    let text = '';
    text += `[C]<font size='big'>${data.companyNameAr}</font>\n`;
    text += `[C]${data.branchNameAr}\n`;
    text += `[C]VAT: ${data.vatNumber}\n`;
    text += `[L]\n`;
    text += `[C]<b>Invoice #${data.invoiceNo}</b>\n`;
    text += `[C]${data.date}\n`;
    text += `[L]${'-'.repeat(chars)}\n`;

    for (const item of data.items) {
      const lineTotal = (item.qty * item.price).toFixed(2);
      text += `[L]${item.name}[R]${lineTotal} SAR\n`;
      text += `[L]  ${item.qty} x ${item.price.toFixed(2)}\n`;
    }

    text += `[L]${'-'.repeat(chars)}\n`;
    text += `[L]<b>VAT (15%)</b>[R]${data.vatAmount.toFixed(2)} SAR\n`;
    text += `[L]<b>TOTAL</b>[R]<font size='big'>${data.total.toFixed(2)} SAR</font>\n`;
    text += `[L]\n`;
    text += `[C]<qrcode size='20'>${data.vatNumber}|${data.invoiceNo}|${data.total}</qrcode>\n`;
    text += `[C]Thank you! شكراً لك\n`;

    await ThermalPrinter.printFormatted({
      connectionType: cfg.connectionType,
      address: cfg.address,
      port: cfg.port,
      printerDpi: 203,
      printerWidthMM: widthMM,
      printerNbrCharPerLine: chars,
      text: text,
      cutPaper: true,
      openCashDrawer: true,
    });
  }

  async openDrawer(): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('No printer configured');
    await ThermalPrinter.openCashDrawer({
      connectionType: cfg.connectionType,
      address: cfg.address,
      port: cfg.port,
    });
  }
}

export const printerService = new PrinterService();
```

### Using it in a React component

```tsx
import { printerService } from '../services/printer.service';

function InvoicePage({ invoice }: { invoice: InvoiceData }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printerService.printReceipt({
        invoiceNo: invoice.number,
        date: new Date().toLocaleString('ar-SA'),
        items: invoice.items,
        total: invoice.total,
        vatAmount: invoice.vatAmount,
        companyNameAr: 'شركة الحلويات والألعاب',
        branchNameAr: 'فرع الرياض - حي العليا',
        vatNumber: '300012345600003',
      });
    } catch (err) {
      alert('Print failed: ' + (err as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  return <button onClick={handlePrint} disabled={printing}>
    {printing ? 'Printing...' : 'Print Receipt'}
  </button>;
}
```

### DantSu formatted text markup reference

| Markup | Effect |
|---|---|
| `[L]`, `[C]`, `[R]` | Left/center/right alignment (use multiple per line for columns) |
| `<b>text</b>` | Bold |
| `<u>text</u>` | Underline |
| `<font size='big'>` | Double width + height |
| `<font size='wide'>` | Double width |
| `<font size='tall'>` | Double height |
| `<barcode type='128'>DATA</barcode>` | Code 128 barcode |
| `<barcode type='ean13'>831254784551</barcode>` | EAN-13 barcode |
| `<qrcode size='20'>DATA</qrcode>` | QR code (size in mm) |
| `<img>HEX</img>` | Print hex-encoded raster image |

---

## Building, signing, and deploying the APK

### Build pipeline from start to finish

```bash
# 1. Build web assets (even minimal, needed for Capacitor sync)
npm run build

# 2. Sync everything to Android project
npx cap sync android

# 3. Create a release keystore (one-time)
keytool -genkeypair -v -storetype PKCS12 \
  -keystore erppos-release.keystore -alias erppos \
  -keyalg RSA -keysize 2048 -validity 10000

# 4. Build signed APK for sideloading to branch devices
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# 5. Or build AAB for Google Play
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Configure signing in `android/app/build.gradle`

Create **`android/keystore.properties`** (add to `.gitignore`):

```properties
storePassword=your_secure_password
keyPassword=your_key_password
keyAlias=erppos
storeFile=./../../erppos-release.keystore
```

Add to **`android/app/build.gradle`**:

```groovy
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

### Sideload to branch devices via ADB

```bash
# Enable Developer Options: Settings → About Phone → tap Build Number 7 times
# Enable USB Debugging in Developer Options
# Connect device via USB, approve the dialog on the phone

adb devices                              # Verify connection
adb install -r app-release.apk          # Install/update
adb install -r --user 0 app-release.apk # If multi-user device
```

For remote branches, you can also distribute via **Firebase App Distribution**, email the APK directly, or host it on an internal download page.

### Auto-updates are built into the remote URL model

Since your app loads the ERP from a remote URL, **all web content updates deploy instantly** by updating your server—no app store submission needed. Users see the latest version on every launch. Only changes to the native shell (new plugin methods, permission changes, SDK updates) require distributing a new APK. For those rare native updates, increment `versionCode` in `build.gradle` and redistribute.

---

## Capacitor plugin vs raw @JavascriptInterface

This is the most important architectural decision for your use case. Both approaches work, but they serve different scenarios.

**The Capacitor plugin approach** provides structured TypeScript interfaces, built-in permission lifecycle management, automatic background threading, and a Promise-based async pattern. It is the right choice when you want cross-platform potential (iOS later), clean separation between web and native code, and Capacitor's plugin ecosystem for other features (camera, push notifications, app updates). The downside: Capacitor's bridge injection into a remote URL is documented as "not intended for production" and may behave inconsistently if the WebView navigates away from the configured `server.url` domain.

**The raw `@JavascriptInterface` approach** creates a plain Android `WebView`, calls `addJavascriptInterface(bridge, "NativeBridge")`, and exposes methods as `window.NativeBridge.methodName()`. This is fundamentally more reliable for remote URL apps because the interface is injected into every page the WebView loads regardless of navigation. It requires no framework and gives complete control over the WebView. The downsides: methods are synchronous by default (async requires manual callback gymnastics), no TypeScript types, no built-in permission handling, and security concerns (the bridge is exposed to all frames including iframes).

**For your specific case**—a remote web ERP with native printing—the **Capacitor plugin approach is the better choice** for these reasons:

- **Bridge reliability with `server.url`**: When Capacitor manages the WebView and the remote URL is set via `server.url` (not via navigation/redirect), the bridge is injected correctly and `Capacitor.isNativePlatform()` returns `true`. The caveat about bridge loss applies only when the WebView navigates to an *external* URL not configured as the primary content.
- **Permission management**: Bluetooth and USB permissions involve complex runtime flows with callbacks. Capacitor's `@Permission`/`@PermissionCallback` system handles this cleanly. Building this from scratch with `@JavascriptInterface` requires significant boilerplate.
- **Background threading**: Capacitor plugin methods run on a dedicated `CapacitorPlugins` thread. With `@JavascriptInterface`, you must manually manage threads for every Bluetooth/TCP operation.
- **Future expansion**: Adding push notifications, camera scanning, biometric auth, or iOS support later becomes trivial with the Capacitor ecosystem.
- **Maintainability**: The TypeScript plugin definition serves as a contract between the web and native teams. Changes to the interface are caught at compile time.

The one scenario where `@JavascriptInterface` wins: if the ERP needs to navigate between multiple third-party domains during a session. In that case, the Capacitor bridge may not survive cross-domain navigation, and `@JavascriptInterface` is the safer bet. For a single-domain ERP loaded via `server.url`, Capacitor is superior.

---

## Conclusion: what makes this architecture production-ready

The combination of **Capacitor 8.1.0 + DantSu ESCPOS v3.4.0** gives you a mature, well-tested stack. Three decisions will determine printing quality across your Saudi branches: always use the **bitmap rendering approach** for Arabic text (never code pages), default to **Bluetooth Classic SPP** for portable printers and **TCP port 9100** for fixed counter printers, and save paired printer MAC addresses in your ERP database so branch staff never need to re-scan.

The DantSu library does **not** provide built-in printer status checks (paper out, cover open)—this is an open feature request. For production, implement a try/catch around every print call and surface the error to the user with a retry option. The `testConnection()` method in the plugin verifies reachability before printing, which catches most real-world failures.

Your web ERP auto-updates instantly because it's server-hosted. Native shell updates (new plugin methods, SDK bumps) happen infrequently—push those via ADB sideload or Firebase App Distribution to branch devices. The entire build-to-device pipeline runs in four commands: `npm run build`, `npx cap sync android`, `./gradlew assembleRelease`, `adb install`.