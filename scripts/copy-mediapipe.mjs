// Copies the MediaPipe Face Detection runtime + model from node_modules into
// public/mediapipe so the kiosk detects faces fully offline (no CDN at the venue).
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const src = dirname(require.resolve('@mediapipe/face_detection/package.json'));
const out = join(process.cwd(), 'public', 'mediapipe', 'face_detection');
mkdirSync(out, { recursive: true });

const files = [
  'face_detection.js',
  'face_detection_short.binarypb',
  'face_detection_short_range.tflite',
  'face_detection_solution_simd_wasm_bin.js',
  'face_detection_solution_simd_wasm_bin.wasm',
  'face_detection_solution_simd_wasm_bin.data',
  'face_detection_solution_wasm_bin.js',
  'face_detection_solution_wasm_bin.wasm',
];
for (const f of files) {
  const from = join(src, f);
  if (!existsSync(from)) throw new Error(`Missing ${from}`);
  copyFileSync(from, join(out, f));
}
console.log(`copied ${files.length} MediaPipe files → public/mediapipe/face_detection`);
