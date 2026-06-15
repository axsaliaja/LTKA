"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadModels, detectFace } from "@/lib/faceapi";
import { averageEAR, BlinkDetector } from "@/lib/liveness";

export interface CaptureResult {
  descriptor: number[];
  photo: string | null; // data-URL JPEG
  livenessPassed: boolean;
}

interface Props {
  /** Number of blinks required before auto-capture. 0 = no liveness (enroll). */
  requiredBlinks?: number;
  /** Label for the manual capture button (only shown when requiredBlinks === 0). */
  captureLabel?: string;
  /** Called once a descriptor (and liveness, if required) is obtained. */
  onResult: (result: CaptureResult) => void;
  /** Disable interaction (e.g. while submitting). */
  disabled?: boolean;
}

/**
 * Live-camera face capture. INPUT IS CAMERA-ONLY — there is intentionally no
 * <input type="file"> anywhere in this component. When requiredBlinks > 0 it
 * runs an EAR-based blink liveness challenge and auto-captures after the user
 * blinks the required number of times.
 */
export default function CameraCapture({
  requiredBlinks = 0,
  captureLabel = "Ambil Wajah",
  onResult,
  disabled = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blinkRef = useRef(new BlinkDetector());
  const rafRef = useRef<number>();
  const capturedRef = useRef(false);

  const [status, setStatus] = useState("Memuat model & kamera…");
  const [faceVisible, setFaceVisible] = useState(false);
  const [blinks, setBlinks] = useState(0);
  const [ready, setReady] = useState(false);

  const liveness = requiredBlinks > 0;

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const doCapture = useCallback(
    async (livenessPassed: boolean, stopLoop: boolean) => {
      const video = videoRef.current;
      if (!video) return;
      const det = await detectFace(video);
      if (!det) {
        setStatus("Wajah tidak terdeteksi saat menangkap. Coba lagi.");
        return;
      }
      // Only liveness auto-capture freezes the loop; manual enroll capture
      // stays live so the user can re-take.
      if (stopLoop) capturedRef.current = true;
      const photo = captureFrame();
      onResult({ descriptor: det.descriptor, photo, livenessPassed });
    },
    [captureFrame, onResult]
  );

  // Detection loop.
  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || capturedRef.current) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const det = await detectFace(video);
    if (det) {
      setFaceVisible(true);
      if (liveness) {
        const ear = averageEAR(det.landmarks);
        blinkRef.current.update(ear);
        const count = blinkRef.current.blinks;
        setBlinks(count);
        if (count >= requiredBlinks) {
          setStatus("Liveness lolos — menangkap wajah…");
          await doCapture(true, true);
          return; // stop loop after capture
        } else {
          setStatus(`Kedipkan mata ${requiredBlinks}× (${count}/${requiredBlinks})`);
        }
      } else {
        setStatus("Wajah terdeteksi. Tekan tombol untuk menangkap.");
      }
    } else {
      setFaceVisible(false);
      setStatus("Posisikan wajah di dalam bingkai.");
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [liveness, requiredBlinks, doCapture]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadModels();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        setStatus(liveness ? `Kedipkan mata ${requiredBlinks}×` : "Posisikan wajah di dalam bingkai.");
        rafRef.current = requestAnimationFrame(loop);
      } catch (e: any) {
        setStatus(
          "Gagal mengakses kamera. Pastikan izin kamera diberikan dan halaman memakai HTTPS. " +
            (e?.message ?? "")
        );
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-md">
      <div className="relative overflow-hidden rounded-lg border border-hairline bg-surface-card">
        <video
          ref={videoRef}
          className="block h-[360px] w-[480px] max-w-full -scale-x-100 object-cover"
          playsInline
          muted
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-card text-body-sm text-muted">
            Memuat…
          </div>
        )}
      </div>

      <p className="text-center text-body-sm text-body" aria-live="polite">
        {status}
      </p>

      {liveness ? (
        <div className="flex items-center gap-xs text-caption text-muted">
          <span>Kedipan terdeteksi:</span>
          <span className="font-mono font-semibold text-ink">
            {blinks}/{requiredBlinks}
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary"
          disabled={disabled || !faceVisible}
          onClick={() => doCapture(false, false)}
        >
          {captureLabel}
        </button>
      )}
    </div>
  );
}
