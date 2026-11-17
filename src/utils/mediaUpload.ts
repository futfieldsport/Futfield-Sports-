/**
 * FUTFIELD Backend Media Upload & Exact MB Size Calculator
 * Uploads raw media files directly to the backend binary storage endpoint (/api/media/upload)
 * with zero frontend base64 conversion or blob URL persistence.
 */

export interface MediaTotalsSummary {
  imageCount: number;
  videoCount: number;
  totalFiles: number;
  totalImageBytes: number;
  totalVideoBytes: number;
  totalBytes: number;
  totalImageMb: number;
  totalVideoMb: number;
  totalMb: number;
}

export interface MediaUploadResult {
  url: string;
  success: boolean;
  status: 'UPLOADED' | 'ERROR';
  sizeBytes: number;
  sizeMb: number;
  mediaKind: 'image' | 'video' | 'audio';
  videoKind?: 'short' | 'video';
  aspectRatio?: '9:16' | '16:9';
  copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
  copyrightReport?: {
    status: 'CLEAR' | 'WARNING' | 'BLOCKED';
    riskLevel: 'none' | 'low' | 'high' | 'critical';
    confidenceScore: number;
    drmDetected: boolean;
    sha256: string;
    detectedClaims: Array<{ code: string; category: string; match: string; severity: string; reason: string }>;
    reason: string;
    scannedAt: string;
    engine: string;
  };
  totals?: MediaTotalsSummary;
  error?: string;
}

export interface VideoInspectionMetadata {
  duration: number;
  width: number;
  height: number;
  isVertical916: boolean;
  isLandscape169: boolean;
  videoKind: 'short' | 'video' | 'unsupported';
  detectedAspectRatio: '9:16' | '16:9' | 'unsupported';
  validationError?: string;
}

export type StorageBucket =
  | 'post-images'
  | 'post-videos'
  | 'videos'
  | 'futfield-videos'
  | 'video-thumbnails'
  | 'avatars'
  | 'match-chat-images'
  | 'match-chat-voices';

export function formatBytesToMb(bytes: number): number {
  if (!bytes || bytes <= 0) return 0;
  const mb = bytes / (1024 * 1024);
  return mb >= 0.01 ? +mb.toFixed(2) : +mb.toFixed(3);
}

export function classifyVideoDimensionsAndDuration(
  duration: number,
  width: number,
  height: number,
  mode: 'standard' | 'futube' = 'standard'
): VideoInspectionMetadata {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
  const maxQuickKickSeconds = mode === 'futube' ? 60 : 120;
  const maxLandscapeSeconds = mode === 'futube' ? 3600 : 180;

  if (width > 0 && height > 0) {
    const ratio = width / height;
    // Vertical / Portrait (~9:16 Quick Kick)
    if (ratio <= 0.85) {
      const validationError =
        safeDuration > maxQuickKickSeconds
          ? `Quick Kicks (vertical 9:16) must be ${maxQuickKickSeconds}s or less. Detected ${safeDuration}s.`
          : undefined;
      return {
        duration: safeDuration,
        width,
        height,
        isVertical916: true,
        isLandscape169: false,
        videoKind: 'short',
        detectedAspectRatio: '9:16',
        validationError,
      };
    }

    // Widescreen / Landscape (~16:9)
    if (ratio >= 1.15 || mode === 'futube') {
      const validationError =
        safeDuration > maxLandscapeSeconds
          ? `16:9 Football Clips cannot exceed ${Math.round(maxLandscapeSeconds / 60)} minutes. Detected ${safeDuration}s.`
          : undefined;
      return {
        duration: safeDuration,
        width,
        height,
        isVertical916: false,
        isLandscape169: true,
        videoKind: 'video',
        detectedAspectRatio: '16:9',
        validationError,
      };
    }

    return {
      duration: safeDuration,
      width,
      height,
      isVertical916: false,
      isLandscape169: false,
      videoKind: 'unsupported',
      detectedAspectRatio: 'unsupported',
      validationError: `Unsupported aspect ratio (${width}x${height}). Upload a 9:16 Vertical Quick Kick (≤ ${maxQuickKickSeconds}s) or a 16:9 Widescreen Clip.`,
    };
  }

  // Fallback when codec metadata isn't readable by browser
  if (safeDuration > maxLandscapeSeconds) {
    return {
      duration: safeDuration,
      width: 0,
      height: 0,
      isVertical916: false,
      isLandscape169: false,
      videoKind: 'unsupported',
      detectedAspectRatio: 'unsupported',
      validationError: `Video duration (${safeDuration}s) exceeds maximum allowed limit.`,
    };
  }

  const inferredKind = safeDuration > maxQuickKickSeconds ? 'video' : 'short';
  const inferredRatio = inferredKind === 'video' ? '16:9' : '9:16';
  return {
    duration: safeDuration,
    width: 0,
    height: 0,
    isVertical916: inferredKind === 'short',
    isLandscape169: inferredKind === 'video',
    videoKind: inferredKind,
    detectedAspectRatio: inferredRatio,
  };
}

/**
 * Inspect duration & dimensions locally and auto-detect 9:16 Quick Kick (<=60s in futube) vs 16:9 Video.
 */
export function inspectVideoMetadata(
  videoFile: File,
  mode: 'standard' | 'futube' = 'standard'
): Promise<VideoInspectionMetadata> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);
    video.preload = 'metadata';
    video.muted = true;
    video.src = objectUrl;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(classifyVideoDimensionsAndDuration(0, 0, 0, mode));
    }, 4500);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      resolve(classifyVideoDimensionsAndDuration(duration, width, height, mode));
    };

    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(classifyVideoDimensionsAndDuration(0, 0, 0, mode));
    };
  });
}

/**
 * Capture a crisp JPEG poster frame from an uploaded Video File on an offscreen canvas.
 */
export function captureVideoPosterFrame(videoFile: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);
    let settled = false;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      try {
        video.pause();
        video.removeAttribute('src');
        URL.revokeObjectURL(objectUrl);
      } catch {}
      resolve(blob);
    };

    const timer = setTimeout(() => finish(null), 4000);

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      const targetTime =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(1.2, Math.max(0.15, video.duration * 0.2))
          : 0.25;
      try {
        video.currentTime = targetTime;
      } catch {}
    };

    const grabFrame = () => {
      clearTimeout(timer);
      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      if (vw <= 0 || vh <= 0) {
        finish(null);
        return;
      }
      const maxDim = 720;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(180, Math.round(vw * scale));
      canvas.height = Math.max(180, Math.round(vh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        finish(null);
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.84);
      } catch {
        finish(null);
      }
    };

    video.onseeked = grabFrame;
    video.onloadeddata = () => {
      setTimeout(() => {
        if (!settled && video.readyState >= 2) {
          grabFrame();
        }
      }, 280);
    };

    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
  });
}

/**
 * Auto-generate 3 crisp JPEG thumbnails sampled at ~15%, ~45%, and ~75% of the video.
 */
export function captureThreeVideoThumbnails(videoFile: File): Promise<Blob[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve([]);
      return;
    }
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);
    const blobs: Blob[] = [];
    const fractions = [0.15, 0.45, 0.75];
    let step = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        video.pause();
        video.removeAttribute('src');
        URL.revokeObjectURL(objectUrl);
      } catch {}
      resolve(blobs);
    };

    const overallTimer = setTimeout(finish, 9000);

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const seekNext = () => {
      if (step >= fractions.length) {
        clearTimeout(overallTimer);
        finish();
        return;
      }
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 4;
      const t = Math.max(0.1, Math.min(dur - 0.1, dur * fractions[step]));
      try {
        video.currentTime = t;
      } catch {
        clearTimeout(overallTimer);
        finish();
      }
    };

    video.onloadedmetadata = () => {
      seekNext();
    };

    video.onseeked = () => {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      const scale = Math.min(1, 720 / Math.max(vw, vh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(180, Math.round(vw * scale));
      canvas.height = Math.max(180, Math.round(vh * scale));
      const ctx = canvas.getContext('2d');
      if (ctx && vw > 0 && vh > 0) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (b) => {
              if (b) blobs.push(b);
              step += 1;
              seekNext();
            },
            'image/jpeg',
            0.82
          );
          return;
        } catch {}
      }
      step += 1;
      seekNext();
    };

    video.onerror = () => {
      clearTimeout(overallTimer);
      finish();
    };
  });
}

/**
 * Compress a video file in the browser using Canvas + MediaRecorder downscaled to 720p (Free) or 1080p (Pro).
 * Falls back cleanly to original file if unsupported, larger than original, or timed out.
 */
export async function compressVideoInBrowser(
  file: File,
  maxHeight: 720 | 1080 = 720,
  onProgress?: (pct: number) => void
): Promise<{ file: File; compressed: boolean; originalBytes: number; finalBytes: number }> {
  const originalBytes = file.size;
  if (
    typeof document === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    originalBytes < 1.5 * 1024 * 1024
  ) {
    onProgress?.(100);
    return { file, compressed: false, originalBytes, finalBytes: originalBytes };
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute('src');
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    const fallbackOriginal = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onProgress?.(100);
      resolve({ file, compressed: false, originalBytes, finalBytes: originalBytes });
    };

    // Guard against slow headless codecs hanging the UI
    const safetyTimer = setTimeout(fallbackOriginal, 18000);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      // Only compress reasonably short browser-transcodable clips (< 90s)
      if (!dur || dur > 90 || vh <= 0 || vw <= 0) {
        clearTimeout(safetyTimer);
        fallbackOriginal();
        return;
      }

      const scale = vh > maxHeight ? maxHeight / vh : 1;
      const outW = Math.max(320, Math.round((vw * scale) / 2) * 2);
      const outH = Math.max(240, Math.round((vh * scale) / 2) * 2);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof canvas.captureStream !== 'function') {
        clearTimeout(safetyTimer);
        fallbackOriginal();
        return;
      }

      const mimeCandidate = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

      if (!mimeCandidate) {
        clearTimeout(safetyTimer);
        fallbackOriginal();
        return;
      }

      try {
        const stream = canvas.captureStream(24);
        const targetBitrate = maxHeight === 1080 ? 2_200_000 : 1_100_000;
        const recorder = new MediaRecorder(stream, {
          mimeType: mimeCandidate,
          videoBitsPerSecond: targetBitrate,
        });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          clearTimeout(safetyTimer);
          if (settled) return;
          settled = true;
          cleanup();
          const outBlob = new Blob(chunks, { type: 'video/webm' });
          if (outBlob.size > 0 && outBlob.size < originalBytes) {
            const outFile = new File(
              [outBlob],
              file.name.replace(/\.[^.]+$/, '') + '.webm',
              { type: 'video/webm' }
            );
            onProgress?.(100);
            resolve({
              file: outFile,
              compressed: true,
              originalBytes,
              finalBytes: outFile.size,
            });
          } else {
            onProgress?.(100);
            resolve({ file, compressed: false, originalBytes, finalBytes: originalBytes });
          }
        };

        let rafId = 0;
        const drawLoop = () => {
          if (video.paused || video.ended || settled) {
            cancelAnimationFrame(rafId);
            return;
          }
          ctx.drawImage(video, 0, 0, outW, outH);
          if (dur > 0) {
            onProgress?.(Math.min(96, Math.round((video.currentTime / dur) * 100)));
          }
          rafId = requestAnimationFrame(drawLoop);
        };

        video.onended = () => {
          cancelAnimationFrame(rafId);
          if (recorder.state === 'recording') recorder.stop();
        };

        recorder.start(250);
        video.playbackRate = 1.5;
        video
          .play()
          .then(() => {
            rafId = requestAnimationFrame(drawLoop);
          })
          .catch(() => {
            clearTimeout(safetyTimer);
            if (recorder.state === 'recording') recorder.stop();
            fallbackOriginal();
          });
      } catch {
        clearTimeout(safetyTimer);
        fallbackOriginal();
      }
    };

    video.onerror = () => {
      clearTimeout(safetyTimer);
      fallbackOriginal();
    };
  });
}

function inferMediaKind(bucket: StorageBucket, mimeType: string): 'image' | 'video' | 'audio' {
  const lowerMime = (mimeType || '').toLowerCase();
  if (lowerMime.startsWith('audio/') || bucket === 'match-chat-voices') return 'audio';
  if (
    lowerMime.startsWith('video/') ||
    bucket === 'videos' ||
    bucket === 'post-videos' ||
    bucket === 'futfield-videos'
  ) {
    return 'video';
  }
  return 'image';
}

export interface UploadExtraHeaders {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoKind?: 'short' | 'video';
  aspectRatio?: '9:16' | '16:9';
  title?: string;
  description?: string;
}

/**
 * Upload raw File or Blob directly to backend POST /api/media/upload with XHR progress.
 * Returns permanent /uploads/... URL and status: 'UPLOADED' or 'ERROR'.
 */
export async function uploadFileToBackend(
  fileOrBlob: File | Blob,
  bucket: StorageBucket,
  fileName?: string,
  onProgress?: (percent: number) => void,
  userId?: string,
  extraHeaders?: UploadExtraHeaders
): Promise<MediaUploadResult> {
  const resolvedName =
    fileName ||
    (fileOrBlob instanceof File ? fileOrBlob.name : undefined) ||
    (bucket.includes('video') ? 'clip.mp4' : bucket.includes('voice') ? 'voice.webm' : 'image.jpg');

  const mimeType =
    fileOrBlob.type ||
    (bucket.includes('video') ? 'video/mp4' : bucket.includes('voice') ? 'audio/webm' : 'image/jpeg');

  const exactBytes = fileOrBlob.size;
  const exactMb = formatBytesToMb(exactBytes);
  const mediaKind = inferMediaKind(bucket, mimeType);

  onProgress?.(5);

  let serverPayload: any = null;
  try {
    const response = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload', true);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.setRequestHeader('x-file-name', encodeURIComponent(resolvedName));
      xhr.setRequestHeader('x-file-type', mimeType);
      xhr.setRequestHeader('x-bucket', bucket);
      if (userId) xhr.setRequestHeader('x-user-id', userId);
      if (extraHeaders?.durationSeconds !== undefined) {
        xhr.setRequestHeader('x-video-duration', String(extraHeaders.durationSeconds));
      }
      if (extraHeaders?.width !== undefined) {
        xhr.setRequestHeader('x-video-width', String(extraHeaders.width));
      }
      if (extraHeaders?.height !== undefined) {
        xhr.setRequestHeader('x-video-height', String(extraHeaders.height));
      }
      if (extraHeaders?.videoKind) {
        xhr.setRequestHeader('x-video-kind', extraHeaders.videoKind);
      }
      if (extraHeaders?.aspectRatio) {
        xhr.setRequestHeader('x-aspect-ratio', extraHeaders.aspectRatio);
      }
      if (extraHeaders?.title) {
        xhr.setRequestHeader('x-media-title', encodeURIComponent(extraHeaders.title));
      }
      if (extraHeaders?.description) {
        xhr.setRequestHeader('x-media-description', encodeURIComponent(extraHeaders.description));
      }

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          const pct = Math.min(98, Math.max(5, Math.round((ev.loaded / ev.total) * 100)));
          onProgress?.(pct);
        }
      };

      xhr.onload = () => {
        let parsed: any = null;
        try {
          parsed = JSON.parse(xhr.responseText || '{}');
        } catch {}

        if (xhr.status >= 200 && xhr.status < 300) {
          if (parsed) resolve(parsed);
          else reject(new Error('Invalid server upload response'));
        } else {
          serverPayload = parsed;
          const serverErrorMsg = parsed?.error || `Backend upload failed (${xhr.status})`;
          reject(new Error(serverErrorMsg));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading to backend'));
      xhr.send(fileOrBlob);
    });

    onProgress?.(100);
    return {
      url: response.url,
      success: Boolean(response.success && response.url),
      status: response.status === 'UPLOADED' || response.success ? 'UPLOADED' : 'ERROR',
      sizeBytes: response.sizeBytes ?? exactBytes,
      sizeMb: response.sizeMb ?? exactMb,
      mediaKind: response.mediaKind ?? mediaKind,
      videoKind: response.videoKind,
      aspectRatio: response.aspectRatio,
      copyrightStatus: response.copyrightStatus,
      copyrightReport: response.copyrightReport,
      totals: response.totals,
    };
  } catch (err: any) {
    return {
      url: '',
      success: false,
      status: 'ERROR',
      sizeBytes: exactBytes,
      sizeMb: exactMb,
      mediaKind,
      copyrightStatus: serverPayload?.copyrightStatus,
      copyrightReport: serverPayload?.copyrightReport,
      error: err?.message || 'Backend upload failed',
    };
  }
}

/**
 * Alias kept for callers importing uploadMediaWithProgress (File | Blob only routes binary to backend).
 */
export async function uploadMediaWithProgress(
  fileOrBlob: File | Blob | string,
  bucket: StorageBucket,
  fileName?: string,
  onProgress?: (percent: number) => void,
  userId?: string,
  extraHeaders?: UploadExtraHeaders
): Promise<MediaUploadResult> {
  if (fileOrBlob instanceof File || fileOrBlob instanceof Blob) {
    return uploadFileToBackend(fileOrBlob, bucket, fileName, onProgress, userId, extraHeaders);
  }

  // Fallback for server URLs passed directly
  if (fileOrBlob.startsWith('/uploads/') || fileOrBlob.startsWith('http')) {
    onProgress?.(100);
    return {
      url: fileOrBlob,
      success: true,
      status: 'UPLOADED',
      sizeBytes: 0,
      sizeMb: 0,
      mediaKind: inferMediaKind(bucket, ''),
    };
  }

  return {
    url: '',
    success: false,
    status: 'ERROR',
    sizeBytes: 0,
    sizeMb: 0,
    mediaKind: inferMediaKind(bucket, ''),
    error: 'Direct File/Blob upload to backend required',
  };
}
