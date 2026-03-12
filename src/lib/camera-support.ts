export interface CameraAvailability {
  available: boolean;
  reason: string | null;
}

export function getCameraAvailability(label = "scanner"): CameraAvailability {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { available: false, reason: null };
  }

  const normalizedLabel = label === "IMEI scanner" ? "IMEI scanner" : "scanner";

  if (!window.isSecureContext) {
    return {
      available: false,
      reason:
        `This ${normalizedLabel} needs HTTPS or localhost on this device. ` +
        `If you opened the app from another phone using your computer's local IP, switch to HTTPS to use the camera.`,
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      available: false,
      reason:
        `This browser is not exposing camera access for the ${normalizedLabel}. ` +
        `On phones this usually means the page is running on HTTP instead of HTTPS.`,
    };
  }

  return { available: true, reason: null };
}
