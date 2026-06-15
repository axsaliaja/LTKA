import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

/**
 * S3 client. On EC2 the LabInstanceProfile supplies credentials automatically
 * via the instance metadata service, so we do NOT set accessKeyId/secretKey.
 * Locally, credentials come from the standard AWS credential chain.
 */
const s3 = new S3Client({ region: config.s3.region });

/**
 * Upload a base64 / data-URL JPEG enrollment photo to a private S3 object.
 * Returns the object key (stored in students.photo_s3_key).
 */
export async function uploadEnrollmentPhoto(
  studentId: string,
  dataUrl: string
): Promise<string | null> {
  if (!config.s3.bucket || !dataUrl) return null;

  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  const ext = contentType === "image/png" ? "png" : "jpg";
  const key = `enroll/${studentId}/${Date.now()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Bucket is private; access is only via presigned URLs.
    })
  );
  return key;
}

/**
 * Upload an attendance snapshot (the live photo taken at check-in) to S3.
 * Returns the object key (stored in attendances.photo_s3_key).
 */
export async function uploadAttendancePhoto(
  sessionId: number,
  userId: number,
  dataUrl: string
): Promise<string | null> {
  if (!config.s3.bucket || !dataUrl) return null;

  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = contentType === "image/png" ? "png" : "jpg";
  const key = `attendance/${sessionId}/${userId}_${Date.now()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key;
}

/** Generate a short-lived presigned GET URL for a private enrollment photo. */
export async function getPhotoUrl(key: string): Promise<string | null> {
  if (!config.s3.bucket || !key) return null;
  const cmd = new GetObjectCommand({ Bucket: config.s3.bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: config.s3.presignExpires });
}
