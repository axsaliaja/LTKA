"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadModels, detectFace } from "@/lib/faceapi";

export interface CaptureResult {
  descriptor: number[];
  photo: string | null; // data-URL JPEG
}

interface Props {
  /** Label for the capture button. */
  captureLabel?: string;
  /** Called once a face descriptor + snapshot is obtained. */
  onResult: (result: CaptureResult) => void;
  /** Disable interaction (e.g. while submitting). */
  disabled?: boolean;
}

/**
 * Live-camera face capture. INPUT IS CAMERA-ONLY — there is intentionally no
 * <input type="file"> here. A face-api.js loop enables the capture button only
 * when a face is visible; capturing computes the 128-d descriptor + a JPEG
 * snapshot. (No liveness challenge — matches the SIHADIR flow.)
 */
export default function CameraCapture({
  captureLabel = "Ambil Foto",
  onResult,
  disabled = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();

  const [status, setStatus] = useState("Memuat model & kamera…");
  const [faceVisible, setFaceVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const doCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    setStatus("Memproses wajah…");
    const det = await detectFace(video);
    if (!det) {
      setStatus("Wajah tidak terdeteksi saat menangkap. Coba lagi.");
      setBusy(false);
      return;
    }
    const photo = captureFrame();
    onResult({ descriptor: det.descriptor, photo });
    setBusy(false);
  }, [captureFrame, onResult]);

  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const det = await detectFace(video);
    if (det) {
      setFaceVisible(true);
      setStatus("Wajah terdeteksi. Tekan tombol untuk menangkap.");
    } else {
      setFaceVisible(false);
      setStatus("Posisikan wajah di dalam bingkai.");
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

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
        setStatus("Posisikan wajah di dalam bingkai.");
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-bg">
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 object-cover"
          playsInline
          muted
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-[0.85rem] text-muted">
            Memuat…
          </div>
        )}
      </div>

      <p className="text-center text-[0.85rem] text-muted" aria-live="polite">
        {status}
      </p>

      <button
        type="button"
        className="btn-primary btn-full"
        disabled={disabled || busy || !faceVisible}
        onClick={doCapture}
      >
        {captureLabel}
      </button>
    </div>
  );
}
