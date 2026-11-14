import {createLandscapeStore} from './landscape-store.js';
import {currentTask} from './landscape-engine.js';
import {BOOK_CASES, DECLENSION_GROUPS, CASE_QUESTIONS} from './landscape-curriculum.js';
import {normalizeAnswer,evaluateSession} from './core.js';
import {answerWord,promptFor} from './english.js';
import {subjectInfo} from './subjects.js';
import {writePracticeView,writeAnswerInput} from './write-practice.js';
import {evaluationCorrection} from './feedback.js';
import {installKeyboardSupport} from './keyboard.js';
import {hasAnswerContent} from './answer-fields.js';
import {focusInput} from './input-visibility.js';
import {animateLandscape, bindSwipeCard, cardDeparture, moveToken, prefersReducedMotion} from './landscape-motion.js';

const MODES = {
  cards: {label: 'Wörter kennenlernen', short: 'Karteikarten', icon: 'cards', intro: 'Erst entdecken, dann aus dem Kopf erinnern.'},
  write: {label: 'Vokabeln schreiben', short: 'Schreiben', icon: 'pen', intro: 'Rufe die deutschen Bedeutungen selbstständig ab.'},
  quick: {label: 'Schnell auffrischen', short: 'Auffrischen', icon: 'bolt', intro: 'Eine deutsche Bedeutung genügt. Ganz in deinem Tempo.'},
  matching: {label: 'Wörter verbinden', short: 'Zuordnen', icon: 'link', intro: 'Finde die passenden lateinischen und deutschen Wörter.'},
  sentences: {label: 'Sätze übersetzen', short: 'Sätze', icon: 'sentence', intro: 'Bringe bekannte Wörter in einen neuen Zusammenhang.'},
  sentence: {label: 'Sätze übersetzen', short: 'Sätze', icon: 'sentence', intro: 'Baue die deutsche Übersetzung aus Wortbausteinen.'},
  mixed: {label: 'Gemischt festigen', short: 'Festigen', icon: 'spark', intro: 'Ein passender Wechsel aus Wörtern und Sätzen.'},
  grammar: {label: 'Endungen festigen', short: 'Endungen', icon: 'table', intro: 'Eine kleine Tabelle. Ein weiterer Schritt, der bleibt.'},
  'case-match': {label: 'Fälle verbinden', short: 'Kasusfragen', icon: 'link', intro: 'Ordne jedem Fall seine passende Frage zu.'},
};

const PATHS = {
  cards: '<rect x="6" y="4" width="13" height="16" rx="3"/><path d="m4 7-1 11a3 3 0 0 0 3 3h10M10 9h5m-5 4h3"/>',
  pen: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
  link: '<path d="m10 13 4-4m-5 6-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 1 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>',
  sentence: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M7 9h10M7 13h6m-6 3h8"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M3 15h18M12 4v16"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18m-13 5h3"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 3.5m0 3h.01"/>',
  flip: '<path d="M20 7h-6m6 0V2m0 5a8 8 0 0 0-14-1M4 17h6m-6 0v5m0-5a8 8 0 0 0 14 1"/>',
};

const values = value => Array.isArray(value) ? value : Object.values(value || {});
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const mode = kind => MODES[kind] || MODES.mixed;
const icon = (name, extra = '') => `<svg class="ls-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.spark}</svg>`;
const normalizeEnding = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/^[-−–]/, '').toLowerCase();
const correctFeedback = feedback => feedback?.correct === true || feedback?.ok === true || feedback?.grade === 'full';
const caseLabel = id => BOOK_CASES.find(item => item.id === id)?.label || 'Endungen';
const taskType = task => task?.kind === 'sentences' ? 'sentence' : task?.kind;
const wordLabel = word => word?.latin || word?.prompt || '';
const firstMeaning = word => word?.meanings?.[0]?.[0] || '';
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function stableShuffle(items, seed = '') {
  const result = [...items]; let value = 2166136261;
  for (const c of String(seed)) value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0;
  for (let i = result.length - 1; i > 0; i--) { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; const j = value % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

/** Alternative translations may need additional synonymous tiles; duplicate words keep identities. */
export function sentenceTiles(sentence) {
  const counts = new Map();
  for (const answer of sentence?.translations || []) {
    const variant = new Map();
    for (const text of answer) variant.set(String(text), (variant.get(String(text)) || 0) + 1);
    for (const [text, count] of variant) counts.set(text, Math.max(count, counts.get(text) || 0));
  }
  for (const text of sentence?.distractors || []) if (!counts.has(String(text))) counts.set(String(text), 1);
  const tiles = [];
  for (const [text, count] of counts) for (let i = 0; i < count; i++) tiles.push({id: `tile-${tiles.length}`, text});
  return stableShuffle(tiles, sentence?.id || sentence?.latin || 'sentence');
}

export function missingSentencePunctuation(sentence) {
  if (!sentence?.tokens?.length) return '';
  const ending = String(sentence.prompt || sentence.latin || '').trim().match(/[.!?…]+["'»”)]*$/u)?.[0] || '';
  const tokenText = sentence.tokens.map(token => token.text).join(' ').trim();
  return ending && !tokenText.endsWith(ending) ? ending : '';
}

export function canMatchWords(left, right) {
  if (!left || !right) return false;
  if (left.id === right.id) return true;
  const target = normalizeAnswer(firstMeaning(right));
  return !!target && (left.meanings || []).flat().some(text => normalizeAnswer(text) === target);
}

export function landscapeUI({profile, store, sync, subject = store?.subject || 'latin', h = escape, practiceIcon, notify = () => {}, render = () => {}, go = () => {}, getData = () => store?.data || {}, audio = () => {}, model: suppliedModel} = {}) {
  const model = suppliedModel || createLandscapeStore({store, sync, profile,subject});
  const foreign = subject !== 'latin', language = subjectInfo(subject);
  const targetWord = current => foreign ? answerWord(current.word,current.direction) : current.word;
  const prompt = (word,current = task()) => foreign ? promptFor(word,current?.direction) : wordLabel(word);
  const languages = current => foreign && current?.direction === 'de-en' ? {from:'Deutsch',to:language.label,fromCode:'de',toCode:language.code} : {from:language.label,to:'Deutsch',fromCode:language.code,toCode:'de'};
  const modeInfo = kind => !foreign ? mode(kind) : {...mode(kind),intro:({write:'Rufe die Übersetzungen selbstständig ab – in beide Richtungen.',quick:'Eine passende Übersetzung genügt. Ganz in deinem Tempo.',matching:'Finde die passenden englischen und deutschen Wörter.',sentence:'Baue die Übersetzung aus Wortbausteinen.'})[kind] || mode(kind).intro};
  let loaded = false, loadingError = '', actionError = '', overview = true, modal = null, busy = false;
  let localDraft = {}, draftTask = '', pendingDraft = Promise.resolve(), mounted = null, abort = null, unbindSwipe = null, unbindKeyboard = null;
  let lastFingerprint = '', focusAfterPaint = null, savedModalFocus = null, showHistory = false, matchNotice = '';
  let recommendations = [], disposed = false, helpWord = null, hintWordIds = new Set(), lastAnimatedTask = '', previousTiles = new Set(), previousPairs = new Set();
  const data = () => getData() || {};
  const active = () => model.activeRound || null;
  const task = () => active() ? currentTask(active()) : null;
  const classicWriting = () => loaded && !overview && ['task','feedback'].includes(active()?.phase) && taskType(task()) === 'write';
  const writeOptions = () => ({subject,direction:task()?.direction,h,icon:practiceIcon,actionPrefix:'landscape-'});
  const allowTypos = () => !(foreign && task()?.direction === 'de-en') && data().settings?.general?.typos !== false;
  const roundFinished = round => round?.phase === 'complete' || round?.finished === true;
  const safeAudio = name => { try { audio(name); } catch {} };
  const collectionName = id => data().collections?.[id]?.name || 'Deine Vokabeln';
  const collectionIds = item => item?.collectionIds || (item?.collectionId ? [item.collectionId] : []);
  const collectionNames = item => collectionIds(item).map(collectionName).join(' · ');
  const currentDraft = () => {
    const current = task(), key = `${active()?.id || ''}:${current?.id || active()?.phase || ''}`;
    if (key !== draftTask) { draftTask = key; localDraft = {...(active()?.draft || {})}; hintWordIds = new Set(localDraft.hintedWordIds || []); helpWord = null; matchNotice = ''; }
    return localDraft;
  };
  const fingerprint = () => { const round = active(); return `${round?.id || ''}:${round?.phase || ''}:${task()?.id || ''}:${round?.feedback?.grade || ''}:${round?.paused || false}`; };
  function saveDraft(partial) {
    currentDraft(); localDraft = {...localDraft, ...partial};
    const value = {...localDraft}, roundId = active()?.id;
    pendingDraft = pendingDraft.catch(() => {}).then(() => active()?.id === roundId ? model.updateDraft(value) : null).catch(error => { actionError = error.message || 'Der Zwischenstand konnte nicht gespeichert werden.'; });
    return pendingDraft;
  }
  function captureFocus() {
    const element = globalThis.document?.activeElement;
    if (!element || !mounted?.contains(element)) return null;
    if (element.matches('input,textarea')) return {kind: 'input', name: element.name, field: element.dataset.field, practice:!!element.closest('#practice-answers'), index:[...mounted.querySelectorAll(`input[name="${element.name}"]`)].indexOf(element), start: element.selectionStart, end: element.selectionEnd};
    return null;
  }
  function paint({focus = null} = {}) {
    if (disposed) return;
    focusAfterPaint = focus || focusAfterPaint || captureFocus();
    const element = globalThis.document?.querySelector('[data-landscape-root]');
    if (element && element.classList.contains('ls-classic-writing') !== classicWriting()) { unmountListeners(); render(); return; }
    if (element) { unmountListeners(); const html = view(); if (!patchQuickRound(element, html)) element.outerHTML = html; afterRender(); }
    else render();
  }
  // Keep the native input node alive between quick answers. Replacing a focused
  // input closes the iOS keyboard even if JavaScript immediately focuses its copy.
  function patchQuickRound(element, html) {
    const oldRound = element.querySelector('[data-task-kind="quick"]');
    if (!oldRound || overview || taskType(task()) !== 'quick' || !['task', 'feedback'].includes(active()?.phase)) return false;
    const template = document.createElement('template'); template.innerHTML = html;
    const nextRound = template.content.querySelector('[data-task-kind="quick"]');
    if (!nextRound) return false;
    for (const selector of ['.ls-task-intro', '.ls-word-stack']) {
      const before = oldRound.querySelector(selector), after = nextRound.querySelector(selector);
      if (before && after) before.replaceWith(after);
    }
    const oldHeader = oldRound.querySelector('.ls-progress-label'), newHeader = nextRound.querySelector('.ls-progress-label');
    if (oldHeader && newHeader) oldHeader.innerHTML = newHeader.innerHTML;
    const oldProgress = oldRound.querySelector('.ls-progress-track'), newProgress = nextRound.querySelector('.ls-progress-track');
    if (oldProgress && newProgress) { oldProgress.setAttribute('aria-valuenow', newProgress.getAttribute('aria-valuenow')); oldProgress.firstElementChild.style.transform = newProgress.firstElementChild.style.transform; }
    const form = oldRound.querySelector('.ls-answer-form'), nextForm = nextRound.querySelector('.ls-answer-form');
    const input = form?.querySelector('input'), nextInput = nextForm?.querySelector('input');
    if (!input || !nextInput) return false;
    input.value = nextInput.value; input.readOnly = false; input.setAttribute('enterkeyhint', nextInput.getAttribute('enterkeyhint') || 'done');
    for (const child of [...form.children]) if (!child.classList.contains('ls-writing-inputs')) child.remove();
    for (const child of [...nextForm.children]) if (!child.classList.contains('ls-writing-inputs')) form.append(child);
    for (const selector of ['.ls-feedback', '.ls-inline-error']) {
      oldRound.querySelector(selector)?.remove();
      const addition = nextRound.querySelector(selector); if (addition) oldRound.querySelector('.ls-round-save').before(addition);
    }
    oldRound.dataset.taskId = nextRound.dataset.taskId;
    return true;
  }
  async function perform(operation, {sound = null, focus = null} = {}) {
    if (busy) return;
    busy = true; actionError = '';
    try { await pendingDraft; await operation(); if (sound) safeAudio(sound); }
    catch (error) { actionError = error.message || 'Das hat gerade nicht geklappt. Dein Fortschritt bleibt erhalten.'; notify(actionError); }
    finally { busy = false; paint({focus}); }
  }
  function progress(round) {
    const total = round?.originalCount || round?.tasks?.length || 1;
    const answered = Math.min(total, new Set(round?.completedTaskIds || []).size);
    return {total, answered, percent: Math.round(answered / total * 100)};
  }
  function wordsAvailable() { return values(data().collections).filter(collection => values(data().words).some(word => word.collectionId === collection.id)).sort((a, b) => a.name.localeCompare(b.name, 'de', {numeric: true})); }
  function exams() { return values(model.state?.exams).filter(exam => exam && !exam.endedAt && exam.active !== false); }
  function roundList() { return values(model.state?.rounds).filter(roundFinished).sort((a, b) => (b.completedAt || b.updatedAt || b.createdAt || 0) - (a.completedAt || a.updatedAt || a.createdAt || 0)); }
  function pendingRounds() { return values(model.state?.rounds).filter(round => !roundFinished(round)).sort((a, b) => Number(b.id === active()?.id) - Number(a.id === active()?.id) || (b.updatedAt || 0) - (a.updatedAt || 0)); }
  function pathNodes() {
    const past = roundList(), pending = pendingRounds();
    const visiblePast = showHistory ? past.slice(0, 12).reverse() : past.slice(0, 2).reverse();
    return {past, visiblePast, nodes: [...visiblePast.map(round => ({...round, past: true})), ...pending.map(round => ({...round, resume: true})), ...recommendations.slice(0, pending.length ? 4 : 5)]};
  }
  function actionButton(action, label, {primary = false, className = '', attrs = '', disabled = false} = {}) {
    return `<button type="button" class="ls-button ${primary ? 'ls-primary' : 'ls-secondary'} ${className}" data-action="landscape-${action}" ${attrs}${disabled ? ' disabled' : ''}>${label}</button>`;
  }
  function pathView() {
    recommendations = (typeof model.recommendations === 'function' ? model.recommendations(5) || [] : []).filter(item => item.kind !== 'resume');
    const {past, visiblePast, nodes} = pathNodes();
    const offsets = [-38, 32, 78, 38, -38, -78, -38, 34];
    const height = Math.max(160, nodes.length * 140 + 10);
    const points = nodes.map((_, i) => ({x: 180 + offsets[i % offsets.length], y: 58 + i * 140}));
    const path = points.map((point, i) => i ? `C${points[i - 1].x},${point.y - 70} ${point.x},${point.y - 70} ${point.x},${point.y}` : `M${point.x},${point.y}`).join(' ');
    const exam = exams()[0], next = recommendations[0];
    return `<div class="ls-overview">
      <header class="ls-heading"><div><p class="ls-eyebrow">DEIN LERNWEG <span class="ls-admin-tag">Vorschau für dich</span></p><h1>Wissen, das bleibt.</h1><p>Ein Schritt nach dem anderen. In deinem Tempo.</p></div><span class="ls-heading-mark" aria-hidden="true">${icon('spark')}</span></header>
      <div class="ls-overview-grid"><div class="ls-path-column">
        ${next ? `<div class="ls-next-note"><span class="ls-note-icon">${icon(modeInfo(next.kind).icon)}</span><div><strong>${h(next.label || modeInfo(next.kind).label)}</strong><p>${h(next.reason || modeInfo(next.kind).intro)}</p></div></div>` : ''}
        ${past.length > 2 ? `<button class="ls-history-toggle" type="button" data-action="landscape-history">${showHistory ? 'Verlauf einklappen' : `${past.length} abgeschlossene Runden ansehen`} <span aria-hidden="true">${showHistory ? '↑' : '↓'}</span></button>` : ''}
        <div class="ls-path" style="--path-height:${height}px" aria-label="Deine Lernrunden"><svg class="ls-path-line" viewBox="0 0 360 ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}"/></svg>
        ${nodes.map((node, index) => {
          const current = !node.past && index === visiblePast.length, point = points[index], source = node.caseId ? caseLabel(node.caseId) : collectionNames(node), details = source === node.label ? modeInfo(node.kind).short : source;
          return `<div class="ls-path-stop ${node.past ? 'is-complete' : current ? 'is-current' : ''}" style="--node-x:${point.x / 360 * 100}%;--node-y:${point.y}px;--node-index:${index}"><button class="ls-node" type="button" data-action="landscape-node" data-node="${index}" aria-label="${h(`${node.label || modeInfo(node.kind).label}${details ? ' · ' + details : ''}${node.past ? ' · Wiederholen' : node.resume ? ' · Fortsetzen' : ''}`)}" ${current ? 'aria-current="step"' : ''}>${icon(modeInfo(node.kind).icon)}${node.past ? `<span class="ls-node-check">${icon('check')}</span>` : ''}</button><div class="ls-node-caption"><strong>${h(node.resume ? 'Hier geht es weiter' : node.label || modeInfo(node.kind).short)}</strong><span>${h(details || (node.past ? 'Geschafft' : 'Dein nächster Schritt'))}</span></div></div>`;
        }).join('')}</div>
        ${!nodes.length ? `<div class="ls-empty"><span class="ls-empty-icon">${icon('cards')}</span><h2>Deine Wörter machen den Anfang.</h2><p>Sobald eine Vokabelsammlung vorhanden ist, entsteht hier dein Lernweg.</p></div>` : ''}
      </div><aside class="ls-side-cards" aria-label="Zusätzliche Lernziele">
        <section class="ls-side-card ls-exam-card"><span class="ls-side-icon">${icon('calendar')}</span><p class="ls-eyebrow">DEIN NÄCHSTES ZIEL</p><h2>${h(exam?.title || 'Eine Arbeit steht an?')}</h2><p>${exam ? `Bis ${h(formatDate(exam.date || exam.dueDate))} übst du deine ausgewählten Sammlungen gezielter.` : 'Wähle den Stoff und das Datum. Dein Lernweg kümmert sich um die Wiederholung.'}</p>${exam ? `<div class="ls-exam-chips">${(exam.collectionIds || []).map(id => `<span>${h(collectionName(id))}</span>`).join('')}</div>` : ''}${actionButton('exam', exam ? 'Vorbereitung bearbeiten' : 'Prüfung vorbereiten', {className: 'ls-full', attrs: exam ? `data-id="${h(exam.id)}"` : ''})}</section>
        ${!foreign ? `<section class="ls-side-card"><span class="ls-side-icon ls-lilac">${icon('table')}</span><p class="ls-eyebrow">KLEINER SCHRITT, JEDEN TAG</p><h2>Endungen sicher lernen.</h2><p>Ein Fall nach dem anderen. Dein Lernweg mischt regelmäßig eine kleine Tabelle ein.</p>${actionButton('grammar-picker', 'Zusätzlich Endungen üben', {className: 'ls-full'})}<button type="button" class="ls-text-button" data-action="landscape-case-match">Kasusfragen verbinden ${icon('arrow')}</button></section>` : ''}
        <p class="ls-sync-note" role="status">${syncNote()}</p>
      </aside></div></div>${modalMarkup(nodes)}`;
  }
  function syncNote() {
    if (model.error || model.state?.syncError) return 'Auf diesem Gerät gespeichert. Die Synchronisierung wird erneut versucht.';
    if (globalThis.navigator?.onLine === false) return 'Du lernst offline. Deine Antworten bleiben auf diesem Gerät gespeichert.';
    return 'Dein Fortschritt wird gespeichert. Du kannst jederzeit pausieren.';
  }
  function formatDate(value) {
    const date = new Date(`${String(value || '').slice(0, 10)}T12:00:00`);
    return Number.isNaN(+date) ? 'zum Prüfungstermin' : new Intl.DateTimeFormat('de-DE', {day: 'numeric', month: 'long'}).format(date);
  }
  function modalMarkup(nodes = []) {
    if (!modal) return '';
    let body = '';
    if (modal.type === 'detail') {
      const item = modal.item, info = modeInfo(item.kind), count = item.estimatedCount || item.originalCount || values(data().words).filter(word => collectionIds(item).includes(word.collectionId)).length;
      body = `<span class="ls-modal-symbol">${icon(info.icon)}</span><p class="ls-eyebrow">${item.past ? 'BEREITS GESCHAFFT' : item.resume ? 'DEIN GESPEICHERTER STAND' : 'DEINE NÄCHSTE RUNDE'}</p><h2 id="ls-dialog-title">${h(item.label || info.label)}</h2><p>${h(item.reason || info.intro)}</p><div class="ls-detail-facts">${collectionNames(item) ? `<span>${h(collectionNames(item))}</span>` : ''}${item.caseId ? `<span>${h(caseLabel(item.caseId))}</span>` : ''}${count ? `<span>Etwa ${count} Aufgaben</span>` : ''}<span>${h(info.short)}</span></div>${item.kind === 'write' ? '<p class="ls-small">In der Mitte kannst du eine Pause einlegen. Deine Fehler werden vorher noch einmal geübt.</p>' : ''}${actionButton('start', `${item.resume ? 'Fortsetzen' : item.past ? 'Wiederholen' : 'Lektion starten'} ${icon('arrow')}`, {primary: true, className: 'ls-full'})}`;
    } else if (modal.type === 'exam') {
      const exam = modal.exam || {}, collections = wordsAvailable();
      body = `<span class="ls-modal-symbol">${icon('calendar')}</span><p class="ls-eyebrow">DEIN LERNZIEL</p><h2 id="ls-dialog-title">Für die Arbeit bereit.</h2><p>Dieser Stoff bekommt bis zum Termin mehr Raum in deinem Lernweg.</p><form data-landscape-form="exam"><label class="ls-form-label">Name<input name="exam-title" value="${h(exam.title || 'Meine Klassenarbeit')}" maxlength="80" required></label><label class="ls-form-label">Datum<input name="exam-date" type="date" value="${h(exam.date || exam.dueDate || '')}" required min="${dateKey()}"></label><fieldset class="ls-collection-choices"><legend>Welche Sammlungen kommen vor?</legend>${collections.map(collection => `<label><input type="checkbox" name="exam-collection" value="${h(collection.id)}" ${(exam.collectionIds || []).includes(collection.id) ? 'checked' : ''}><span>${h(collection.name)}</span>${icon('check', 'ls-checkbox-mark')}</label>`).join('')}${!collections.length ? '<p>Es sind noch keine Vokabelsammlungen vorhanden.</p>' : ''}</fieldset><button type="submit" class="ls-button ls-primary ls-full" ${!collections.length ? 'disabled' : ''}>Vorbereitung speichern ${icon('check')}</button></form>${exam.id ? `<button type="button" class="ls-text-button ls-danger" data-action="landscape-exam-end" data-id="${h(exam.id)}">Diese Vorbereitung beenden</button>` : ''}`;
    } else if (modal.type === 'correction') {
      body = evaluationCorrection(targetWord(task()),modal.index,currentDraft().overrides?.[modal.index],{titleId:'ls-dialog-title',formId:'landscape-evaluation-correction-form'});
    } else if (modal.type === 'grammar' && !foreign) {
      body = `<span class="ls-modal-symbol ls-lilac">${icon('table')}</span><p class="ls-eyebrow">ZUSÄTZLICH ÜBEN</p><h2 id="ls-dialog-title">Welchen Fall möchtest du festigen?</h2><p>Dein regulärer Lernweg bleibt erhalten.</p><div class="ls-case-choices">${BOOK_CASES.map(item => actionButton('grammar-start', `${h(item.label)} ${icon('arrow')}`, {attrs: `data-id="${h(item.id)}"`})).join('')}</div>`;
    }
    return `<div class="ls-modal-layer"><button type="button" class="ls-modal-shade" data-action="landscape-modal-close" aria-label="Fenster schließen" tabindex="-1"></button><section class="ls-modal" role="dialog" aria-modal="true" aria-labelledby="ls-dialog-title" tabindex="-1"><button type="button" class="ls-icon-button ls-modal-close" data-action="landscape-modal-close" aria-label="Schließen">${icon('close')}</button>${body}${actionError ? `<p class="ls-inline-error" role="alert">${h(actionError)}</p>` : ''}</section></div>`;
  }
  function roundHeader(round) {
    const p = progress(round);
    return `<header class="ls-round-header"><button type="button" class="ls-icon-button" data-action="landscape-pause" aria-label="Runde pausieren und zum Lernweg zurückkehren">${icon('close')}</button><div class="ls-round-progress"><div class="ls-progress-label"><span>${h(round.label || modeInfo(round.kind).label)}</span><span>${p.answered} / ${p.total}</span></div><div class="ls-progress-track" role="progressbar" aria-label="Aufgaben bearbeitet" aria-valuenow="${p.answered}" aria-valuemin="0" aria-valuemax="${p.total}"><span style="transform:scaleX(${p.percent / 100})"></span></div></div><span class="ls-round-mode">${icon(modeInfo(task()?.kind || round.kind).icon)}</span></header>`;
  }
  function roundView(round) {
    if (round.phase === 'checkpoint') return checkpointView(round);
    if (roundFinished(round)) return completeView(round);
    const current = task(); currentDraft();
    if (!current) return `<div class="ls-round">${roundHeader(round)}<div class="ls-empty"><h2>Dein nächster Schritt wird vorbereitet.</h2>${actionButton('pause', 'Zur Lernlandschaft')}</div></div>`;
    const type = taskType(current), feedback = round.phase === 'feedback' ? round.feedback : null;
    if (type === 'write') {
      const p = progress(round), d = currentDraft(), headerIcon = practiceIcon || icon;
      return `<header class="test-top"><button class="icon-button" data-action="landscape-pause" aria-label="Runde pausieren">${headerIcon('close')}</button><div class="test-progress"><div style="width:${p.percent}%"></div></div><span class="small muted">${Math.min(p.answered + 1,p.total)} / ${p.total}</span></header>${writePracticeView({word:current.word,...writeOptions(),answers:d.answers || [''],feedback,correctionMode:d.correctionMode,correctionAnswers:d.correctionAnswers || [''],correctionResult:d.correctionResult})}${actionError ? `<p class="ls-inline-error" role="alert">${h(actionError)}</p>` : ''}${modalMarkup()}`;
    }
    const content = type === 'cards' ? cardsView(current, feedback) : type === 'quick' ? quickView(current, feedback) : type === 'matching' || type === 'case-match' ? matchingView(current, feedback) : type === 'sentence' ? sentenceView(current, feedback) : type === 'grammar' ? grammarView(current, feedback) : '<p>Diese Aufgabe wird vorbereitet.</p>';
    return `<div class="ls-round" data-task-id="${h(current.id)}" data-task-kind="${h(type)}">${roundHeader(round)}${round.contentNotice ? `<p class="ls-content-note" role="status">${h(round.contentNotice)}</p>` : ''}<div class="ls-task-stage">${content}</div>${feedback ? feedbackView(current, feedback) : ''}${actionError ? `<p class="ls-inline-error" role="alert">${h(actionError)}</p>` : ''}<p class="ls-round-save">${icon('pause')} Dein Stand bleibt erhalten, wenn du pausierst.</p></div>`;
  }
  function cardsView(current, feedback) {
    const d = currentDraft(), flipped = d.flipped === true, word = targetWord(current), source = prompt(current.word,current), lang = languages(current);
    return `<div class="ls-task-intro"><p class="ls-eyebrow">KENNENLERNEN</p><h2>${foreign && current.direction === 'de-en' ? 'Wie heißt das auf ' + language.label + '?' : 'Was bedeutet dieses Wort?'}</h2><p>Denke kurz nach. Tippe dann auf die Karte.</p></div><div class="ls-card-stack"><span class="ls-stack-back ls-stack-back-two"></span><span class="ls-stack-back"></span><div class="ls-flashcard ${flipped ? 'is-flipped' : ''}" data-flashcard data-action="landscape-flip" role="button" tabindex="0" aria-label="${h(flipped ? lang.to + '. Karte zurückdrehen.' : source + '. Karte umdrehen.')}" aria-pressed="${flipped}"><div class="ls-card-turn"><div class="ls-card-face ls-card-front" ${flipped ? 'aria-hidden="true"' : ''}><span class="ls-card-language">${h(lang.from.toUpperCase())}</span><strong lang="${lang.fromCode}">${h(source)}</strong><span class="ls-card-hint">${icon('flip')} Antippen zum Umdrehen</span></div><div class="ls-card-face ls-card-back" ${!flipped ? 'aria-hidden="true"' : ''}><span class="ls-card-language">${h(lang.to.toUpperCase())}</span><div class="ls-card-meanings">${(word?.meanings || []).map(group => `<p>${h(group.join(' / '))}</p>`).join('')}</div><span class="ls-card-hint">${h(source)}</span></div></div><span class="ls-swipe-label" data-swipe-label aria-hidden="true"></span></div></div><div class="ls-card-controls">${actionButton('card-wrong', `${icon('back')} Noch üben`, {disabled: !flipped || !!feedback, className: 'ls-rate-wrong'})}${actionButton('card-right', `Gewusst ${icon('arrow')}`, {disabled: !flipped || !!feedback, className: 'ls-rate-right'})}</div><p class="ls-gesture-caption">${flipped ? 'Nach links zum Üben · nach rechts, wenn du es wusstest' : 'Erst aufdecken, dann nach links oder rechts wischen'}</p>`;
  }
  function quickView(current, feedback) {
    const word = targetWord(current), d = currentDraft(), lang = languages(current), answers = d.answers || [''];
    return `<div class="ls-task-intro"><p class="ls-eyebrow">SCHNELL AUFFRISCHEN</p><h2>Eine Bedeutung genügt.</h2><p>Ein kurzer Abruf, ganz ohne Zeitdruck.</p></div><div class="ls-word-stack is-quick"><span class="ls-stack-back ls-stack-back-two"></span><span class="ls-stack-back"></span><div class="ls-word-card ${feedback ? correctFeedback(feedback) ? 'is-right' : 'is-wrong' : ''}" data-quick-card><span>${h(lang.from.toUpperCase())}</span><h3 lang="${lang.fromCode}">${h(prompt(current.word,current))}</h3>${feedback ? `<p>${h((word?.meanings || []).map(group => group[0]).join(' · '))}</p>` : ''}</div></div><form class="ls-answer-form" data-landscape-form="answer"><div class="ls-writing-inputs"><label class="ls-answer-label"><span class="ls-visually-hidden">${lang.to === 'Deutsch' ? 'Deutsche Bedeutung' : 'Antwort auf ' + lang.to}</span><input name="answer-0" data-field="answer" data-index="0" type="text" inputmode="text" enterkeyhint="${feedback ? 'next' : 'done'}" placeholder="${lang.to === 'Deutsch' ? 'Eine deutsche Bedeutung …' : 'Wort auf ' + lang.to + ' …'}" value="${h(answers[0] || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="300"></label></div>${!feedback ? `<button type="submit" class="ls-button ls-primary ls-full" data-submit-answer ${!answers.some(value => String(value).trim()) ? 'disabled' : ''}>Überprüfen ${icon('check')}</button><button type="button" class="ls-text-button" data-action="landscape-unknown">Ich weiß es noch nicht</button>` : ''}</form>`;
  }
  function matchingItems(current) {
    if (current.kind !== 'case-match') return current.words || [];
    const selected = current.cases || current.caseIds || BOOK_CASES;
    return selected.map(item => typeof item === 'string' ? {id: item, latin: caseLabel(item), meanings: [[CASE_QUESTIONS[item]]]} : {id: item.id || item.caseId, latin: item.label || caseLabel(item.id || item.caseId), meanings: [[item.answer || item.question || CASE_QUESTIONS[item.id || item.caseId]]]});
  }
  function matchingView(current, feedback) {
    const items = matchingItems(current), d = currentDraft(), pairs = d.pairs || [], usedLeft = new Set(pairs.map(pair => pair.wordId)), usedRight = new Set(pairs.map(pair => pair.meaningWordId));
    return `<div class="ls-task-intro"><p class="ls-eyebrow">${current.kind === 'case-match' ? 'KASUSFRAGEN' : 'WÖRTER VERBINDEN'}</p><h2>Welche gehören zusammen?</h2><p>Tippe links und rechts das passende Paar an.</p></div><div class="ls-matching-labels"><span>${current.kind === 'case-match' ? 'Fall' : languages(current).from}</span><span>${current.kind === 'case-match' ? 'Frage' : languages(current).to}</span></div><div class="ls-matching"><div>${stableShuffle(items, current.id + ':left').map(word => `<button type="button" class="ls-match-tile ${usedLeft.has(word.id) ? 'is-matched' : d.matchLeft === word.id ? 'is-selected' : ''}" data-action="landscape-match-left" data-id="${h(word.id)}" ${usedLeft.has(word.id) || feedback ? 'disabled' : ''} aria-pressed="${d.matchLeft === word.id}">${usedLeft.has(word.id) ? icon('check') : ''}<span>${h(current.kind === 'case-match' ? wordLabel(word) : prompt(word,current))}</span></button>`).join('')}</div><div>${stableShuffle(items, current.id + ':right').map(word => `<button type="button" class="ls-match-tile ${usedRight.has(word.id) ? 'is-matched' : d.matchRight === word.id ? 'is-selected' : ''}" data-action="landscape-match-right" data-id="${h(word.id)}" ${usedRight.has(word.id) || feedback ? 'disabled' : ''} aria-pressed="${d.matchRight === word.id}">${usedRight.has(word.id) ? icon('check') : ''}<span>${h(foreign && current.direction === 'de-en' ? wordLabel(word) : firstMeaning(word))}</span></button>`).join('')}</div></div><p class="ls-match-notice ${matchNotice.startsWith('Noch') ? 'is-wrong' : ''}" role="status">${h(matchNotice || `${pairs.length} von ${items.length} Paaren verbunden`)}</p>`;
  }
  function sentenceView(current, feedback) {
    const sentence = current.sentence, d = currentDraft(), tiles = sentenceTiles(sentence), selected = (d.tileIds || []).map(id => tiles.find(tile => tile.id === id)).filter(Boolean), selectedIds = new Set(selected.map(tile => tile.id));
    const tokens = sentence?.tokens?.length ? sentence.tokens : String(sentence?.prompt || sentence?.latin || '').split(/\s+/).map(text => ({text}));
    return `<div class="ls-task-intro"><p class="ls-eyebrow">IM ZUSAMMENHANG</p><h2>Übersetze diesen Satz.</h2><p>Tippe ${foreign ? 'ein unterstrichenes' : 'ein lateinisches'} Wort an, wenn du eine kleine Hilfe brauchst.</p></div><div class="ls-latin-sentence" lang="${h(sentence.promptLanguage || (foreign ? 'de' : 'la'))}">${tokens.map((token, index) => token.wordId ? `<button type="button" class="ls-latin-token ${hintWordIds.has(token.wordId) ? 'is-hinted' : ''}" data-action="landscape-word-help" data-id="${h(token.wordId)}" data-token-index="${index}" aria-label="Bedeutungen zu ${h(token.text)} anzeigen">${h(token.text)}</button>` : `<span>${h(token.text)}</span>`).join(' ')}${missingSentencePunctuation(sentence) ? `<span class="ls-sentence-punctuation">${h(missingSentencePunctuation(sentence))}</span>` : ''}</div>${helpWord ? wordHelpView(helpWord) : ''}<div class="ls-sentence-answer ${feedback ? correctFeedback(feedback) ? 'is-right' : 'is-wrong' : ''}" aria-label="Deine Übersetzung" data-answer-area>${selected.length ? selected.map((tile, index) => `<button type="button" class="ls-token ls-answer-token ${d.focusTile === tile.id ? 'is-selected' : ''}" data-action="landscape-token-focus" data-id="${tile.id}" data-answer-index="${index}" aria-pressed="${d.focusTile === tile.id}" ${feedback ? 'disabled' : ''}>${h(tile.text)}</button>`).join('') : '<span class="ls-answer-placeholder">Deine ' + (sentence.answerLanguage === 'en' ? 'englische' : 'deutsche') + ' Übersetzung …</span>'}</div>${selected.length && !feedback ? `<div class="ls-token-tools" aria-label="Ausgewählten Baustein bearbeiten">${actionButton('token-left', `${icon('back')} Links`, {disabled: !d.focusTile || selected.findIndex(tile => tile.id === d.focusTile) < 1})}${actionButton('token-remove', 'Entfernen', {disabled: !d.focusTile})}${actionButton('token-right', `Rechts ${icon('arrow')}`, {disabled: !d.focusTile || selected.findIndex(tile => tile.id === d.focusTile) === selected.length - 1})}</div>` : '<div class="ls-token-tools-spacer"></div>'}<div class="ls-token-bank" aria-label="${sentence.answerLanguage === 'en' ? 'Englische' : 'Deutsche'} Wortbausteine" lang="${h(sentence.answerLanguage || 'de')}">${tiles.map(tile => `<button type="button" class="ls-token ${selectedIds.has(tile.id) ? 'is-used' : ''}" data-action="landscape-token-add" data-id="${tile.id}" ${selectedIds.has(tile.id) || feedback ? 'disabled' : ''} aria-label="${h(tile.text)}${selectedIds.has(tile.id) ? ', bereits eingesetzt' : ' einsetzen'}">${h(tile.text)}</button>`).join('')}</div>${!feedback ? actionButton('sentence-check', `Überprüfen ${icon('check')}`, {primary: true, className: 'ls-full', disabled: !selected.length}) : ''}`;
  }
  function wordHelpView(wordId) {
    const word = data().words?.[wordId] || task()?.sentence?.vocabulary?.find(item => item.id === wordId);
    return `<aside class="ls-word-help" role="note" aria-label="Worthilfe"><div><strong>${h(wordLabel(word) || 'Worthilfe')}</strong><button type="button" class="ls-icon-button" data-action="landscape-help-close" aria-label="Worthilfe schließen">${icon('close')}</button></div>${(word?.meanings || []).map(group => `<p>${h(group.join(' / '))}</p>`).join('') || '<p>Die Bedeutung ist in dieser Sammlung nicht hinterlegt.</p>'}</aside>`;
  }
  function grammarView(current, feedback) {
    const d = currentDraft(), hidden = new Set(current.hiddenIds || []), answers = d.grammarAnswers || {}, stage = current.stage || 'full';
    return `<div class="ls-task-intro"><p class="ls-eyebrow">${stage === 'study' ? 'ERST EINMAL ANSEHEN' : stage === 'pairs' ? 'SCHRITT FÜR SCHRITT' : 'JETZT AUS DEM KOPF'}</p><h2>${h(caseLabel(current.caseId))}</h2><p>${stage === 'study' ? 'Schau dir die Endungen an. Gleich verschwinden die ersten zwei.' : stage === 'pairs' ? 'Ergänze die leeren Felder. Die übrigen Endungen helfen dir.' : 'Trage die Endungen ein. Du brauchst keine vollständigen Wörter.'}</p></div><form data-landscape-form="grammar"><div class="ls-endings" role="table" aria-label="${h(caseLabel(current.caseId))}: Endungen nach Deklination"><div class="ls-endings-head" role="row"><span role="columnheader">Singular</span><span role="columnheader">Plural</span></div>${DECLENSION_GROUPS.map(group => `<div class="ls-ending-row" role="row"><div class="ls-ending-group" role="rowheader">${h(group.label)}${group.id === 'third' && !group.label.includes('senātor') ? '<span>nach dem Muster senātor</span>' : ''}</div><div class="ls-ending-cells">${['sg', 'pl'].map(number => {
      const cell = (current.cells || []).find(item => item.groupId === group.id && item.number === number); if (!cell) return '<div role="cell"></div>';
      const editable = cell.editable !== false, isHidden = editable && stage !== 'study' && (stage === 'full' || hidden.has(cell.id)), good = feedback && isHidden && normalizeEnding(answers[cell.id]) === normalizeEnding(cell.answer);
      return `<div class="ls-ending-cell ${!editable ? 'is-fixed' : isHidden ? 'is-hidden' : 'is-revealed'} ${feedback && isHidden ? good ? 'is-right' : 'is-wrong' : ''}" role="cell">${isHidden ? `<label><span class="ls-visually-hidden">${h(group.label)} ${number === 'sg' ? 'Singular' : 'Plural'}</span><input type="text" data-field="ending" name="${h(cell.id)}" value="${h(answers[cell.id] || '')}" maxlength="24" autocapitalize="off" autocomplete="off" spellcheck="false" enterkeyhint="next" placeholder="…" ${feedback ? 'readonly' : ''}></label>${feedback && !good ? `<span class="ls-ending-correction">${h(cell.answer)}</span>` : ''}` : `<span>${h(cell.answer)}</span>`}</div>`;
    }).join('')}</div></div>`).join('')}</div>${!feedback ? stage === 'study' ? actionButton('grammar-memorized', `Ich habe es mir gemerkt ${icon('arrow')}`, {primary: true, className: 'ls-full'}) : `<button type="submit" class="ls-button ls-primary ls-full">Endungen überprüfen ${icon('check')}</button>` : ''}</form>${stage !== 'study' ? `<button type="button" class="ls-text-button" data-action="landscape-grammar-help">${icon('help')} Noch einmal mit Hilfe lernen</button>` : ''}`;
  }
  function feedbackView(current, feedback) {
    const good = correctFeedback(feedback), type = taskType(current), word = current.word;
    let detail = '';
    if (!good && word) detail = `<div class="ls-correction-list">${(targetWord(current).meanings || []).map(group => `<span>${h(group.join(' / '))}</span>`).join('')}</div>`;
    if (!good && type === 'sentence') detail = `<p class="ls-sentence-solution">${h(current.sentence?.translations?.[0]?.join(' ') || '')}</p>`;
    return `<section class="ls-feedback ${good ? 'is-right' : 'is-wrong'}" role="status"><div class="ls-feedback-heading"><span>${icon(good ? 'check' : 'help')}</span><div><strong>${good ? 'Das sitzt für diese Runde.' : feedback?.grade === 'partial' ? 'Schon ein guter Anfang.' : 'Das üben wir noch einmal.'}</strong><p>${good ? type === 'cards' ? 'Die Karte ist geschafft.' : 'Weiter zum nächsten kleinen Schritt.' : type === 'quick' ? 'Die Karte wandert nach hinten und kommt später wieder.' : 'Die richtige Lösung hilft dir beim nächsten Versuch.'}</p></div></div>${detail}${actionButton('next', `Weiter ${icon('arrow')}`, {primary: true, className: 'ls-full'})}</section>`;
  }
  function checkpointView(round) {
    const p = progress(round);
    return `<div class="ls-round">${roundHeader(round)}<section class="ls-milestone"><div class="ls-milestone-mark">${icon('check')}<i></i><i></i><i></i></div><p class="ls-eyebrow">DEIN CHECKPOINT</p><h1>Die erste Hälfte ist geschafft.</h1><p>Du hast ${p.answered} von ${p.total} Aufgaben bearbeitet und die Fehler dieser Hälfte noch einmal geübt.</p><div class="ls-milestone-progress"><span style="transform:scaleX(${Math.max(.5, p.percent / 100)})"></span></div><p class="ls-small">Du entscheidest, ob es jetzt weitergeht. Dein Stand bleibt gespeichert.</p>${actionButton('continue', `Weiterlernen ${icon('arrow')}`, {primary: true, className: 'ls-full'})}${actionButton('pause', 'Für heute beenden', {className: 'ls-full'})}</section></div>`;
  }
  function completeView(round) {
    return `<section class="ls-milestone ls-round-complete"><div class="ls-milestone-mark">${icon('spark')}<i></i><i></i><i></i></div><p class="ls-eyebrow">RUNDE GESCHAFFT</p><h1>Ein weiterer Schritt bleibt.</h1><p>${h(round.label || modeInfo(round.kind).label)}${collectionNames(round) ? ` · ${h(collectionNames(round))}` : ''}</p><div class="ls-complete-stat"><strong>${round.originalCount || round.tasks?.length || 0}</strong><span>Aufgaben bearbeitet</span></div><p>Dein Lernweg berücksichtigt, was schon klappt und was du später noch einmal festigen kannst.</p>${actionButton('finish', `Zur Lernlandschaft ${icon('arrow')}`, {primary: true, className: 'ls-full'})}</section>`;
  }
  function view() {
    if (profile?.role !== 'admin') return '<section class="ls-empty"><p>Diese Vorschau ist nur für den Admin verfügbar.</p></section>';
    const round = active();
    const content = !loaded ? `<div class="ls-loading" role="status"><span class="ls-loading-mark">${icon('spark')}</span><h2>Dein Lernweg wird vorbereitet.</h2><p>Ein kleiner Moment …</p></div>` : loadingError ? `<div class="ls-empty"><h2>Dein Lernweg wartet auf dich.</h2><p>${h(loadingError)}</p>${actionButton('reload', 'Noch einmal versuchen', {primary: true})}</div>` : !overview && round ? roundView(round) : pathView();
    const full = classicWriting(),tag = full ? 'main' : 'section';
    return `<${tag} class="${full ? 'test-shell ls-classic-writing ' : ''}landscape-shell ${!overview && round ? 'is-learning' : ''}" data-landscape-root data-subject="${h(subject)}" aria-label="Lernlandschaft">${content}</${tag}>`;
  }
  function openModal(next) {
    savedModalFocus = globalThis.document?.activeElement;
    modal = next; actionError = ''; paint();
  }
  function closeOwnModal() {
    const action = savedModalFocus?.dataset?.action, node = savedModalFocus?.dataset?.node, id = savedModalFocus?.dataset?.id;
    modal = null; actionError = ''; paint();
    if (action) mounted?.querySelector(`[data-action="${CSS.escape(action)}"]${node !== undefined ? `[data-node="${CSS.escape(node)}"]` : id !== undefined ? `[data-id="${CSS.escape(id)}"]` : ''}`)?.focus({preventScroll: true});
    savedModalFocus = null;
  }
  async function startRound(options) {
    await perform(async () => { if (active() && !roundFinished(active())) await model.pause(); await model.start(options); overview = false; modal = null; draftTask = ''; focusAfterPaint = {kind: 'first'}; }, {sound: 'start'});
  }
  async function rateCard(known) {
    if (busy || !currentDraft().flipped || active()?.phase === 'feedback') return;
    cardDeparture(mounted?.querySelector('[data-flashcard]'), {direction: known ? 1 : -1});
    await perform(async () => { await model.answer(known); safeAudio(known ? 'right' : 'wrong'); if (active()?.phase === 'feedback') await model.next(); draftTask = ''; });
  }
  function flipCard() {
    if (busy || taskType(task()) !== 'cards' || active()?.phase === 'feedback') return;
    const flipped = !currentDraft().flipped;
    saveDraft({flipped});
    const card = mounted?.querySelector('[data-flashcard]');
    if (!card) return paint();
    card.classList.toggle('is-flipped', flipped); card.setAttribute('aria-pressed', String(flipped));
    card.setAttribute('aria-label', flipped ? 'Deutsche Bedeutungen. Karte zurückdrehen.' : `${wordLabel(task()?.word)}. Karte umdrehen.`);
    card.querySelector('.ls-card-front')?.setAttribute('aria-hidden', String(flipped));
    card.querySelector('.ls-card-back')?.setAttribute('aria-hidden', String(!flipped));
    mounted.querySelectorAll('[data-action="landscape-card-right"],[data-action="landscape-card-wrong"]').forEach(button => button.disabled = !flipped);
    const caption = mounted.querySelector('.ls-gesture-caption'); if (caption) caption.textContent = flipped ? 'Nach links zum Üben · nach rechts, wenn du es wusstest' : 'Erst aufdecken, dann nach links oder rechts wischen';
  }
  async function checkCurrentAnswer(unknown = false) {
    if (active()?.phase === 'feedback') return taskType(task()) === 'write' && currentDraft().correctionMode ? submitCorrection() : next();
    const current = task(), type = taskType(current), d = currentDraft();
    let answer;
    if (type === 'write' || type === 'quick') { answer = unknown ? [''] : type === 'write' ? readWriteAnswers() : d.answers || []; if (!unknown && !hasAnswerContent(answer)) return; }
    else if (type === 'sentence') { answer = (d.tileIds || []).map(id => sentenceTiles(current.sentence).find(tile => tile.id === id)?.text).filter(value => value !== undefined); if (!answer.length) return; }
    else if (type === 'grammar') { answer = d.grammarAnswers || {}; }
    else return;
    await perform(async () => { await model.answer(answer, {hinted: hintWordIds.size > 0, hintedWordIds: [...hintWordIds],allowTypos:allowTypos()}); safeAudio(correctFeedback(active()?.feedback) ? 'right' : 'wrong'); }, {focus: {kind: 'feedback'}});
  }
  function readWriteAnswers(practice = false) {
    return [...(mounted?.querySelectorAll(`${practice ? '#practice-answers' : '#answers'} input[name="answer"]`) || [])].map(field=>field.value);
  }
  function appendWriteField(practice = false) {
    if (busy) return;
    const host = mounted?.querySelector(practice ? '#practice-answers' : '#answers'); if (!host) return;
    host.insertAdjacentHTML('beforeend',writeAnswerInput('',host.querySelectorAll('input').length,false,writeOptions()));
    void saveDraft({[practice ? 'correctionAnswers' : 'answers']:readWriteAnswers(practice)});
    focusInput(host.lastElementChild?.querySelector('input'));
  }
  async function beginCorrection(initial = '') {
    if (busy || active()?.phase !== 'feedback' || correctFeedback(active()?.feedback)) return;
    await saveDraft({correctionMode:true,correctionAnswers:[initial],correctionResult:null});
    paint({focus:{kind:'input',name:'answer',practice:true,index:0,start:initial.length,end:initial.length}});
  }
  async function submitCorrection() {
    if (busy || !currentDraft().correctionMode) return;
    const answers = readWriteAnswers(true); if (!hasAnswerContent(answers)) return;
    const result = evaluateSession(targetWord(task()),answers,allowTypos(),{},{meaningRequirement:'all'});
    await saveDraft({correctionAnswers:answers,correctionResult:result});
    safeAudio(result.grade === 'full' ? 'right' : 'wrong');
    paint({focus:result.grade === 'full' ? {kind:'feedback'} : {kind:'input',name:'answer',practice:true,index:0}});
  }
  async function correctEvaluation(form) {
    const overrides = {...currentDraft().overrides,[Number(form.dataset.index)]:new FormData(form).getAll('group').map(Number)};
    await perform(async()=>{await model.correctEvaluation(overrides);await saveDraft({overrides});modal=null;},{focus:{kind:'feedback'}});
  }
  async function next() {
    const current = task();
    if (current?.kind === 'write' && currentDraft().correctionMode && currentDraft().correctionResult?.grade !== 'full') return;
    if (current?.kind === 'quick' && active()?.phase === 'feedback') cardDeparture(mounted?.querySelector('[data-quick-card]'), {behind: !correctFeedback(active().feedback), direction: 1});
    await perform(async () => { await model.next(); draftTask = ''; }, {focus: {kind: 'first'}});
  }
  async function match(side, id) {
    if (busy || active()?.phase === 'feedback') return;
    const current = task(), d = currentDraft(), items = matchingItems(current), update = side === 'left' ? {matchLeft: id} : {matchRight: id};
    await saveDraft(update);
    if (!localDraft.matchLeft || !localDraft.matchRight) return paint();
    const left = items.find(word => word.id === localDraft.matchLeft), right = items.find(word => word.id === localDraft.matchRight), pair = {wordId: left?.id, meaningWordId: right?.id};
    if (!left || !right) return;
    const matched = current.kind === 'case-match' ? left.id === right.id : canMatchWords(left, right);
    if (matched) {
      const pairs = [...(localDraft.pairs || []), pair];
      await saveDraft({pairs, matchLeft: null, matchRight: null}); matchNotice = pairs.length === items.length ? 'Alle Paare gefunden.' : 'Diese beiden gehören zusammen.'; safeAudio('right');
      if (pairs.length === items.length) await perform(() => model.answer(current.kind === 'case-match' ? {...Object.fromEntries(pairs.map(pair => [pair.wordId, pair.meaningWordId])), _mistakes: localDraft.mistakes || []} : {pairs, mistakes: localDraft.mistakes || []})); else paint();
    } else {
      await saveDraft({mistakes: [...(localDraft.mistakes || []), pair], matchLeft: null, matchRight: null}); matchNotice = 'Noch nicht ganz. Probiere ein anderes Paar.'; safeAudio('wrong'); paint();
      for (const sideName of ['left', 'right']) { const tile = mounted?.querySelector(`[data-action="landscape-match-${sideName}"][data-id="${CSS.escape(sideName === 'left' ? left.id : right.id)}"]`); animateLandscape(tile, [{transform: 'translateX(0)'}, {transform: 'translateX(-4px)'}, {transform: 'translateX(4px)'}, {transform: 'translateX(0)'}], {duration: 200}); }
    }
  }
  async function manipulateToken(action, id, source) {
    const current = task(), d = currentDraft(); if (active()?.phase === 'feedback' || taskType(current) !== 'sentence') return;
    let ids = [...(d.tileIds || [])], focusTile = d.focusTile;
    if (action === 'add') {
      if (ids.includes(id)) return;
      const tile = sentenceTiles(current.sentence).find(item => item.id === id); if (!tile) return;
      moveToken(source, mounted?.querySelector('[data-answer-area]'), tile.text); ids.push(id); focusTile = id;
    } else if (action === 'focus') { focusTile = id; }
    else if (action === 'remove') { const index = ids.indexOf(focusTile); ids = ids.filter(item => item !== focusTile); focusTile = ids[Math.max(0, index - 1)] || null; }
    else { const from = ids.indexOf(focusTile), to = from + (action === 'left' ? -1 : 1); if (from < 0 || to < 0 || to >= ids.length) return; [ids[from], ids[to]] = [ids[to], ids[from]]; }
    await saveDraft({tileIds: ids, focusTile}); paint();
    if (focusTile) mounted?.querySelector(`[data-action="landscape-token-focus"][data-id="${focusTile}"]`)?.focus({preventScroll: true});
  }
  async function saveExam(form) {
    if (!form.reportValidity()) return;
    const fields = new FormData(form), collectionIds = fields.getAll('exam-collection').map(String);
    const exam = {...(modal?.exam || {}), title: String(fields.get('exam-title') || '').trim(), date: String(fields.get('exam-date') || ''), collectionIds};
    if (modal) modal.exam = exam;
    if (!collectionIds.length) { actionError = 'Wähle mindestens eine Sammlung aus.'; paint(); return; }
    await perform(async () => { await model.saveExam(exam); modal = null; });
  }
  async function handle(button) {
    const action = button?.dataset?.action; if (!action?.startsWith('landscape-')) return false;
    if (profile?.role !== 'admin') return true;
    const name = action.slice(10), id = button.dataset.id;
    if (name === 'flip') { flipCard(); return true; }
    if (busy && !['modal-close'].includes(name)) return true;
    if (name === 'node') {
      const {nodes} = pathNodes();
      const item = nodes[Number(button.dataset.node)]; if (item) { safeAudio('select'); openModal({type: 'detail', item}); }
    } else if (name === 'start') {
      const item = modal?.item; if (!item) return true;
      if (item.resume) await perform(async () => { await model.resume(item.id); overview = false; modal = null; }, {sound: 'start', focus: {kind: 'first'}});
      else await startRound({kind: item.kind, collectionId: item.collectionId || item.collectionIds?.[0], caseId: item.caseId, wordIds: item.wordIds, carryWordIds: item.carryWordIds, direction: item.direction});
    } else if (name === 'modal-close') closeOwnModal();
    else if (name === 'history') { showHistory = !showHistory; paint(); }
    else if (name === 'exam') openModal({type: 'exam', exam: exams().find(item => item.id === id) || null});
    else if (name === 'exam-end') await perform(async () => { await model.endExam(id); modal = null; });
    else if (name === 'grammar-picker' && !foreign) openModal({type: 'grammar'});
    else if (name === 'grammar-start' && !foreign) await startRound({kind: 'grammar', caseId: id});
    else if (name === 'case-match' && !foreign) await startRound({kind: 'case-match'});
    else if (name === 'card-right' || name === 'card-wrong') await rateCard(name === 'card-right');
    else if (name === 'next' || name === 'continue' || name === 'grammar-memorized') await next();
    else if (name === 'pause' || name === 'finish') await perform(async () => { await model.pause(); overview = true; helpWord = null; }, {focus: {kind: 'heading'}});
    else if (name === 'add-answer') appendWriteField();
    else if (name === 'practice-add') appendWriteField(true);
    else if (name === 'remove-answer') {
      const row = button.closest('.answer-row'), practice = !!row?.closest('#practice-answers');
      row?.remove(); await saveDraft({[practice ? 'correctionAnswers' : 'answers']:readWriteAnswers(practice)});
    }
    else if (name === 'correct-evaluation') openModal({type:'correction',index:Number(button.dataset.index)});
    else if (name === 'retry-submit') await submitCorrection();
    else if (name === 'unknown' || name === 'dont-know') await checkCurrentAnswer(true);
    else if (name === 'match-left' || name === 'match-right') await match(name.slice(6), id);
    else if (name.startsWith('token-')) await manipulateToken(name.slice(6), id, button);
    else if (name === 'sentence-check') await checkCurrentAnswer();
    else if (name === 'word-help') { helpWord = id; hintWordIds.add(id); await saveDraft({hintedWordIds: [...hintWordIds]}); paint(); }
    else if (name === 'help-close') { helpWord = null; paint(); }
    else if (name === 'grammar-help') await perform(async () => { await model.grammarHelp(); draftTask = ''; });
    else if (name === 'reload') await initialize();
    return true;
  }
  function input(event) {
    const target = event.target; if (!target?.closest?.('[data-landscape-root]')) return false;
    if (target.name === 'answer' && target.closest('#answer-form')) {
      const practice = !!target.closest('#practice-answers');
      void saveDraft({[practice ? 'correctionAnswers' : 'answers']:readWriteAnswers(practice)});
      event.stopPropagation(); return true;
    }
    if (target.dataset.field === 'answer') {
      const answers = [...(currentDraft().answers || [])]; answers[Number(target.dataset.index)] = target.value; saveDraft({answers});
      const submit = mounted?.querySelector('[data-submit-answer]'); if (submit) submit.disabled = !answers.some(value => String(value || '').trim()); event.stopPropagation(); return true;
    }
    if (target.dataset.field === 'ending') { saveDraft({grammarAnswers: {...(currentDraft().grammarAnswers || {}), [target.name]: target.value}}); event.stopPropagation(); return true; }
    return false;
  }
  function submit(event) {
    const form = event.target?.closest?.('[data-landscape-form],#answer-form,#landscape-evaluation-correction-form'); if (!form || !form.closest('[data-landscape-root]')) return false;
    event.preventDefault(); event.stopPropagation();
    if (form.id === 'landscape-evaluation-correction-form') void correctEvaluation(form);
    else if (form.dataset.landscapeForm === 'exam') void saveExam(form); else void checkCurrentAnswer();
    return true;
  }
  function keydown(event) {
    if (modal && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeOwnModal(); return; }
    const dialog = mounted?.querySelector('[role="dialog"]');
    if (dialog && event.key === 'Tab') {
      const elements = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]')];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (event.target === first || event.target === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
    }
    if (classicWriting()) return;
    if (event.target.matches?.('[data-action="landscape-token-focus"]') && ['ArrowLeft', 'ArrowRight', 'Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); localDraft.focusTile = event.target.dataset.id; void manipulateToken(event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : 'remove'); }
    if (event.key === 'Enter' && event.target.matches?.('input[data-field]')) {
      event.preventDefault(); event.stopPropagation();
      if (active()?.phase === 'feedback') { void next(); return; }
      const fields = [...mounted.querySelectorAll('input[data-field]:not([readonly])')], index = fields.indexOf(event.target);
      if (index >= 0 && index < fields.length - 1) focusInput(fields[index + 1]); else void checkCurrentAnswer();
    }
  }
  function unmountListeners() { abort?.abort(); abort = null; unbindSwipe?.(); unbindSwipe = null; unbindKeyboard?.(); unbindKeyboard = null; }
  function afterRender(root = globalThis.document) {
    unmountListeners(); mounted = root?.matches?.('[data-landscape-root]') ? root : root?.querySelector?.('[data-landscape-root]');
    if (!mounted) return;
    abort = new AbortController();
    mounted.addEventListener('input', input, {signal: abort.signal});
    mounted.addEventListener('submit', submit, {signal: abort.signal});
    mounted.addEventListener('keydown', keydown, {signal: abort.signal});
    unbindKeyboard = installKeyboardSupport({root:mounted,active:()=>classicWriting()&&!modal&&!busy,session:()=>({...currentDraft(),feedback:active()?.phase === 'feedback' ? active().feedback : null}),submit:()=>void checkCurrentAnswer(),next:()=>void next(),addField:()=>appendWriteField(),addCorrectionField:()=>appendWriteField(true),beginCorrection:initial=>void beginCorrection(initial),submitCorrection:()=>void submitCorrection(),addFieldAction:'landscape-add-answer'});
    unbindSwipe = bindSwipeCard(mounted.querySelector('[data-flashcard]'), {revealed: () => currentDraft().flipped === true, onRate: known => void rateCard(known), onFlip: flipCard});
    lastFingerprint = fingerprint();
    const dialog = mounted.querySelector('[role="dialog"]');
    if (dialog && !dialog.contains(globalThis.document?.activeElement)) dialog.querySelector('input,button')?.focus({preventScroll: true});
    if (!focusAfterPaint && classicWriting() && active()?.phase === 'task' && !dialog && !mounted.contains(globalThis.document?.activeElement)) focusAfterPaint = {kind:'first'};
    if (focusAfterPaint && !dialog) {
      const focus = focusAfterPaint; focusAfterPaint = null;
      let target;
      if (focus.kind === 'input') target = [...mounted.querySelectorAll(`${focus.practice ? '#practice-answers ' : ''}input[name="${CSS.escape(focus.name || '')}"]`)][focus.index || 0];
      else if (focus.kind === 'first') target = mounted.querySelector('#answers input,input[data-field]:not([readonly]),[data-flashcard],.ls-task-intro h2,.ls-milestone h1');
      else if (focus.kind === 'feedback') target = taskType(task()) === 'quick' ? mounted.querySelector('input[data-field]') : mounted.querySelector('[data-action="landscape-next"]');
      else if (focus.kind === 'heading') target = mounted.querySelector('h1');
      if (target) { if (/^H[1-6]$/.test(target.tagName)) target.tabIndex = -1; if (target.matches('input')) focusInput(target); else target.focus({preventScroll: true}); if (focus.start != null && target.setSelectionRange) try { target.setSelectionRange(focus.start, focus.end); } catch {} }
    }
    const stage = mounted.querySelector('.ls-task-stage,.test-content'), taskKey = `${active()?.id || ''}:${task()?.id || ''}`;
    if (stage && taskKey !== lastAnimatedTask) { lastAnimatedTask = taskKey; previousTiles.clear(); previousPairs.clear(); animateLandscape(stage, [{opacity: .3, transform: 'translateY(7px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 220}); }
    const tileIds = new Set();
    for (const token of mounted.querySelectorAll('.ls-answer-token')) { const id = token.dataset.id; if (previousTiles.has(id)) token.style.animation = 'none'; tileIds.add(id); } previousTiles = tileIds;
    const pairIds = new Set();
    for (const tile of mounted.querySelectorAll('.ls-match-tile.is-matched')) { const id = `${tile.dataset.action}:${tile.dataset.id}`; if (previousPairs.has(id)) tile.style.animation = 'none'; pairIds.add(id); } previousPairs = pairIds;
  }
  function onModelChange() {
    if (!loaded || busy || !mounted?.isConnected) return;
    const nextFingerprint = fingerprint();
    if (nextFingerprint !== lastFingerprint) paint();
  }
  async function initialize() {
    loadingError = '';
    try { await model.load(); loaded = true; const round = active(); overview = !round || !!round.paused || roundFinished(round); }
    catch (error) { loaded = true; loadingError = error.message || 'Die gespeicherten Daten konnten nicht geladen werden.'; }
    if (!disposed) paint();
  }
  model.addEventListener?.('change', onModelChange);
  const readyPromise = initialize();
  return {
    view, render: view, afterRender, handle, input, submit, readyPromise,
    get ready() { return loaded; },
    get active() { return !!mounted?.isConnected && !overview && !!active() && !roundFinished(active()); },
    get classicWriting() { return classicWriting(); },
    get model() { return model; },
    async onExternal() { if (!busy) await model.flush().catch(() => {}); if (overview && !modal && mounted?.isConnected) paint(); },
    async refreshVocabulary(wordId) { if (!model.refreshVocabulary) return; await pendingDraft; await model.refreshVocabulary(wordId); if (mounted?.isConnected) paint(); },
    async pause() { await pendingDraft; await model.pause(); overview = true; },
    cleanup() { unmountListeners(); mounted = null; },
    destroy() { disposed = true; unmountListeners(); model.removeEventListener?.('change', onModelChange); model.destroy?.(); mounted = null; },
  };
}
