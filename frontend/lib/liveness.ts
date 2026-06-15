"use client";

import type { faceapi } from "./faceapi";
import type { FaceLandmarks68 } from "face-api.js";

/**
 * Eye Aspect Ratio (EAR) based blink detection.
 *
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * For an open eye EAR is relatively high; during a blink it drops sharply.
 *
 * Absolute thresholds don't generalise across faces / cameras / lighting, so
 * we detect a blink RELATIVE to a per-user open-eye baseline (a slow EMA of
 * recent EAR, which is dominated by the open state since blinks are brief).
 * A blink = EAR dips below `baseline * CLOSED_RATIO`, then recovers above
 * `baseline * OPEN_RATIO`.
 */

const CLOSED_RATIO = 0.78; // dip below 78% of baseline => eye closing
const OPEN_RATIO = 0.9; //  back above 90% of baseline => eye opened
const BASELINE_EMA = 0.05; // how fast the open-eye baseline adapts

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

export class BlinkDetector {
  private eyeClosed = false;
  private baseline = 0; // 0 = not initialised yet
  blinks = 0;
  lastEar = 0;

  /** Returns true when a new blink just completed on this frame. */
  update(ear: number): boolean {
    this.lastEar = ear;

    // Initialise baseline on first reading.
    if (this.baseline === 0) {
      this.baseline = ear;
      return false;
    }

    // Adapt the open-eye baseline slowly toward incoming EAR. Only let it
    // rise quickly (eyes opening) and fall slowly, so a held-open eye sets the
    // reference and brief blinks don't drag it down.
    if (ear > this.baseline) {
      this.baseline = this.baseline * (1 - BASELINE_EMA * 3) + ear * (BASELINE_EMA * 3);
    } else {
      this.baseline = this.baseline * (1 - BASELINE_EMA) + ear * BASELINE_EMA;
    }

    const closedThresh = this.baseline * CLOSED_RATIO;
    const openThresh = this.baseline * OPEN_RATIO;

    if (ear < closedThresh) {
      this.eyeClosed = true;
      return false;
    }
    if (ear > openThresh && this.eyeClosed) {
      this.eyeClosed = false;
      this.blinks += 1;
      return true;
    }
    return false;
  }

  reset() {
    this.eyeClosed = false;
    this.baseline = 0;
    this.blinks = 0;
    this.lastEar = 0;
  }
}
