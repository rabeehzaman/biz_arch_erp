package com.bizarch.mobile.plugins;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.exceptions.EscPosConnectionException;

import java.io.IOException;

/**
 * Extends DantSu's BluetoothConnection with a reflection-based RFCOMM
 * fallback for cheap Chinese printers where SDP lookup fails.
 * Uses createRfcommSocket(1) to bypass SDP and connect directly to
 * RFCOMM channel 1 (the default for SPP thermal printers).
 */
public class ReflectionBluetoothConnection extends BluetoothConnection {

    private BluetoothSocket reflectionSocket;

    public ReflectionBluetoothConnection(BluetoothDevice device) {
        super(device);
    }

    @SuppressLint("MissingPermission")
    @Override
    public BluetoothConnection connect() throws EscPosConnectionException {
        if (this.isConnected()) return this;

        BluetoothDevice device = this.getDevice();
        if (device == null) {
            throw new EscPosConnectionException("Bluetooth device is null.");
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter != null) {
            adapter.cancelDiscovery();
        }

        try {
            reflectionSocket = (BluetoothSocket) device.getClass()
                    .getMethod("createRfcommSocket", new Class[]{int.class})
                    .invoke(device, 1);
            reflectionSocket.connect();
            this.outputStream = reflectionSocket.getOutputStream();
        } catch (Exception e) {
            if (reflectionSocket != null) {
                try { reflectionSocket.close(); } catch (IOException ignored) {}
                reflectionSocket = null;
            }
            throw new EscPosConnectionException(
                    "Reflection Bluetooth connect failed: " + e.getMessage());
        }
        return this;
    }

    @Override
    public BluetoothConnection disconnect() {
        super.disconnect();
        if (reflectionSocket != null) {
            try { reflectionSocket.close(); } catch (IOException ignored) {}
            reflectionSocket = null;
        }
        return this;
    }

    @Override
    public boolean isConnected() {
        return reflectionSocket != null && reflectionSocket.isConnected();
    }
}
