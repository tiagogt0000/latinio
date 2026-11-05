import { CASES, checkAnswer } from './table-content.js';

const ANSWER_LIMIT = 300;
const emptyMap = () => Object.create(null);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

function canonicalItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.answer !== 'string' || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function batchesFor(items, prefix) {
  if (!items.length) return [];
  const caseIds = prefix || items.some(item => !CASES.some(entry => entry.id === item.case))
    ? [] : CASES.filter(entry => items.some(item => item.case === entry.id)).map(entry => entry.id);
  if (!caseIds.length) return [{ itemIds: items.map(item => item.id), caseIds: [], newCaseIds: [] }];
  const batches = [];
  for (let index = 0; index < caseIds.length; index += 2) {
    const activeCases = caseIds.slice(0, index + 2);
    batches.push({
      itemIds: items.filter(item => activeCases.includes(item.case)).map(item => item.id),
      caseIds: activeCases,
      newCaseIds: caseIds.slice(index, index + 2),
    });
  }
  return batches;
}

function stepsFor(session) {
  const count = session?.itemIds?.length || 0;
  if (!count) return [];
  const noun = session.prefix ? 'Bedeutungen' : 'Formen';
  const blanks = [...new Set([Math.ceil(count / 2), Math.ceil(3 * count / 4), count])];
  const batches = session.batches;
  const finalBatch = batches.at(-1);
  return [
    ...batches.flatMap((batch, index) => [
      { ...batch, batchNumber: index + 1, kind: 'study', label: 'Erst anschauen', count: 0 },
      { ...batch, batchNumber: index + 1, kind: 'match', label: 'Antworten zuordnen', count: batch.itemIds.length },
    ]),
    ...blanks.map(blankCount => ({
      ...finalBatch,
      newCaseIds: [],
      batchNumber: batches.length,
      kind: 'write',
      label: blankCount === count ? `Alle ${noun} selbst schreiben` : `${blankCount} von ${count} ${noun} schreiben`,
      count: blankCount,
    })),
  ];
}

function resetRound(session) {
  session.answers = emptyMap();
  session.placements = emptyMap();
  session.checked = false;
  session.reviewing = false;
}

function editable(session, kind) {
  return Boolean(session && !session.checked && !session.reviewing && learningStep(session).kind === kind);
}

/** Creates a new session without changing the selected items. */
export function createLearning(items, { prefix = false, random = Math.random } = {}) {
  const selected = canonicalItems(items);
  const itemIds = selected.map(item => item.id);
  const order = [...itemIds];
  const nextRandom = typeof random === 'function' ? random : Math.random;
  for (let index = order.length - 1; index > 0; index -= 1) {
    const sample = Number(nextRandom());
    const bounded = Number.isFinite(sample) ? Math.max(0, Math.min(1 - Number.EPSILON, sample)) : 0;
    const other = Math.floor(bounded * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  const session = { version: 2, itemIds, order, prefix: Boolean(prefix), batches: batchesFor(selected, prefix), step: 0 };
  resetRound(session);
  return session;
}

/** Writing blanks grow from the same shuffled order used by the token bank. */
export function learningStep(session) {
  const steps = stepsFor(session);
  const current = steps[session?.step];
  const batchTotal = session?.batches?.length || 0;
  if (!current) return {
    kind: 'done', label: 'Geschafft!', blankIds: [], number: steps.length, total: steps.length,
    itemIds: [...(session?.itemIds || [])], caseIds: [...(session?.batches?.at(-1)?.caseIds || [])],
    newCaseIds: [], batchNumber: batchTotal, batchTotal,
  };
  return {
    kind: current.kind,
    label: current.label,
    blankIds: session.order.filter(id => current.itemIds.includes(id)).slice(0, current.count),
    itemIds: [...current.itemIds],
    caseIds: [...current.caseIds],
    newCaseIds: [...current.newCaseIds],
    batchNumber: current.batchNumber,
    batchTotal,
    number: session.step + 1,
    total: steps.length,
  };
}

/** Token answers are graded by content, so identical forms are interchangeable. */
export function learningResult(session, items) {
  const current = learningStep(session);
  const byId = new Map(canonicalItems(items).map(item => [item.id, item]));
  const tokenCounts = new Map();
  if (current.kind === 'match') {
    for (const id of current.blankIds) {
      const tokenId = own(session.placements, id) ? session.placements[id] : null;
      if (tokenId) tokenCounts.set(tokenId, (tokenCounts.get(tokenId) || 0) + 1);
    }
  }
  const wrongIds = current.blankIds.filter(id => {
    const target = byId.get(id);
    if (!target) return true;
    let value;
    if (current.kind === 'match') {
      const tokenId = own(session.placements, id) ? session.placements[id] : null;
      if (!current.itemIds.includes(tokenId) || tokenCounts.get(tokenId) !== 1) return true;
      value = byId.get(tokenId)?.answer;
    } else {
      value = own(session.answers, id) ? session.answers[id] : '';
    }
    return !checkAnswer(value, target, { prefix: session.prefix });
  });
  return {
    correct: current.blankIds.length - wrongIds.length,
    total: current.blankIds.length,
    wrongIds,
    passed: wrongIds.length === 0,
  };
}

export function learningAnswer(session, id, value) {
  if (!editable(session, 'write') || !learningStep(session).blankIds.includes(id) || typeof value !== 'string') return false;
  const answer = value.slice(0, ANSWER_LIMIT);
  if (own(session.answers, id) && session.answers[id] === answer) return false;
  session.answers[id] = answer;
  return true;
}

/**
 * Place an unused token, move a used token, or swap two occupied targets.
 * An unused token displaces the old token back into the bank. A null tokenId
 * clears the target and returns its token to the bank.
 */
export function learningPlace(session, targetId, tokenId) {
  if (!editable(session, 'match')) return false;
  const activeIds = learningStep(session).itemIds;
  if (!activeIds.includes(targetId)) return false;
  if (tokenId === null) {
    if (!own(session.placements, targetId)) return false;
    delete session.placements[targetId];
    return true;
  }
  if (!activeIds.includes(tokenId)) return false;
  if (own(session.placements, targetId) && session.placements[targetId] === tokenId) return false;
  const sourceId = activeIds.find(id => own(session.placements, id) && session.placements[id] === tokenId);
  const displaced = own(session.placements, targetId) ? session.placements[targetId] : null;
  if (sourceId !== undefined) {
    delete session.placements[sourceId];
    if (activeIds.includes(displaced)) session.placements[sourceId] = displaced;
  }
  session.placements[targetId] = tokenId;
  return true;
}

export function learningCheck(session, items) {
  if (!editable(session, 'match') && !editable(session, 'write')) return false;
  // Calculate against canonical items before locking this attempt.
  learningResult(session, items);
  session.checked = true;
  return true;
}

export function learningNext(session, items) {
  const current = learningStep(session);
  if (current.kind === 'done') return false;
  if (current.kind === 'study') {
    session.step += 1;
    resetRound(session);
    return true;
  }
  if (session.reviewing) {
    resetRound(session);
    return true;
  }
  if (!session.checked) return false;
  if (!learningResult(session, items).passed) {
    session.reviewing = true;
    return true;
  }
  session.step += 1;
  resetRound(session);
  return true;
}

/**
 * Reject a save for another selection or mode. Repair its order/index/maps
 * using only the canonical selected items; stored labels/answers are untrusted.
 */
export function restoreLearning(raw, items, { prefix = false } = {}) {
  const selected = canonicalItems(items);
  const itemIds = selected.map(item => item.id);
  const allowed = new Set(itemIds);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1, 2].includes(raw.version) || raw.prefix !== Boolean(prefix)) return null;
  if (!Array.isArray(raw.itemIds) || raw.itemIds.length !== itemIds.length || new Set(raw.itemIds).size !== itemIds.length || raw.itemIds.some(id => !allowed.has(id))) return null;
  const order = [];
  const ordered = new Set();
  for (const id of [...(Array.isArray(raw.order) ? raw.order : []), ...itemIds]) {
    if (allowed.has(id) && !ordered.has(id)) {
      order.push(id);
      ordered.add(id);
    }
  }
  const session = { version: 2, itemIds, order, prefix: Boolean(prefix), batches: batchesFor(selected, prefix), step: 0 };
  const lastStep = stepsFor(session).length;
  // Version 1 introduced the full selection at once. Keep its active match or
  // writing exercise (including its shuffled blank set) at the final batch.
  const extraSteps = raw.version === 1 ? Math.max(0, session.batches.length - 1) * 2 : 0;
  session.step = typeof raw.step === 'number' && Number.isFinite(raw.step)
    ? Math.max(0, Math.min(lastStep - extraSteps, Math.floor(raw.step))) : 0;
  if (session.step > 0) session.step += extraSteps;
  resetRound(session);
  const current = learningStep(session);
  if (current.kind === 'write' && raw.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)) {
    for (const id of current.blankIds) {
      if (own(raw.answers, id) && typeof raw.answers[id] === 'string') session.answers[id] = raw.answers[id].slice(0, ANSWER_LIMIT);
    }
  }
  if (current.kind === 'match' && raw.placements && typeof raw.placements === 'object' && !Array.isArray(raw.placements)) {
    const used = new Set();
    const active = new Set(current.itemIds);
    for (const id of current.itemIds) {
      if (!own(raw.placements, id)) continue;
      const tokenId = raw.placements[id];
      if (active.has(tokenId) && !used.has(tokenId)) {
        session.placements[id] = tokenId;
        used.add(tokenId);
      }
    }
  }
  if (current.kind === 'match' || current.kind === 'write') {
    session.checked = raw.checked === true;
    session.reviewing = session.checked && raw.reviewing === true && !learningResult(session, selected).passed;
  }
  return session;
}
