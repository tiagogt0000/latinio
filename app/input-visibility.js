const ANSWER_SELECTOR = [
  '#answer-form input[name="answer"]',
  '#predicate-answer-form input[name="answer"]',
  '#table-practice-form input[data-table-answer]',
  '#table-learning-form input[data-table-answer]',
  '.grammar-shell textarea[data-grammar-answer]',
  '.landscape-shell input[data-field]',
  '.landscape-shell .ls-form-label input',
].join(', ');
const KEYBOARD_INSET = '--answer-keyboard-inset';
const isZoomed = viewport => Number(viewport?.scale) > 1.01;

function horizontallyClipped(input, view, rect) {
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right)) return false;
  const viewport = view.visualViewport;
  const left = Number(viewport?.offsetLeft) || 0;
  const width = Number(viewport?.width) || Number(view.innerWidth);
  const clipped = (start, end) => !(rect.left < start && rect.right > end) && (rect.left < start || rect.right > end);
  if (width > 0 && clipped(left, left + width)) return true;
  // A table can clip a column while that column still lies inside the page viewport.
  for (let parent = input.parentElement; parent; parent = parent.parentElement) {
    if (!(parent.clientWidth > 0 && parent.scrollWidth > parent.clientWidth)) continue;
    const overflow = view.getComputedStyle?.(parent)?.overflowX;
    if (!['auto', 'scroll', 'hidden'].includes(overflow)) continue;
    const bounds = parent.getBoundingClientRect?.();
    if (!bounds || !Number.isFinite(bounds.left)) continue;
    const start = bounds.left + (parent.clientLeft || 0);
    if (clipped(start, start + parent.clientWidth)) return true;
  }
  return false;
}

/** Reveal only the clipped edge, including the space hidden by an on-screen keyboard. */
export function ensureInputVisible(input, { view = input?.ownerDocument?.defaultView || globalThis.window, margin = 16 } = {}) {
  if (!input?.getBoundingClientRect || input.isConnected === false || !view) return false;
  const viewport = view.visualViewport;
  // Pinch zoom shrinks the visual viewport too; leave the user's zoom/panning alone.
  if (isZoomed(viewport)) return false;
  const top = Number(viewport?.offsetTop) || 0;
  const height = Number(viewport?.height) || Number(view.innerHeight);
  if (!(height > 0)) return false;
  const padding = Math.max(0, Math.min(margin, height / 4));
  const bounds = { top: top + padding, bottom: top + height - padding };
  const deltaFor = rect => {
    if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return 0;
    if (rect.top < bounds.top && rect.bottom > bounds.bottom) return 0;
    if (rect.bottom > bounds.bottom) return rect.bottom - bounds.bottom;
    if (rect.top < bounds.top) return rect.top - bounds.top;
    return 0;
  };
  const rect = input.getBoundingClientRect();
  if (!deltaFor(rect) && !horizontallyClipped(input, view, rect)) return false;
  // Native nearest scrolling also handles a nested scrolling container.
  input.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  const delta = deltaFor(input.getBoundingClientRect());
  // Safari's native scrollIntoView may use the layout viewport behind its keyboard.
  if (delta) view.scrollBy?.({ top: delta, left: 0, behavior: 'instant' });
  return true;
}

export function focusInput(input) {
  if (!input?.focus) return false;
  input.focus({ preventScroll: true });
  ensureInputVisible(input);
  return true;
}

/** Delegated listeners work for newly added fields and survive form rerenders. */
export function installInputVisibility({
  root = globalThis.document,
  view = root?.defaultView || root?.ownerDocument?.defaultView || globalThis.window,
  active = () => true,
  selector = ANSWER_SELECTOR,
  margin = 16,
} = {}) {
  if (!root?.addEventListener || !view) return () => {};
  const document = root.ownerDocument || root;
  const style = document.documentElement?.style;
  const previousInset = style?.getPropertyValue(KEYBOARD_INSET) || '';
  const previousPriority = style?.getPropertyPriority(KEYBOARD_INSET) || '';
  const viewport = view.visualViewport;
  const requestFrame = view.requestAnimationFrame?.bind(view) || (callback => view.setTimeout(callback, 0));
  const cancelFrame = view.cancelAnimationFrame?.bind(view) || view.clearTimeout?.bind(view);
  let frame = null, settleTimer = null, disposed = false, insetApplied = false;
  const relevant = input => Boolean(input?.matches?.(selector) && !input.disabled && !input.readOnly && input.isConnected !== false);
  const focused = () => {
    const input = document.activeElement;
    return active() && !isZoomed(viewport) && relevant(input) && (root === document || root.contains?.(input)) ? input : null;
  };
  const restoreInset = () => {
    if (!insetApplied || !style) return;
    if (previousInset) style.setProperty(KEYBOARD_INSET, previousInset, previousPriority);
    else style.removeProperty(KEYBOARD_INSET);
    insetApplied = false;
  };
  const updateInset = () => {
    if (!style) return;
    const inset = viewport ? Math.max(0, (Number(view.innerHeight) || 0) - (Number(viewport.height) || 0) - (Number(viewport.offsetTop) || 0)) : 0;
    const value = `${Math.ceil(inset)}px`;
    if (style.getPropertyValue(KEYBOARD_INSET) !== value) style.setProperty(KEYBOARD_INSET, value);
    insetApplied = true;
  };
  const cancel = () => {
    if (frame !== null) cancelFrame?.(frame);
    if (settleTimer !== null) view.clearTimeout(settleTimer);
    frame = null;
    settleTimer = null;
  };
  const schedule = (settle = false) => {
    if (disposed) return;
    if (!focused()) { cancel(); restoreInset(); return; }
    if (frame === null) frame = requestFrame(() => {
      frame = null;
      const input = focused();
      if (!input) { restoreInset(); return; }
      updateInset();
      ensureInputVisible(input, { view, margin });
    });
    if (settle) {
      if (settleTimer !== null) view.clearTimeout(settleTimer);
      // Covers the keyboard's opening animation on devices with sparse resize events.
      settleTimer = view.setTimeout(() => { settleTimer = null; schedule(); }, 300);
    }
  };
  const onFocus = event => { if (relevant(event.target)) schedule(true); };
  const onInput = event => { if (event.target === focused()) schedule(); };
  // A submitted field can become readonly or detached before its focusout event.
  const onBlur = event => { if (event.target?.matches?.(selector)) { cancel(); restoreInset(); } };
  const onViewport = () => schedule();
  root.addEventListener('focusin', onFocus);
  root.addEventListener('focusout', onBlur);
  root.addEventListener('input', onInput);
  view.addEventListener('resize', onViewport);
  viewport?.addEventListener('resize', onViewport);
  viewport?.addEventListener('scroll', onViewport);
  schedule();
  return () => {
    if (disposed) return;
    disposed = true;
    cancel();
    restoreInset();
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('focusout', onBlur);
    root.removeEventListener('input', onInput);
    view.removeEventListener('resize', onViewport);
    viewport?.removeEventListener('resize', onViewport);
    viewport?.removeEventListener('scroll', onViewport);
  };
}
