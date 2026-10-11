(function (root) {
  'use strict';

  const controllers = new WeakMap();
  const supportedSizes = [5, 7, 9, 11];
  const difficulties = ['easy', 'medium', 'hard', 'very-hard'];
  const difficultyLabel = value => value === 'very-hard' ? 'Very hard' : value[0].toUpperCase() + value.slice(1);
  const categoryKey = (size, difficulty) => `${size}:${difficulty}`;
  const categoryLabel = (size, difficulty) => `${size} × ${size} · ${difficultyLabel(difficulty)}`;

  function qualifiesForLeaderboard(result, entries) {
    if (entries.length < 10) return true;
    const last = entries[9];
    // Compare exact fractions so a rounded display percentage never decides a tie.
    if (result.optimalTiles > 0 && last.optimalTiles > 0) {
      return result.coveredTiles * last.optimalTiles >= last.coveredTiles * result.optimalTiles;
    }
    const score = result.optimalTiles ? result.coveredTiles / result.optimalTiles : 1;
    const threshold = last.optimalTiles ? last.coveredTiles / last.optimalTiles : 1;
    return score >= threshold;
  }

  function initialize(widget) {
    if (controllers.has(widget)) return controllers.get(widget);
    const base = (widget.dataset.leaderboardApi || '').replace(/\/+$/, '');
    const status = widget.querySelector('[data-leaderboard-status]');
    const list = widget.querySelector('[data-leaderboard-list]');
    const submitPanel = widget.querySelector('[data-leaderboard-submit-panel]');
    const submitStatus = widget.querySelector('[data-leaderboard-submit-status]');
    const submitButton = widget.querySelector('[data-leaderboard-submit]');
    const nameInput = widget.querySelector('[data-leaderboard-name]');
    const sizeButtons = [...widget.querySelectorAll('[data-leaderboard-size]')];
    const difficultyButtons = [...widget.querySelectorAll('[data-leaderboard-difficulty]')];
    const pending = new Map();
    const cache = new Map();
    let displayedSize = 7, displayedDifficulty = 'medium', serial = 0, listRevision = 0, active = null;

    function text(element, value) { if (element) element.textContent = value; }
    function hideSubmission() {
      if (submitPanel) submitPanel.toggleAttribute('hidden', true);
      if (submitButton) submitButton.disabled = true;
    }
    function cancelRequest(kind) {
      pending.get(kind)?.abort();
      pending.delete(kind);
    }
    async function request(kind, path, body) {
      if (!base) throw new Error('Leaderboard unavailable');
      cancelRequest(kind);
      const abort = new AbortController();
      pending.set(kind, abort);
      const timeout = setTimeout(() => abort.abort(), 4500);
      try {
        const response = await fetch(base + path, {
          method: body === undefined ? 'GET' : 'POST',
          credentials: 'omit', signal: abort.signal,
          ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
        });
        const data = await response.json();
        if (abort.signal.aborted || pending.get(kind) !== abort) throw new Error('Request cancelled');
        if (!response.ok) {
          if (kind === 'submit' && data?.code === 'INVALID_NAME' && typeof data.error === 'string' && data.error.trim() && data.error.length <= 200) {
            const error = new Error(data.error);
            error.code = 'INVALID_NAME';
            throw error;
          }
          throw new Error('Leaderboard request failed');
        }
        return data;
      } finally {
        clearTimeout(timeout);
        if (pending.get(kind) === abort) pending.delete(kind);
      }
    }
    function checkedEntries(data, size, difficulty) {
      if (data?.size !== size || (data.difficulty ?? 'very-hard') !== difficulty || !Array.isArray(data.entries)) throw new Error('Invalid leaderboard response');
      const entries = data.entries.slice(0, 10);
      if (entries.some(entry => !entry || !(typeof entry.id === 'string' || (Number.isSafeInteger(entry.id) && entry.id > 0))
        || !Number.isFinite(entry.coveredTiles) || !Number.isFinite(entry.optimalTiles)
        || entry.coveredTiles < 0 || entry.optimalTiles < entry.coveredTiles)) throw new Error('Invalid leaderboard entry');
      return entries;
    }
    function renderEntries(entries, size, difficulty) {
      if (displayedSize !== size || displayedDifficulty !== difficulty) return;
      if (list) {
        list.replaceChildren();
        entries.forEach((entry, index) => {
          const item = document.createElement('li');
          item.className = 'leaderboard-entry';
          const rank = document.createElement('span');
          rank.className = 'leaderboard-rank'; rank.textContent = String(index + 1);
          const name = document.createElement('span');
          name.className = 'leaderboard-name'; name.textContent = typeof entry.name === 'string' && entry.name ? entry.name : 'Anonymous';
          const score = document.createElement('span');
          score.className = 'leaderboard-score';
          const percentage = entry.optimalTiles ? entry.coveredTiles / entry.optimalTiles * 100 : 100;
          score.textContent = percentage.toFixed(1).replace(/\.0$/, '') + '%';
          score.title = `${entry.coveredTiles} / ${entry.optimalTiles} squares`;
          item.append(rank, name, score); list.appendChild(item);
        });
      }
      text(status, entries.length ? `Top ${entries.length} · ${categoryLabel(size, difficulty)}` : `No scores yet for ${categoryLabel(size, difficulty)}.`);
    }
    async function loadEntries(size, difficulty, kind = 'list') {
      const data = await request(kind, `/api/leaderboard?size=${size}&difficulty=${difficulty}`);
      const entries = checkedEntries(data, size, difficulty);
      cache.set(categoryKey(size, difficulty), {entries, loadedAt: Date.now()});
      renderEntries(entries, size, difficulty);
      return entries;
    }
    function setCategory(size, difficulty, force = false) {
      if (!supportedSizes.includes(size) || !difficulties.includes(difficulty)) return;
      const revision = ++listRevision;
      displayedSize = size; displayedDifficulty = difficulty;
      cancelRequest('list');
      sizeButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.leaderboardSize) === size)));
      difficultyButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.leaderboardDifficulty === difficulty)));
      const cached = cache.get(categoryKey(size, difficulty));
      if (cached && !force && Date.now() - cached.loadedAt < 30000) {
        renderEntries(cached.entries, size, difficulty); return;
      }
      if (list) list.replaceChildren();
      text(status, 'Loading leaderboard…');
      return loadEntries(size, difficulty).catch(() => {
        if (displayedSize === size && displayedDifficulty === difficulty && listRevision === revision) text(status, 'Leaderboard unavailable. Please try again later.');
      });
    }
    function setSize(size, force = false) { return setCategory(size, displayedDifficulty, force); }
    function setDifficulty(difficulty, force = false) { return setCategory(displayedSize, difficulty, force); }
    function cancelGame(size = displayedSize, difficulty = displayedDifficulty) {
      serial++; active = null;
      ['start', 'eligibility', 'submit'].forEach(cancelRequest);
      hideSubmission(); text(submitStatus, '');
      if (nameInput) nameInput.setAttribute('aria-invalid', 'false');
      setCategory(size, difficulty);
    }
    async function startGame(size, difficulty = 'medium') {
      if (!supportedSizes.includes(size) || !difficulties.includes(difficulty)) return null;
      cancelGame(size, difficulty);
      const id = serial;
      active = {id, size, difficulty, ticket: null, finished: false, submitted: false, qualified: false};
      text(submitStatus, 'Connecting this game to the leaderboard…');
      try {
        const data = await request('start', '/api/game', {size, difficulty});
        if (!active || active.id !== id) return null;
        if (data?.version !== 'tetromino-hold2-reroll4-v2' || data.size !== size || data.difficulty !== difficulty || typeof data.ticket !== 'string' || !data.ticket
          || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 4294967295) throw new Error('Invalid game ticket');
        active.ticket = data.ticket;
        text(submitStatus, '');
        return {ticket: data.ticket, seed: data.seed, size, difficulty};
      } catch (error) {
        if (active?.id === id) text(submitStatus, 'Offline game: you can play, but this result cannot enter the leaderboard.');
        return null;
      }
    }
    function resetGame() {
      if (!active) return;
      ['eligibility', 'submit'].forEach(cancelRequest);
      active = {...active, id: ++serial, finished: false, qualified: false, result: null};
      hideSubmission();
      text(submitStatus, active.submitted ? 'This game’s score is already submitted. Start a New game for another entry.'
        : active.ticket ? '' : 'Offline game: you can play, but this result cannot enter the leaderboard.');
    }
    async function finishGame(result) {
      if (!active || active.finished) return;
      active.finished = true;
      const id = active.id, size = active.size, difficulty = active.difficulty;
      active.result = {...result, actions: result.actions.map(action => ({...action})),
        ...(result.solution ? {solution:{placements:result.solution.placements.map(piece=>({id:piece.id,anchor:piece.anchor}))}} : {})};
      hideSubmission();
      if (active.submitted) {
        text(submitStatus, 'This game’s score is already submitted. Start a New game for another entry.'); return;
      }
      if (!active.ticket) {
        text(submitStatus, 'Offline result: leaderboard submission is unavailable for this game.'); return;
      }
      text(submitStatus, 'Checking the top 10…');
      try {
        const entries = await loadEntries(size, difficulty, 'eligibility');
        if (!active || active.id !== id) return;
        active.qualified = qualifiesForLeaderboard(active.result, entries);
        if (active.qualified) {
          if (submitPanel) submitPanel.toggleAttribute('hidden', false);
          if (submitButton) submitButton.disabled = false;
          text(submitStatus, `Your score qualifies for the ${categoryLabel(size, difficulty)} top 10. Enter a nickname if you like, then submit.`);
        } else text(submitStatus, 'This score did not reach the top 10 for this board size and difficulty.');
      } catch (error) {
        if (active?.id === id) {
          // The server can still decide eligibility if the separate list request failed.
          active.qualified = true;
          if (submitPanel) submitPanel.toggleAttribute('hidden', false);
          if (submitButton) submitButton.disabled = false;
          text(submitStatus, 'Could not check the top 10. You can try submitting; the leaderboard will verify your result.');
        }
      }
    }
    async function submit() {
      if (!active?.finished || !active.ticket || !active.qualified || active.submitted || pending.has('submit')) return;
      let checkedName;
      try {
        if (typeof root.PackingPlayerNames?.validate !== 'function') throw new Error('Name check unavailable');
        checkedName = root.PackingPlayerNames.validate(nameInput?.value || '');
        if (!checkedName || typeof checkedName.ok !== 'boolean') throw new Error('Invalid name check');
        if (checkedName.ok && typeof checkedName.name !== 'string') throw new Error('Invalid name check');
      } catch (error) {
        text(submitStatus, 'Nickname checking is unavailable. Please refresh the page before submitting.');
        return;
      }
      if (!checkedName.ok) {
        if (nameInput) nameInput.setAttribute('aria-invalid', 'true');
        text(submitStatus, checkedName.message || 'Please use a different nickname.');
        return;
      }
      if (nameInput) nameInput.setAttribute('aria-invalid', 'false');
      const id = active.id, size = active.size, difficulty = active.difficulty;
      if (submitButton) submitButton.disabled = true;
      text(submitStatus, 'Submitting score…');
      try {
        const data = await request('submit', '/api/leaderboard', {
          ticket: active.ticket, actions: active.result.actions, name: checkedName.name,
          ...(active.result.solution ? {solution:active.result.solution} : {})
        });
        if (!active || active.id !== id) return;
        const entries = checkedEntries(data, size, difficulty);
        if (typeof data.qualified !== 'boolean' && data.alreadySubmitted !== true) throw new Error('Invalid submission response');
        active.submitted = true;
        cache.set(categoryKey(size, difficulty), {entries, loadedAt: Date.now()}); renderEntries(entries, size, difficulty);
        hideSubmission();
        text(submitStatus, data.alreadySubmitted ? 'This game’s score has already been submitted.'
          : data.qualified ? `Your score is on the ${categoryLabel(size, difficulty)} leaderboard.` : 'The top 10 changed before submission. This score did not qualify.');
      } catch (error) {
        if (active?.id === id) {
          if (submitButton) submitButton.disabled = false;
          if (error.code === 'INVALID_NAME') {
            if (nameInput) nameInput.setAttribute('aria-invalid', 'true');
            text(submitStatus, error.message);
          } else text(submitStatus, 'Could not submit your score. Please try again.');
        }
      }
    }
    sizeButtons.forEach(button => button.addEventListener('click', () => setSize(Number(button.dataset.leaderboardSize), true)));
    difficultyButtons.forEach(button => button.addEventListener('click', () => setDifficulty(button.dataset.leaderboardDifficulty, true)));
    if (submitButton) submitButton.addEventListener('click', submit);
    if (nameInput) nameInput.addEventListener('input', () => nameInput.setAttribute('aria-invalid', 'false'));
    hideSubmission();
    const controller = {startGame, cancelGame, resetGame, finishGame, setSize, setDifficulty, setCategory};
    controllers.set(widget, controller);
    return controller;
  }

  const api = {initialize, qualifiesForLeaderboard};
  root.PackingLeaderboard = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
