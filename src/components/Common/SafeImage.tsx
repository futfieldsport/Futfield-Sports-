import React, { useEffect, useState } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  wrapperClassName?: string;
  loading?: 'lazy' | 'eager';
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

/**
 * Resilient studio image renderer with smooth loading shimmer,
 * automatic fallback recovery, and zero broken-image icons.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  wrapperClassName = '',
  loading = 'lazy',
  onClick,
  title,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src || fallbackSrc || '');
  const [loaded, setLoaded] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '');
    setLoaded(false);
    setFailed(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setFailed(false);
      return;
    }
    setFailed(true);
    setLoaded(true);
  };

  if (!currentSrc || failed) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-[#0D131D] text-slate-500 dark:text-white/55 p-6 ${wrapperClassName}`}
      >
        <ImageOff className="w-6 h-6 opacity-70" />
        <span className="text-[11px] font-semibold">Image unavailable</span>
        {src && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFailed(false);
              setLoaded(false);
              const sep = src.includes('?') ? '&' : '?';
              setCurrentSrc(`${src}${sep}t=${Date.now()}`);
            }}
            className="px-3 py-1 rounded-full bg-white/80 dark:bg-white/10 text-[11px] font-bold flex items-center gap-1 hover:bg-[#00E676] hover:text-black transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${wrapperClassName}`} onClick={onClick} title={title}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-slate-200/70 via-slate-100/50 to-slate-200/70 dark:from-white/5 dark:via-white/10 dark:to-white/5 animate-pulse"
        />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
