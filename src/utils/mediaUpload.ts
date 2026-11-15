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
  height: number
): VideoInspectionMetadata {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;

  if (width > 0 && height > 0) {
    const ratio = width / height;
    // Vertical / Portrait (~9:16)
    if (ratio <= 0.85) {
      const validationError =
        safeDuration > 120
          ? `9:16 PitchReels Shorts must be 2 minutes (120s) or less. Detected ${safeDuration}s.`
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
    if (ratio >= 1.25) {
      const validationError =
        safeDuration > 180
          ? `16:9 Football Videos must be 3 minutes (180s) or less. Detected ${safeDuration}s.`
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
      validationError: `Unsupported aspect ratio (${width}x${height}). Upload a 9:16 Vertical Short (≤ 2 min) or a 16:9 Widescreen Video (≤ 3 min).`,
    };
  }

  // Fallback when codec metadata isn't readable by browser (e.g., some headless/webm streams)
  if (safeDuration > 180) {
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

  const inferredKind = safeDuration > 120 ? 'video' : 'short';
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
 * Inspect duration & dimensions locally and auto-detect 9:16 Short (<=120s) vs 16:9 Video (<=180s).
 */
export function inspectVideoMetadata(videoFile: File): Promise<VideoInspectionMetadata> {
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
      resolve(classifyVideoDimensionsAndDuration(0, 0, 0));
    }, 4500);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      resolve(classifyVideoDimensionsAndDuration(duration, width, height));
    };

    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(classifyVideoDimensionsAndDuration(0, 0, 0));
    };
  });
}

/**
 * Capture a crisp JPEG poster frame from an uploaded Video File on an offscreen canvas.
 * Prevents uploaded clips from showing blank players or generic stock banners.
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
      } catch {
        // Fallback if seek throws
      }
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
        canvas.toBlob(
          (blob) => finish(blob),
          'image/jpeg',
          0.84
        );
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

function inferMediaKind(bucket: StorageBucket, mimeType: string): 'image' | 'video' | 'audio' {
  const lowerMime = (mimeType || '').toLowerCase();
  if (lowerMime.startsWith('audio/') || bucket === 'match-chat-voices') return 'audio';
  if (lowerMime.startsWith('video/') || bucket === 'videos' || bucket === 'post-videos') return 'video';
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
