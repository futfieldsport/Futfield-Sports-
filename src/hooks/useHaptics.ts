import { useCallback, useEffect, useState } from 'react';

export const HAPTICS_STORAGE_KEY = 'futfield_haptics_enabled';
const HAPTICS_CHANGE_EVENT = 'futfield:haptics-changed';

export function isHapticsEnabledInStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(HAPTICS_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function triggerBrowserVibrate(pattern: number | number[]): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!isHapticsEnabledInStorage() || prefersReducedMotion()) return false;
  if (typeof navigator.vibrate !== 'function') return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function useHaptics() {
  const [enabled, setEnabledState] = useState<boolean>(() => isHapticsEnabledInStorage());

  const isSupported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  useEffect(() => {
    const sync = () => {
      setEnabledState(isHapticsEnabledInStorage());
    };
    window.addEventListener(HAPTICS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HAPTICS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(HAPTICS_STORAGE_KEY, String(next));
      setEnabledState(next);
      window.dispatchEvent(new CustomEvent(HAPTICS_CHANGE_EVENT, { detail: { enabled: next } }));
      if (next && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !prefersReducedMotion()) {
        navigator.vibrate([12, 24, 16]);
      }
    } catch {
      setEnabledState(next);
    }
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(!isHapticsEnabledInStorage());
  }, [setEnabled]);

  const vibrate = useCallback((pattern: number | number[]) => {
    return triggerBrowserVibrate(pattern);
  }, []);

  // Key user interaction patterns
  const triggerVote = useCallback(() => {
    return triggerBrowserVibrate([14, 24, 22]);
  }, []);

  const triggerMessage = useCallback(() => {
    return triggerBrowserVibrate([10, 20, 14]);
  }, []);

  const triggerNotificationToggle = useCallback(() => {
    return triggerBrowserVibrate([12, 28, 18]);
  }, []);

  const triggerLike = useCallback(() => {
    return triggerBrowserVibrate([12, 30, 18]);
  }, []);

  const triggerSuccess = useCallback(() => {
    return triggerBrowserVibrate([14, 38, 22]);
  }, []);

  const triggerLight = useCallback(() => {
    return triggerBrowserVibrate(10);
  }, []);

  const triggerWarning = useCallback(() => {
    return triggerBrowserVibrate([24, 40, 24]);
  }, []);

  return {
    isSupported,
    enabled,
    setEnabled,
    toggleEnabled,
    vibrate,
    triggerVote,
    triggerMessage,
    triggerNotificationToggle,
    triggerLike,
    triggerSuccess,
    triggerLight,
    triggerWarning,
  };
}
