/**
 * Euclidean distance between two face descriptors (128-d vectors produced by
 * face-api.js). A smaller distance means the faces are more similar.
 *
 * The same metric face-api.js uses internally for `faceMatcher`. We re-implement
 * it server-side so matching is authoritative and never trusts the client.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    // Mismatched/invalid descriptors -> treat as "infinitely far".
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Validate that a value is a plausible 128-float face descriptor. */
export function isValidDescriptor(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === 128 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
