'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export const getFocusableElements = (container) => Array.from(
  container?.querySelectorAll(FOCUSABLE_SELECTOR) || [],
).filter((element) => (
  element.getAttribute('aria-hidden') !== 'true' &&
  !element.hasAttribute('hidden') &&
  element.getClientRects().length > 0
));

export const useModalFocus = (isOpen, { onEscape, canClose = true } = {}) => {
  const dialogRef = useRef(null);
  const onEscapeRef = useRef(onEscape);
  const canCloseRef = useRef(canClose);
  onEscapeRef.current = onEscape;
  canCloseRef.current = canClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = getFocusableElements(dialog);
    (focusable[0] || dialog)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && canCloseRef.current) {
        event.preventDefault();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const currentFocusable = getFocusableElements(dialog);
      if (currentFocusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return dialogRef;
};
