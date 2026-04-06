package com.bizarch.mobile.plugins;

import android.app.Activity;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "PdfPrinter")
public class PdfPrinterPlugin extends Plugin {
    private static final String TAG = "PdfPrinter";

    @PluginMethod
    public void print(PluginCall call) {
        String base64Data = call.getString("data", "");
        String jobName = call.getString("jobName", "Document");

        if (base64Data.isEmpty()) {
            call.reject("PDF data is required", "MISSING_DATA");
            return;
        }

        byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid base64 data", "INVALID_DATA");
            return;
        }

        try {
            File tempFile = new File(getContext().getCacheDir(), "print_temp.pdf");
            FileOutputStream fos = new FileOutputStream(tempFile);
            fos.write(pdfBytes);
            fos.close();

            // PrintManager must be called on UI thread
            getActivity().runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getActivity()
                            .getSystemService(Activity.PRINT_SERVICE);

                    printManager.print(jobName, new PrintDocumentAdapter() {
                        @Override
                        public void onLayout(PrintAttributes oldAttributes,
                                             PrintAttributes newAttributes,
                                             CancellationSignal cancellationSignal,
                                             LayoutResultCallback callback,
                                             Bundle extras) {
                            if (cancellationSignal.isCanceled()) {
                                callback.onLayoutCancelled();
                                return;
                            }

                            PrintDocumentInfo info = new PrintDocumentInfo
                                    .Builder(jobName + ".pdf")
                                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                    .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                                    .build();
                            callback.onLayoutFinished(info, true);
                        }

                        @Override
                        public void onWrite(PageRange[] pages,
                                            ParcelFileDescriptor destination,
                                            CancellationSignal cancellationSignal,
                                            WriteResultCallback callback) {
                            try {
                                FileInputStream input = new FileInputStream(tempFile);
                                FileOutputStream output = new FileOutputStream(
                                        destination.getFileDescriptor());

                                byte[] buf = new byte[8192];
                                int bytesRead;
                                while ((bytesRead = input.read(buf)) > 0) {
                                    if (cancellationSignal.isCanceled()) {
                                        callback.onWriteCancelled();
                                        input.close();
                                        output.close();
                                        return;
                                    }
                                    output.write(buf, 0, bytesRead);
                                }

                                input.close();
                                output.close();
                                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                            } catch (Exception e) {
                                Log.e(TAG, "Error writing print document", e);
                                callback.onWriteFailed(e.getMessage());
                            }
                        }

                        @Override
                        public void onFinish() {
                            tempFile.delete();
                        }
                    }, null);

                    call.resolve(new JSObject().put("success", true));
                } catch (Exception e) {
                    call.reject("Print failed: " + e.getMessage(), "PRINT_ERROR");
                }
            });
        } catch (Exception e) {
            call.reject("Failed to prepare print data: " + e.getMessage(), "PRINT_ERROR");
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String base64Data = call.getString("data", "");
        String filename = call.getString("filename", "document.pdf");

        if (base64Data.isEmpty()) {
            call.reject("PDF data is required", "MISSING_DATA");
            return;
        }

        byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid base64 data", "INVALID_DATA");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ — use MediaStore, no permissions needed
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                Uri uri = getContext().getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                if (uri == null) {
                    call.reject("Failed to create download entry", "DOWNLOAD_ERROR");
                    return;
                }

                OutputStream os = getContext().getContentResolver().openOutputStream(uri);
                if (os == null) {
                    call.reject("Failed to open output stream", "DOWNLOAD_ERROR");
                    return;
                }
                os.write(pdfBytes);
                os.close();

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("uri", uri.toString());
                call.resolve(result);
            } else {
                // Android 9 and below — save to app-specific external dir (no permission needed)
                File downloadsDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (downloadsDir == null) {
                    call.reject("Downloads directory not available", "DOWNLOAD_ERROR");
                    return;
                }
                downloadsDir.mkdirs();

                File file = new File(downloadsDir, filename);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(pdfBytes);
                fos.close();

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("path", file.getAbsolutePath());
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Download failed: " + e.getMessage(), "DOWNLOAD_ERROR");
        }
    }
}
