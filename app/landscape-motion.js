/** Small, interruptible motion primitives. Gestures track the finger; motion never gates data. */
export const prefersReducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function swipeDecision({dx = 0, dy = 0, velocity = 0, width = 320, revealed = false} = {}) {
  if (!revealed || Math.abs(dy) > Math.abs(dx) * 1.15) return 0;
  const distance = Math.min(110, Math.max(64, width * .26));
  if (Math.abs(dx) >= distance || Math.abs(dx) > 30 && Math.abs(velocity) > .55 && Math.sign(velocity) === Math.sign(dx)) return Math.sign(dx);
  return 0;
}

export function animateLandscape(element, frames, options = {}) {
  if (!element?.animate) return null;
  const reduced = prefersReducedMotion();
  const keyframes = reduced ? [{opacity: frames[0]?.opacity ?? .55}, {opacity: frames.at(-1)?.opacity ?? 1}] : frames;
  const animation = element.animate(keyframes, {duration: reduced ? 100 : 240, easing: 'cubic-bezier(.22, 1, .36, 1)', ...options, ...(reduced ? {duration: 100} : {})});
  animation.finished?.catch(() => {});
  return animation;
}

export function cardDeparture(element, {direction = 1, behind = false} = {}) {
  if (!element || !globalThis.document) return;
  const initialTransform = element.style.transform || 'translateX(0) rotate(0deg)';
  const previousTransform = element.style.transform;
  element.style.transform = 'none';
  const rect = element.getBoundingClientRect();
  element.style.transform = previousTransform;
  if (!rect.width || !rect.height) return;
  const ghost = element.cloneNode(true);
  ghost.removeAttribute('id');
  for (const node of [ghost, ...ghost.querySelectorAll('*')]) {
    node.removeAttribute('data-action'); node.removeAttribute('data-flashcard'); node.removeAttribute('data-quick-card');
  }
  ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  ghost.querySelectorAll('input,button,[tabindex]').forEach(node => node.setAttribute('tabindex', '-1'));
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('tabindex', '-1');
  ghost.inert = true;
  ghost.classList.add('ls-motion-ghost');
  Object.assign(ghost.style, {position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', pointerEvents: 'none', zIndex: '10020', transform: 'none'});
  document.body.append(ghost);
  const frames = behind ? [
    {transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0},
    {transform: 'translate(24px, -32px) rotate(5deg) scale(.98)', opacity: 1, offset: .4},
    {transform: 'translate(0, -22px) scale(.91)', opacity: 0, offset: 1},
  ] : [
    {transform: initialTransform, opacity: 1},
    {transform: `translateX(${direction * Math.max(420, rect.width * 1.4)}px) rotate(${direction * 18}deg)`, opacity: 0},
  ];
  const animation = animateLandscape(ghost, frames, {duration: behind ? 430 : 310, fill: 'forwards'});
  if (animation) animation.finished.then(() => ghost.remove(), () => ghost.remove());
  else ghost.remove();
  setTimeout(() => ghost.remove(), 1000);
}

export function moveToken(from, to, label) {
  if (!from || !to || !globalThis.document || prefersReducedMotion()) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const ghost = document.createElement('span');
  ghost.className = 'ls-token ls-token-flight';
  ghost.textContent = label;
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '10021', pointerEvents: 'none'});
  document.body.append(ghost);
  const animation = animateLandscape(ghost, [{transform: 'translate(0, 0) scale(1)', opacity: .95}, {transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.92)`, opacity: 0}], {duration: 230});
  if (animation) animation.finished.then(() => ghost.remove(), () => ghost.remove()); else ghost.remove();
}

export function bindSwipeCard(element, {revealed = () => false, onRate = () => {}, onFlip = () => {}} = {}) {
  if (!element) return () => {};
  const abort = new AbortController();
  let pointer = null, cancelClickUntil = 0, settle = null;
  const write = dx => {
    element.style.transform = `translate3d(${dx}px,0,0) rotate(${Math.max(-13, Math.min(13, dx / 20))}deg)`;
    const side = dx > 0 ? 'right' : 'wrong';
    element.dataset.swipe = Math.abs(dx) > 15 ? side : '';
    const label = element.querySelector('[data-swipe-label]');
    if (label) { label.textContent = dx > 0 ? 'Gewusst' : 'Noch üben'; label.style.opacity = String(Math.min(1, Math.abs(dx) / 80)); }
  };
  const reset = () => {
    const old = element.style.transform || 'none';
    write(0); element.classList.remove('is-dragging');
    settle?.cancel();
    settle = animateLandscape(element, [{transform: old}, {transform: 'translate3d(0,0,0) rotate(0deg)'}], {duration: 260});
  };
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || event.target.closest('a,input,button')) return;
    settle?.cancel();
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, previousX: event.clientX, previousTime: event.timeStamp, velocity: 0, axis: null, dx: 0, dy: 0};
  }, {signal: abort.signal});
  element.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 9) {
      pointer.axis = Math.abs(dx) > Math.abs(dy) * 1.12 ? 'x' : 'y';
      if (pointer.axis === 'x') { try { element.setPointerCapture(event.pointerId); } catch {} element.classList.add('is-dragging'); }
    }
    if (pointer.axis !== 'x') return;
    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - pointer.previousTime);
    pointer.velocity = (event.clientX - pointer.previousX) / elapsed;
    pointer.previousX = event.clientX; pointer.previousTime = event.timeStamp; pointer.dx = dx; pointer.dy = dy;
    write(revealed() ? dx : dx * .14);
  }, {signal: abort.signal});
  const end = (event, cancelled = false) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const saved = pointer; pointer = null;
    try { if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId); } catch {}
    if (saved.axis !== 'x') return;
    cancelClickUntil = Date.now() + 450;
    const recentVelocity = event.timeStamp - saved.previousTime < 100 ? saved.velocity : 0;
    const direction = cancelled ? 0 : swipeDecision({...saved, velocity: recentVelocity, width: element.clientWidth, revealed: revealed()});
    element.classList.remove('is-dragging');
    if (direction) { onRate(direction > 0); } else reset();
  };
  element.addEventListener('pointerup', event => end(event), {signal: abort.signal});
  element.addEventListener('pointercancel', event => end(event, true), {signal: abort.signal});
  element.addEventListener('lostpointercapture', event => { if (pointer) end(event, true); }, {signal: abort.signal});
  element.addEventListener('click', event => {
    if (Date.now() < cancelClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, {capture: true, signal: abort.signal});
  element.addEventListener('keydown', event => {
    if (event.target !== element || event.repeat) return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onFlip(); }
    else if (revealed() && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); event.stopPropagation(); onRate(event.key === 'ArrowRight'); }
  }, {signal: abort.signal});
  return () => { abort.abort(); settle?.cancel(); pointer = null; };
}
