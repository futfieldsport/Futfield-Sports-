/**
 * Universal instantaneous scroll-to-top helper.
 * Ensures every feature, tab, sub-view, and video watch action starts at the exact top (0, 0)
 * across window, document body, and any nested scroll containers.
 */
export function scrollToTopInstant(): void {
  if (typeof window === 'undefined') return;

  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  } catch {
    window.scrollTo(0, 0);
  }

  if (document.documentElement) {
    document.documentElement.scrollTop = 0;
  }
  if (document.body) {
    document.body.scrollTop = 0;
  }

  try {
    const scrollables = document.querySelectorAll(
      'main, [data-scroll-container], .overflow-y-auto, [role="main"], #root > div, .no-scrollbar'
    );
    scrollables.forEach((el) => {
      if (el && 'scrollTop' in el) {
        (el as HTMLElement).scrollTop = 0;
      }
    });
  } catch {}
}
