"use client";

import type { faceapi } from "./faceapi";
import type { FaceLandmarks68 } from "face-api.js";

/**
 * Eye Aspect Ratio (EAR) based blink detection.
 *
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * For an open eye EAR is ~0.3; during a blink it drops sharply (< ~0.2).
 * A blink = EAR crosses below CLOSED_THRESHOLD then back above OPEN_THRESHOLD.
 */

const CLOSED_THRESHOLD = 0.2;
const OPEN_THRESHOLD = 0.25;

function dist(a: faceapi.Point, b: faceapi.Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(eye: faceapi.Point[]): number {
  // 6 points per eye (face-api 68-landmark layout).
  const A = dist(eye[1], eye[5]);
  const B = dist(eye[2], eye[4]);
  const C = dist(eye[0], eye[3]);
  return (A + B) / (2 * C);
}

export function averageEAR(landmarks: FaceLandmarks68): number {
  const left = landmarks.getLeftEye();
  const right = landmarks.getRightEye();
  return (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
}

/**
 * Stateful blink counter. Feed it EAR values over successive frames;
 * it increments `blinks` each time a full close→open cycle completes.
 */
export class BlinkDetector {
  private eyeClosed = false;
  blinks = 0;

  /** Returns true when a new blink just completed on this frame. */
  update(ear: number): boolean {
    if (ear < CLOSED_THRESHOLD) {
      this.eyeClosed = true;
      return false;
    }
    if (ear > OPEN_THRESHOLD && this.eyeClosed) {
      this.eyeClosed = false;
      this.blinks += 1;
      return true;
    }
    return false;
  }

  reset() {
    this.eyeClosed = false;
    this.blinks = 0;
  }
}
