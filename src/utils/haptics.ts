/**
 * FUTFIELD Mobile Haptic Feedback Engine
 * Provides authentic tactile response for football social interactions:
 * - Sending match messages
 * - Liking posts, comments, videos
 * - Receiving live goal alerts & celebrations
 * - Toggling bookmarks, filters, and predictions
 */

const HAPTICS_STORAGE_KEY = 'futfield_haptics_enabled';

class HapticFeedbackService {
  private isSupported(): boolean {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem(HAPTICS_STORAGE_KEY) === 'false') return false;
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return false;
        }
      } catch {}
    }
    return typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function';
  }

  /**
   * Quick light tap (15ms)
   * Ideal for tab switches, filter toggles, emoji reactions
   */
  light(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  }

  /**
   * Medium crisp feedback (30ms)
   * Ideal for liking a post, bookmarking, following a club
   */
  medium(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(30);
      } catch {}
    }
  }

  /**
   * Satisfying like vibration bump (15ms, pause, 25ms)
   */
  like(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([15, 30, 25]);
      } catch {}
    }
  }

  /**
   * Vote cast haptic pulse
   */
  vote(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([14, 24, 22]);
      } catch {}
    }
  }

  /**
   * Notification toggle haptic pulse
   */
  notificationToggle(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([12, 28, 18]);
      } catch {}
    }
  }

  /**
   * Success double-pulse
   * Ideal for sending a message, publishing a post, saving lineup
   */
  success(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([25, 45, 35]);
      } catch {}
    }
  }

  /**
   * Message sent tactile feedback
   */
  messageSent(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([10, 20, 14]);
      } catch {}
    }
  }

  /**
   * Goal celebration rhythmic stadium vibration sequence
   */
  goalAlert(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([100, 60, 100, 60, 220]);
      } catch {}
    }
  }

  /**
   * Warning / delete vibration pattern
   */
  warning(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([40, 40, 40]);
      } catch {}
    }
  }
}

export const haptics = new HapticFeedbackService();
