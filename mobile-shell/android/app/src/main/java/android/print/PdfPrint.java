package android.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;

import java.io.File;

/**
 * Helper to drive a PrintDocumentAdapter programmatically and write PDF output
 * to a file — without showing the system print dialog.
 *
 * Must live in the android.print package because LayoutResultCallback and
 * WriteResultCallback have package-private constructors.
 */
public class PdfPrint {

    private final PrintAttributes attributes;

    public interface Callback {
        void onSuccess(File file);
        void onFailure(String error);
    }

    public PdfPrint(PrintAttributes attributes) {
        this.attributes = attributes;
    }

    public void print(PrintDocumentAdapter adapter, File outputFile, Callback callback) {
        adapter.onStart();
        adapter.onLayout(null, attributes, new CancellationSignal(),
                new PrintDocumentAdapter.LayoutResultCallback() {
                    @Override
                    public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                        try {
                            outputFile.getParentFile().mkdirs();
                            outputFile.createNewFile();
                            ParcelFileDescriptor pfd = ParcelFileDescriptor.open(outputFile,
                                    ParcelFileDescriptor.MODE_READ_WRITE
                                            | ParcelFileDescriptor.MODE_CREATE
                                            | ParcelFileDescriptor.MODE_TRUNCATE);

                            adapter.onWrite(new PageRange[]{PageRange.ALL_PAGES}, pfd,
                                    new CancellationSignal(),
                                    new PrintDocumentAdapter.WriteResultCallback() {
                                        @Override
                                        public void onWriteFinished(PageRange[] pages) {
                                            try { pfd.close(); } catch (Exception ignored) {}
                                            adapter.onFinish();
                                            callback.onSuccess(outputFile);
                                        }

                                        @Override
                                        public void onWriteFailed(CharSequence error) {
                                            try { pfd.close(); } catch (Exception ignored) {}
                                            adapter.onFinish();
                                            callback.onFailure(error != null ? error.toString() : "Write failed");
                                        }
                                    });
                        } catch (Exception e) {
                            adapter.onFinish();
                            callback.onFailure(e.getMessage());
                        }
                    }

                    @Override
                    public void onLayoutFailed(CharSequence error) {
                        adapter.onFinish();
                        callback.onFailure(error != null ? error.toString() : "Layout failed");
                    }
                }, null);
    }
}
