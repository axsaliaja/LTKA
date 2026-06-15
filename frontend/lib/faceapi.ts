"use client";

import * as faceapi from "face-api.js";

/**
 * Lazy-loads the face-api.js model weights from /public/models exactly once.
 * See public/models/README.md for which files to download.
 */
let loaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_URL = "/models";

export async function loadModels(): Promise<void> {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    loaded = true;
  })();
  return loadingPromise;
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
});

export interface Detection {
  descriptor: number[];
  landmarks: faceapi.FaceLandmarks68;
}

/**
 * Detect a single face in the given video/canvas element and return its
 * 128-float descriptor + landmarks (for liveness EAR). Returns null if no face.
 */
export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<Detection | null> {
  const result = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;
  return {
    descriptor: Array.from(result.descriptor),
    landmarks: result.landmarks,
  };
}

export { faceapi };
