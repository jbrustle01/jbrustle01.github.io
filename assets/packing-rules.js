(function (root, factory) {
  const pieces = typeof module === 'object' && module.exports ? require('./packing-pieces.js') : root.PackingPieces;
  const rules = factory(pieces);
  if (typeof module === 'object' && module.exports) module.exports = rules;
  if (root) root.PackingRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (pieces) {
  'use strict';
  // Canonical rules core: the server's ESM wrapper contains this same function.
  const difficulties = Object.freeze(['easy', 'medium', 'hard', 'very-hard']);
  const budgets = Object.freeze({easy: 3, medium: 2, hard: 1, 'very-hard': 0});

  function rerollBudget(difficulty = 'very-hard') {
    if (!difficulties.includes(difficulty)) throw new RangeError('Unknown packing difficulty.');
    return budgets[difficulty];
  }

  function rerollProgress(sequence, progress) {
    const used = progress.rerollsUsed ?? 0, next = progress.nextIndex;
    if (!Number.isInteger(used) || used < 0 || !Number.isInteger(next) || next < 1) throw new RangeError('Invalid reroll progress.');
    if (used >= rerollBudget(progress.difficulty) || !Array.isArray(sequence) || next + 6 >= sequence.length) return null;
    // Discard current + three previews, then reveal four fresh arrivals from
    // the immutable stream fixed at game start. Holds and their lock survive.
    return {...progress, currentIndex: next + 3, nextIndex: next + 4, rerollsUsed: used + 1};
  }

  function observePieces(sequence, progress, observed = []) {
    const current = progress.currentIndex === undefined ? 0 : progress.currentIndex;
    const next = progress.nextIndex === undefined ? current + 1 : progress.nextIndex;
    const revisions = progress.revisions || {};
    const result = [...observed], ids = new Set(observed.map(piece => piece.id));
    for (const sourceIndex of [current, next, next + 1, next + 2, ...(progress.heldIndices || [])]) {
      if (!Number.isInteger(sourceIndex) || !sequence[sourceIndex]) continue;
      const revision = revisions[sourceIndex] || 0, id = `${sourceIndex}:${revision}`;
      if (ids.has(id)) continue;
      const piece = sequence[sourceIndex];
      result.push(Object.freeze({id, sourceIndex, revision, kind: piece.kind, orientation: piece.orientation}));
      ids.add(id);
    }
    return Object.freeze(result);
  }

  return Object.freeze({difficulties, rerollBudget, rerollProgress, observePieces});
});
