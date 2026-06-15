# face-api.js model weights

The browser loads model weights from this folder (`/models`). They are **not**
committed to git (too large). Download them once before running `npm run dev`
and before deploying to Vercel.

## Required files

This app uses three models (see `frontend/lib/faceapi.ts`):

- **TinyFaceDetector** — `tiny_face_detector_model-weights_manifest.json` + `tiny_face_detector_model-shard1`
- **FaceLandmark68Net** — `face_landmark_68_model-weights_manifest.json` + `face_landmark_68_model-shard1`
- **FaceRecognitionNet** — `face_recognition_model-weights_manifest.json` + `face_recognition_model-shard1` + `face_recognition_model-shard2`

## Download

Get them from the official face-api.js weights directory:
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

### Quick download (PowerShell)

```powershell
$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$files = @(
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2"
)
foreach ($f in $files) { Invoke-WebRequest "$base/$f" -OutFile $f }
```

### Quick download (bash / curl)

```bash
base="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
for f in \
  tiny_face_detector_model-weights_manifest.json tiny_face_detector_model-shard1 \
  face_landmark_68_model-weights_manifest.json face_landmark_68_model-shard1 \
  face_recognition_model-weights_manifest.json face_recognition_model-shard1 face_recognition_model-shard2; do
  curl -L -O "$base/$f"
done
```

Run either snippet from inside `frontend/public/models/`.
