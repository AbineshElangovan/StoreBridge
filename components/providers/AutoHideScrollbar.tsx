'use client';

import { useEffect } from 'react';

const SCROLL_HIDE_DELAY_MS = 1200;

/**
 * Universal Auto-Hide Scrollbar Provider for StoreBridge.
 * 
 * Intercepts scroll events globally across the entire DOM (window, main viewport,
 * sidebar, notifications, modals, tables, and internal scroll containers).
 * 
 * - When idle: scrollbars are completely hidden (transparent).
 * - When scrolling: scrollbar thumb becomes visible on the actively scrolling element.
 * - When stopped: automatically hides after a short delay (900ms) with a smooth fade.
 * - Fully accessible: supports mouse wheel, trackpad, touch, keyboard, and scrollbar drag.
 * - Zero layout shift: constant scroll gutter geometry prevents any content jumping.
 */
export function AutoHideScrollbar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isPointerDown = false;
    const activeElements = new Map<HTMLElement, NodeJS.Timeout>();

    const clearTimer = (el: HTMLElement) => {
      const timer = activeElements.get(el);
      if (timer) {
        clearTimeout(timer);
        activeElements.delete(el);
      }
    };

    const scheduleHide = (el: HTMLElement) => {
      clearTimer(el);
      if (!el || (el !== document.documentElement && el !== document.body && !el.isConnected)) {
        return;
      }
      const timer = setTimeout(() => {
        // If mouse/pointer is still held down (e.g. dragging thumb), keep visible and check again
        if (isPointerDown) {
          scheduleHide(el);
          return;
        }
        try {
          el.removeAttribute('data-scrolling');
          el.classList.remove('sb-scrolling');
        } catch (e) {}
        activeElements.delete(el);
      }, SCROLL_HIDE_DELAY_MS);
      activeElements.set(el, timer);
    };

    const handleScroll = (e: Event) => {
      const target = e.target;
      let el: HTMLElement | null = null;

      if (
        target === document ||
        target === window ||
        target === document.documentElement ||
        target === document.body
      ) {
        document.documentElement.setAttribute('data-scrolling', 'true');
        document.documentElement.classList.add('sb-scrolling');
        if (document.body) {
          document.body.setAttribute('data-scrolling', 'true');
          document.body.classList.add('sb-scrolling');
          scheduleHide(document.body);
        }
        scheduleHide(document.documentElement);
        return;
      } else if (target instanceof HTMLElement) {
        if (target.closest('.custom-dropdown-scrollbar') || target.classList.contains('custom-dropdown-scrollbar')) {
          return;
        }
        el = target;
      }

      if (!el) return;

      // Mark the scrolling container
      if (!el.hasAttribute('data-scrolling')) {
        el.setAttribute('data-scrolling', 'true');
        el.classList.add('sb-scrolling');
      }

      scheduleHide(el);
    };

    const handlePointerDown = () => {
      isPointerDown = true;
    };

    const handlePointerUp = () => {
      isPointerDown = false;
      if (activeElements.size === 0) return;
      // CRITICAL: Snapshot keys into an array to prevent infinite loop in Map.forEach
      // when scheduleHide modifies activeElements during iteration.
      const elements = Array.from(activeElements.keys());
      for (const el of elements) {
        scheduleHide(el);
      }
    };

    // Attach capturing listeners so any nested container's scroll event is caught
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true, passive: true });
    window.addEventListener('blur', handlePointerUp);

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });
      window.removeEventListener('blur', handlePointerUp);

      const elements = Array.from(activeElements.keys());
      for (const el of elements) {
        clearTimer(el);
        try {
          el.removeAttribute('data-scrolling');
          el.classList.remove('sb-scrolling');
        } catch (e) {}
      }
      activeElements.clear();
    };
  }, []);

  return null;
}
