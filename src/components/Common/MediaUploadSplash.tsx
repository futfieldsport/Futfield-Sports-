import React from 'react';
import { CheckCircle2, HardDrive, Image as ImageIcon, Mic, Video as VideoIcon, AlertCircle } from 'lucide-react';

export type UploadSplashStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

interface MediaUploadSplashProps {
  status: UploadSplashStatus;
  mediaKind: 'image' | 'video' | 'audio';
  fileName?: string;
  sizeMb?: number;
  progress: number;
  errorMessage?: string | null;
  onDismissError?: () => void;
}

export const MediaUploadSplash: React.FC<MediaUploadSplashProps> = ({
  status,
  mediaKind,
  fileName,
  sizeMb = 0,
  progress,
  errorMessage,
  onDismissError,
}) => {
  if (status === 'idle') return null;

  const kindLabel =
    mediaKind === 'video' ? 'video' : mediaKind === 'audio' ? 'voice note' : 'image';

  const Icon =
    mediaKind === 'video' ? VideoIcon : mediaKind === 'audio' ? Mic : ImageIcon;

  if (status === 'uploading') {
    return (
      <div className="rounded-2xl bg-slate-900 dark:bg-[#0b1117] border border-[#00E676]/40 p-3.5 shadow-lg space-y-2.5 animate-in fade-in">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-9 h-9 rounded-xl bg-[#00E676]/15 border border-[#00E676]/40 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 rounded-full border-2 border-[#00E676] border-t-transparent animate-spin" />
              <Icon className="w-2.5 h-2.5 text-[#00E676] absolute" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
                <span>Currently uploading {kindLabel}...</span>
              </div>
              <div className="text-[10px] text-white/60 truncate flex items-center gap-1.5 font-mono">
                {fileName && <span className="truncate max-w-[160px]">{fileName}</span>}
                {sizeMb > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-[#00E676] font-bold">{sizeMb} MB</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-lg bg-[#00E676]/15 border border-[#00E676]/30 text-[#00E676] font-mono text-xs font-black shrink-0">
            {Math.min(99, Math.max(1, Math.round(progress)))}%
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-[#00E676] to-teal-300 transition-all duration-150 rounded-full shadow-[0_0_10px_#00E676]"
            style={{ width: `${Math.min(99, Math.max(5, progress))}%` }}
          />
        </div>

        <div className="text-[10px] text-white/50 font-semibold flex items-center justify-between">
          <span>Uploading directly to backend storage</span>
          <span className="font-mono text-emerald-400">REAL-TIME SYNC</span>
        </div>
      </div>
    );
  }

  if (status === 'uploaded') {
    return (
      <div className="rounded-2xl bg-emerald-950/90 dark:bg-[#071f14] border border-[#00E676] px-3.5 py-2.5 shadow-md flex items-center justify-between gap-2 animate-in fade-in">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#00E676] text-black flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,230,118,0.45)]">
            <CheckCircle2 className="w-4 h-4 stroke-[2.75]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[#00E676] tracking-wider uppercase flex items-center gap-1.5">
              <span>UPLOADED</span>
              <span className="text-[10px] font-bold text-white/80 normal-case">
                ({kindLabel} ready)
              </span>
            </div>
            {fileName && (
              <div className="text-[10px] text-white/70 truncate font-mono">
                {fileName}
              </div>
            )}
          </div>
        </div>

        {sizeMb > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 border border-[#00E676]/40 text-[#00E676] font-mono text-[10px] font-black shrink-0">
            <HardDrive className="w-3 h-3" />
            <span>{sizeMb} MB</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-rose-950/90 border border-rose-500/60 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-rose-200 animate-in fade-in">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="truncate font-semibold">
          {errorMessage || `Failed to upload ${kindLabel}. Please try again.`}
        </span>
      </div>
      {onDismissError && (
        <button
          type="button"
          onClick={onDismissError}
          className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-white shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};
