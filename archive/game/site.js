document.documentElement.classList.remove('no-js');

const research = document.querySelector('[data-research]');
if (research) {
  const input = document.querySelector('#paper-search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const papers = [...research.querySelectorAll('[data-paper]')];
  const groups = [...research.querySelectorAll('[data-group]')];
  const empty = document.querySelector('#empty-results');
  const status = document.querySelector('#search-status');
  let active = 'all';
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function update() {
    const query = normalize(input.value.trim());
    let visible = 0;
    papers.forEach(paper => {
      const matches = (active === 'all' || paper.dataset.kind === active) && normalize(paper.textContent).includes(query);
      paper.hidden = !matches;
      if (matches) visible++;
    });
    groups.forEach(group => {
      const count = [...group.querySelectorAll('[data-paper]')].filter(paper => !paper.hidden).length;
      group.hidden = count === 0;
      const badge = group.querySelector('.count');
      badge.textContent = count;
      badge.setAttribute('aria-label', `${count} ${count === 1 ? 'paper' : 'papers'}`);
    });
    empty.hidden = visible !== 0;
    status.textContent = `${visible} ${visible === 1 ? 'paper' : 'papers'} shown`;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    active = button.dataset.filter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    update();
  }));
  input.addEventListener('input', update);
}

// Mulberry32 keeps a generated starting position reproducible from its seed.
function makeGameRandom(seed) {
  let value = Number(seed) >>> 0;
  return function random() {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDomineeringPosition(rng = Math.random, size = 7) {
  const ranges = {5:[0,1],7:[1,3],9:[2,4],11:[3,6]};
  if (!ranges[size]) size = 7;
  const [minimum,maximum] = ranges[size];
  const count = minimum + Math.floor(rng() * (maximum - minimum + 1));
  const cells = Array.from({ length: size * size }, (_, index) => index);
  // A partial Fisher–Yates shuffle samples distinct blocked squares uniformly.
  for (let index = 0; index < count; index++) {
    const selected = index + Math.floor(rng() * (cells.length - index));
    [cells[index], cells[selected]] = [cells[selected], cells[index]];
  }
  return { size, blocked: cells.slice(0, count).sort((a, b) => a - b) };
}

// The browser and optimizer use the same complete tetromino geometry.
function shapeOffsets(kind, orientation) {
  return PackingPieces.offsets(kind, orientation);
}

function shapeCells(kind, player, anchor, size) {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= size * size) return null;
  const offsets = shapeOffsets(kind, player);
  if (!offsets.length) return null;
  const row = Math.floor(anchor / size), column = anchor % size;
  const cells = [];
  for (const [dr, dc] of offsets) {
    if (row + dr < 0 || row + dr >= size || column + dc < 0 || column + dc >= size) return null;
    cells.push((row + dr) * size + column + dc);
  }
  return cells;
}

function generatePackingPosition(seed, options = {}) {
  const normalizedSeed = Number(seed) >>> 0;
  const position = generateDomineeringPosition(makeGameRandom(normalizedSeed), options.size || 7);
  const rng = makeGameRandom(normalizedSeed ^ 0x9e3779b9);
  const kinds = PackingPieces.families;
  const sequence = Array.from({ length: 64 }, () => {
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const orientations = PackingPieces.orientations(kind);
    return { kind, orientation: orientations[Math.floor(rng() * orientations.length)] };
  });
  return { ...position, seed: normalizedSeed, sequence };
}

function packingState(position, placements = [], progress = {}) {
  const occupied = new Set(position.blocked);
  placements.forEach(piece => piece.cells.forEach(cell => occupied.add(cell)));
  const index = placements.length;
  // Stream identity is independent of placement order when a piece is held.
  const currentIndex = progress.currentIndex ?? index;
  const nextIndex = progress.nextIndex ?? currentIndex + 1;
  const heldIndices = [progress.heldIndices?.[0] ?? null, progress.heldIndices?.[1] ?? null];
  const holdUsed = progress.holdUsed ?? false;
  const difficulty = progress.difficulty ?? position.difficulty ?? 'very-hard';
  const rerollsUsed = progress.rerollsUsed ?? position.rerollsUsed ?? 0;
  const revisions = {...(progress.revisions ?? position.revisions ?? {})};
  const observedPieces = typeof PackingRules === 'undefined' ? [] : PackingRules.observePieces(position.sequence,
    {currentIndex, nextIndex, heldIndices, revisions}, progress.observedPieces ?? position.observedPieces ?? []);
  const rerollBudget = difficulty === 'very-hard' ? 0 : PackingRules.rerollBudget(difficulty);
  const rerollsRemaining = Math.max(0, rerollBudget - rerollsUsed);
  const currentPiece = position.sequence[currentIndex];
  const heldPieces = heldIndices.map(heldIndex => heldIndex === null ? null : position.sequence[heldIndex]);
  function movesFor(piece) {
    const moves = [];
    if (!piece) return moves;
    for (let anchor = 0; anchor < position.size * position.size; anchor++) {
      const cells = shapeCells(piece.kind, piece.orientation, anchor, position.size);
      if (cells && cells.every(cell => !occupied.has(cell))) moves.push(anchor);
    }
    return moves;
  }
  const legalMoves = movesFor(currentPiece);
  const replacements = heldPieces.map(piece => piece || position.sequence[nextIndex]);
  const canHoldSlots = replacements.map(piece => !holdUsed && Boolean(piece));
  const holdRescueSlots = replacements.map((piece,slot) => canHoldSlots[slot] && movesFor(piece).length > 0);
  const canHold = canHoldSlots.some(Boolean);
  const rescueSlot = holdRescueSlots.findIndex(Boolean);
  const holdCanRescue = rescueSlot !== -1;
  const rerollCanRescue = rerollsRemaining > 0 && Boolean(currentPiece) && nextIndex + 6 < position.sequence.length
    && (legalMoves.length > 0 || holdCanRescue || PackingPieces.variants.some(piece => movesFor(piece).length > 0));
  return {
    size: position.size, blocked: [...position.blocked], seed: position.seed, sequence: position.sequence,
    difficulty, rerollBudget, rerollsUsed, rerollsRemaining, canReroll: rerollCanRescue, rerollCanRescue, revisions, observedPieces,
    placements: [...placements], index, currentIndex, nextIndex, heldIndices, holdUsed,
    currentPiece, heldPieces, canHoldSlots, holdRescueSlots, rescueSlot, canHold, holdCanRescue,
    queue: [currentPiece, ...position.sequence.slice(nextIndex, nextIndex + 3)].filter(Boolean),
    legalMoves, coveredTiles: placements.reduce((sum,piece) => sum + piece.cells.length, 0),
    finished: legalMoves.length === 0 && !holdCanRescue && !rerollCanRescue
  };
}

function placePackingPiece(state, anchor) {
  if (state.finished || !state.legalMoves.includes(anchor)) return state;
  const piece = {
    index: state.index, sourceIndex: state.currentIndex, ...state.currentPiece, anchor,
    id: `${state.currentIndex}:${state.revisions[state.currentIndex] || 0}`, revision: state.revisions[state.currentIndex] || 0,
    cells: shapeCells(state.currentPiece.kind, state.currentPiece.orientation, anchor, state.size)
  };
  return packingState(state, [...state.placements, piece], {
    currentIndex: state.nextIndex, nextIndex: state.nextIndex + 1,
    heldIndices: state.heldIndices, holdUsed: false
  });
}

function holdPackingPiece(state, slot = 0) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 1 || state.finished || !state.canHoldSlots[slot]) return state;
  const empty = state.heldIndices[slot] === null;
  const heldIndices = [...state.heldIndices];
  heldIndices[slot] = state.currentIndex;
  return packingState(state, state.placements, {
    currentIndex: empty ? state.nextIndex : state.heldIndices[slot],
    nextIndex: state.nextIndex + (empty ? 1 : 0),
    heldIndices, holdUsed: true
  });
}

function rerollPackingPieces(state) {
  if (state.finished || !state.canReroll) return state;
  // Skip the current piece and three visible previews, then reveal the next
  // four draws from the same seeded stream. Discarded draws remain observed.
  const progress=PackingRules.rerollProgress(state.sequence,state);
  return progress?packingState(state,state.placements,progress):state;
}

// A square can be used whenever some legal placement covers it.
function resolvePackingAnchor(state, hoveredCell) {
  if (!state || state.finished || !state.currentPiece || !Number.isInteger(hoveredCell)
    || hoveredCell < 0 || hoveredCell >= state.size * state.size) return -1;
  if (state.legalMoves.includes(hoveredCell)) return hoveredCell;
  const row = Math.floor(hoveredCell / state.size), column = hoveredCell % state.size;
  const offsets = shapeOffsets(state.currentPiece.kind, state.currentPiece.orientation);
  let best = -1, distance = Infinity;
  for (const anchor of state.legalMoves) {
    const dr = row - Math.floor(anchor / state.size), dc = column - anchor % state.size;
    if (!offsets.some(offset => offset[0] === dr && offset[1] === dc)) continue;
    const candidateDistance = dr * dr + dc * dc;
    if (candidateDistance < distance || (candidateDistance === distance && anchor < best)) {
      best = anchor; distance = candidateDistance;
    }
  }
  return best;
}

// Full-cell pointer routing uses the same anchor for preview and placement.
function packingAnchorAtPoint(size, svgX, svgY) {
  if (!Number.isFinite(svgX) || !Number.isFinite(svgY)) return -1;
  const left = (400 - size * 32) / 2, top = 5;
  const column = Math.floor((svgX - left) / 32), row = Math.floor((svgY - top) / 32);
  if (row < 0 || row >= size || column < 0 || column >= size) return -1;
  return row * size + column;
}

// Trace the boundary of a polyomino so every piece reads as one connected shape.
function shapeOutline(kind, player, unit, inset, originX, originY) {
  const offsets = shapeOffsets(kind, player);
  const occupied = new Set(offsets.map(([row, column]) => `${column},${row}`));
  const edges = new Map();
  const add = (x1,y1,x2,y2) => edges.set(`${x1},${y1}`, [x2,y2]);
  offsets.forEach(([row,column]) => {
    if (!occupied.has(`${column},${row-1}`)) add(column,row,column+1,row);
    if (!occupied.has(`${column+1},${row}`)) add(column+1,row,column+1,row+1);
    if (!occupied.has(`${column},${row+1}`)) add(column+1,row+1,column,row+1);
    if (!occupied.has(`${column-1},${row}`)) add(column,row+1,column,row);
  });
  const first = [...edges.keys()][0].split(',').map(Number);
  const points = [first];
  let next = edges.get(first.join(','));
  while (next.join(',') !== first.join(',')) { points.push(next); next = edges.get(next.join(',')); }
  const corners = points.filter((point,index) => {
    const previous = points[(index+points.length-1)%points.length], following = points[(index+1)%points.length];
    return (point[0]-previous[0])*(following[1]-point[1]) !== (point[1]-previous[1])*(following[0]-point[0]);
  });
  const inner = corners.map((point,index) => {
    const previous = corners[(index+corners.length-1)%corners.length], following = corners[(index+1)%corners.length];
    const dx1=Math.sign(point[0]-previous[0]),dy1=Math.sign(point[1]-previous[1]);
    const dx2=Math.sign(following[0]-point[0]),dy2=Math.sign(following[1]-point[1]);
    return [originX+point[0]*unit-inset*(dy1+dy2),originY+point[1]*unit+inset*(dx1+dx2)];
  });
  const radius = Math.min(3, unit*.14);
  const round = value => Math.round(value*100)/100;
  let path = '';
  inner.forEach((point,index) => {
    const previous=inner[(index+inner.length-1)%inner.length],following=inner[(index+1)%inner.length];
    const before=[point[0]+Math.sign(previous[0]-point[0])*radius,point[1]+Math.sign(previous[1]-point[1])*radius];
    const after=[point[0]+Math.sign(following[0]-point[0])*radius,point[1]+Math.sign(following[1]-point[1])*radius];
    path += `${index ? 'L' : 'M'}${before.map(round).join(' ')}Q${point.map(round).join(' ')} ${after.map(round).join(' ')}`;
  });
  return path+'Z';
}

function shapeDescription(kind, orientation) {
  return PackingPieces.description(kind, orientation);
}

function initializeDomineering(widget) {
  if (widget.dataset.gameReady === 'true') return;
  const status=widget.querySelector('[data-game-status]'),reset=widget.querySelector('[data-game-reset]');
  const newGame=widget.querySelector('[data-game-new]'),help=widget.querySelector('[data-game-help]');
  const board=widget.querySelector('[data-domineering-board]'),queues=widget.querySelector('[data-piece-queues]');
  const score=widget.querySelector('[data-game-score]'),results=widget.querySelector('[data-game-results]');
  const viewButtons=[...widget.querySelectorAll('[data-game-view]')];
  const setup=widget.querySelector('[data-game-setup]'),play=widget.querySelector('[data-game-play]'),start=widget.querySelector('[data-game-start]');
  const sizeButtons=[...widget.querySelectorAll('[data-game-size]')];
  const difficultyButtons=[...widget.querySelectorAll('[data-game-difficulty]')];
  const rerollButton=widget.querySelector('[data-game-reroll]'),rerollPanel=widget.querySelector('[data-reroll-panel]');
  const rerollCount=widget.querySelector('[data-reroll-count]'),difficultyStatus=widget.querySelector('[data-difficulty-status]');
  const optimalNote=widget.querySelector('[data-optimal-note]');
  const holdPanel=widget.querySelector('[data-hold-panel]'),holdHint=widget.querySelector('[data-hold-hint]');
  const holdButtons=[0,1].map(slot=>widget.querySelector(`[data-game-hold="${slot}"]`));
  if (!board || !status || !reset) return;
  const leaderboard=typeof PackingLeaderboard!=='undefined'?PackingLeaderboard.initialize(widget):null;
  let position=null, state=null, solution=null, originalSolution=null, solverError=false, worker=null, gameToken=0, currentView='player', preparing=false, selectedSize=7, selectedDifficulty='medium', lastPointer=null, pointerInGame=false;
  let actions=[],completionReported=false,solvingObserved=false;
  const sourceURL=document.currentScript?.src || new URL('assets/site.js',document.baseURI).href;
  const workerURL=new URL('packing-worker.js',sourceURL);
  workerURL.search=new URL(sourceURL).search;
  const grid=document.createElementNS('http://www.w3.org/2000/svg','g');
  grid.setAttribute('data-domineering-grid','');
  board.appendChild(grid);
  const cellPosition=anchor=>({x:(400-state.size*32+2)/2+(anchor%state.size)*32,y:6+Math.floor(anchor/state.size)*32});

  function pieceDrawing(piece,preview=false) {
    const {x,y}=cellPosition(piece.anchor);
    const d=shapeOutline(piece.kind,piece.orientation,32,2.5,x-1,y-1);
    return `<path data-placed-shape="${piece.kind}" data-placement-anchor="${piece.anchor}" d="${d}" fill="${preview?'#99dcee':'url(#dm-piece)'}" fill-opacity="${preview?'.17':'.88'}" stroke="#99dcee" stroke-width="${preview?'1.8':'.8'}" stroke-linejoin="round"/>`;
  }

  function pieceIconPath(piece) {
    const offsets=shapeOffsets(piece.kind,piece.orientation);
    const minColumn=Math.min(...offsets.map(offset=>offset[1])),minRow=Math.min(...offsets.map(offset=>offset[0]));
    const width=1+Math.max(...offsets.map(offset=>offset[1]))-minColumn,height=1+Math.max(...offsets.map(offset=>offset[0]))-minRow;
    const unit=Math.min(10,36/Math.max(width,height));
    return shapeOutline(piece.kind,piece.orientation,unit,unit*.08,(40-width*unit)/2-minColumn*unit,(40-height*unit)/2-minRow*unit);
  }

  function renderQueue() {
    if (!queues) return;
    queues.innerHTML=`<div class="piece-queue is-active" data-player="solo"><span class="piece-label">Your pieces</span><div class="piece-slots">${state.queue.map((piece,index)=>{
      const d=pieceIconPath(piece);
      const label=['Now','Next 1','Next 2','Next 3'][index];
      return `<div class="piece-slot${index===0?' is-current':''}" data-piece-kind="${piece.kind}" data-piece-orientation="${piece.orientation}"><div class="piece-preview"><svg viewBox="0 0 40 40" role="img" aria-label="${label}: ${shapeDescription(piece.kind,piece.orientation)}"><path d="${d}" fill="#99dcee" fill-opacity="${index===0?'.95':'.62'}"/></svg></div><span>${label}</span></div>`;
    }).join('')}</div></div>`;
  }

  function renderHold() {
    if(holdPanel)holdPanel.toggleAttribute('hidden',state.finished);
    holdButtons.forEach((button,slot)=>{
      if(!button)return;
      const piece=state.heldPieces[slot],preview=button.querySelector('[data-hold-preview]'),action=button.querySelector('[data-hold-action]');
      button.disabled=state.finished||!state.canHoldSlots[slot];
      if(action)action.textContent=`${piece?'Swap':'Hold'} ${slot+1}`;
      const description=piece?shapeDescription(piece.kind,piece.orientation):'';
      if(preview)preview.innerHTML=piece?`<svg viewBox="0 0 40 40" data-held-kind="${piece.kind}" data-held-orientation="${piece.orientation}"><path d="${pieceIconPath(piece)}" fill="#99dcee"/></svg>`:'+';
      button.setAttribute('aria-label',`Hold slot ${slot+1}: ${state.holdUsed
        ?`unavailable until you place a piece${description?`. Held: ${description}`:''}`
        :piece?`swap current piece with held ${description}`:'store current piece and draw the next piece'}`);
    });
    if(holdHint)holdHint.textContent=state.holdUsed?'Place a piece to hold again.':state.legalMoves.length===0&&state.holdCanRescue?rescueMessage():'One hold or swap per placement.';
  }

  function rescueMessage() {
    return state.holdCanRescue?`${state.heldPieces[state.rescueSlot]?'Swap with':'Use Hold'} slot ${state.rescueSlot+1} to continue.`
      :'Reroll the current and next three pieces to continue.';
  }

  function updateSummary() {
    if(!state||preparing)return;
    if(help)help.textContent='Cover as many squares as you can.';
    if(queues)queues.toggleAttribute('hidden',false);
    if(rerollPanel)rerollPanel.toggleAttribute('hidden',false);
    if(rerollButton)rerollButton.disabled=!state.canReroll||state.finished||currentView!=='player';
    if(rerollCount)rerollCount.textContent=`${state.rerollsRemaining} of ${state.rerollBudget} left`;
    if(difficultyStatus)difficultyStatus.textContent=state.difficulty==='very-hard'?'Very hard':state.difficulty[0].toUpperCase()+state.difficulty.slice(1);
    if(optimalNote)optimalNote.toggleAttribute('hidden',currentView!=='optimal');
    if(results)results.toggleAttribute('hidden',!state.finished);
    if(score) {
      score.toggleAttribute('hidden',!state.finished);
      if(state.finished) {
        if(solution?.exact) {
          const percentage=solution.optimalTiles ? state.coveredTiles/solution.optimalTiles*100 : 100;
          score.innerHTML=`<strong>${percentage.toFixed(1).replace(/\.0$/,'')}%</strong><span>${state.coveredTiles} / ${solution.optimalTiles} squares</span>`;
        } else score.textContent=solverError?'Optimal offline solution unavailable.':'Finding optimal offline solution…';
      }
    }
    viewButtons.forEach(button=>{
      const selected=button.dataset.gameView===currentView;
      button.setAttribute('aria-pressed',String(selected));
      button.disabled=!state.finished||(button.dataset.gameView==='optimal'&&!solution?.exact);
    });
    status.textContent=currentView==='optimal'&&solution?.exact?`Optimal offline solution: ${solution.optimalTiles} squares`:!state.finished&&state.legalMoves.length===0&&(state.holdCanRescue||state.rerollCanRescue)?`${state.coveredTiles} squares covered · ${rescueMessage()}`:`${state.coveredTiles} squares covered`;
  }

  function render() {
    if(!state||preparing)return;
    const placements=currentView==='optimal'&&solution?.exact?solution.placements:state.placements;
    const pieceNumber=(piece,index)=>{
      const id=piece.id??`${piece.sourceIndex??piece.index??index}:${piece.revision||0}`;
      const observedIndex=state.observedPieces.findIndex(observed=>observed.id===id);
      return observedIndex<0?(piece.sourceIndex??piece.index??index)+1:observedIndex+1;
    };
    const occupied=new Map();
    placements.forEach((piece,index)=>piece.cells.forEach(cell=>occupied.set(cell,pieceNumber(piece,index))));
    const blocked=new Set(state.blocked);
    let markup='<defs><linearGradient id="dm-piece" x2="1" y2="1"><stop stop-color="#aadfea"/><stop offset="1" stop-color="#4a8eac"/></linearGradient></defs>';
    for(let anchor=0;anchor<state.size*state.size;anchor++) {
      const {x,y}=cellPosition(anchor),legal=currentView==='player'&&resolvePackingAnchor(state,anchor)!==-1;
      const unavailable=blocked.has(anchor)?'blocked':occupied.has(anchor)?`covered by piece ${occupied.get(anchor)}`:state.finished||!state.currentPiece?'empty':legal?`place ${shapeDescription(state.currentPiece.kind,state.currentPiece.orientation)} covering this square`:'current piece cannot cover this square';
      markup+=`<g data-domino-cell="${anchor}" role="button" tabindex="${legal?0:-1}" aria-disabled="${!legal}" aria-label="Row ${Math.floor(anchor/state.size)+1}, column ${anchor%state.size+1}: ${unavailable}"><rect pointer-events="none" x="${x}" y="${y}" width="30" height="30" rx="4" fill="${blocked.has(anchor)?'#14202a':'#142837'}" fill-opacity="${blocked.has(anchor)?'.4':'.68'}" stroke="${blocked.has(anchor)?'#24313c':'#416073'}" stroke-width=".7"/>`;
      if(blocked.has(anchor))markup+=`<path pointer-events="none" d="M${x+12} ${y+12}l6 6m0-6l-6 6" stroke="#50606e" stroke-width=".8"/>`;
      else if(!occupied.has(anchor))markup+=`<circle pointer-events="none" cx="${x+15}" cy="${y+15}" r=".8" fill="#6d8b9c" opacity=".55"/>`;
      markup+=`<rect class="packing-cell-hit" x="${x-1}" y="${y-1}" width="32" height="32" fill="transparent" stroke-width="0" pointer-events="all"/></g>`;
    }
    markup+='<g pointer-events="none">'+placements.map(piece=>pieceDrawing(piece)).join('')+'</g><g data-domino-preview pointer-events="none"></g>';
    markup+='<g data-solution-order pointer-events="none" aria-hidden="true">'+placements.map((piece,index)=>{const {x,y}=cellPosition(piece.anchor),number=pieceNumber(piece,index);return `<text data-piece-number="${number}" data-piece-source-index="${piece.sourceIndex??piece.index??index}" data-piece-id="${piece.id??`${piece.sourceIndex??piece.index??index}:${piece.revision||0}`}" x="${x+15}" y="${y+18}" text-anchor="middle" fill="#102430" font-family="var(--mono,monospace)" font-size="9" font-weight="600">${number}</text>`;}).join('')+'</g>';
    grid.innerHTML=markup;
    widget.dataset.gameView=currentView;
    renderQueue();renderHold();updateSummary();refreshPointerPreview();
    if(state.finished&&!completionReported&&!solvingObserved&&!solverError) {
      solveObservedResult();
    }
  }

  function solveObservedResult() {
    solvingObserved=true;solution=null;
    const token=++gameToken;
    if(worker)worker.terminate();
    function fail() {
      if(token!==gameToken)return;
      solvingObserved=false;solverError=true;solution=null;
      if(worker)worker.terminate();worker=null;render();
    }
    try {
      const activeWorker=new Worker(workerURL);worker=activeWorker;
      activeWorker.onmessage=event=>{
        const data=event.data;
        if(!data||token!==gameToken||data.id!==token||!solvingObserved||completionReported)return;
        if(data.type==='result'&&data.exact===true&&Number.isFinite(data.optimalTiles)&&Array.isArray(data.placements)) {
          solution={optimalTiles:data.optimalTiles,placements:data.placements,exact:true};
          solvingObserved=false;solverError=false;completionReported=true;
          activeWorker.terminate();if(worker===activeWorker)worker=null;
          render();
          leaderboard?.finishGame({actions,coveredTiles:state.coveredTiles,optimalTiles:solution.optimalTiles,difficulty:state.difficulty,
            solution:{placements:solution.placements.map(piece=>({id:piece.id,anchor:piece.anchor}))}});
        } else if(data.type==='error')fail();
      };
      activeWorker.onerror=fail;
      updateSummary();
      activeWorker.postMessage({id:token,type:'observed',position:{size:state.size,blocked:state.blocked,pool:state.observedPieces,hint:originalSolution?.placements}});
    } catch(error) {fail();}
  }

  function focusNextAction() {
    const target=state.finished?(viewButtons.find(button=>button.dataset.gameView==='player')||newGame||reset)
      :state.legalMoves.length?board.querySelector(`[data-domino-cell="${state.legalMoves[0]}"]`):state.holdCanRescue?holdButtons[state.rescueSlot]:rerollButton;
    target?.focus({preventScroll:true});
  }

  function placePiece(hoveredCell,keyboard) {
    if(!state||preparing||currentView!=='player')return;
    const anchor=resolvePackingAnchor(state,hoveredCell);
    if(anchor===-1)return;
    const next=placePackingPiece(state,anchor);
    if(next===state)return;
    actions.push({type:'place',anchor});
    state=next;render();
    if(keyboard)focusNextAction();
  }
  function holdPiece(slot,keyboard) {
    if(!state||preparing||currentView!=='player')return;
    const next=holdPackingPiece(state,slot);
    if(next===state)return;
    actions.push({type:'hold',slot});
    state=next;render();
    if(keyboard)focusNextAction();
  }
  function rerollPieces(keyboard) {
    if(!state||preparing||currentView!=='player')return;
    const next=rerollPackingPieces(state);
    if(next===state)return;
    actions.push({type:'reroll'});
    state=next;render();
    if(keyboard)focusNextAction();
  }
  function previewPiece(hoveredCell) {
    const preview=grid.querySelector('[data-domino-preview]');
    const anchor=!preparing&&currentView==='player'?resolvePackingAnchor(state,hoveredCell):-1;
    if(preview)preview.innerHTML=anchor!==-1?pieceDrawing({anchor,...state.currentPiece},true):'';
  }

  function pointerAnchor(event) {
    if(!state||preparing)return -1;
    if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return -1;
    const matrix=board.getScreenCTM();
    if(!matrix)return -1;
    const point=board.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(matrix.inverse());
    return packingAnchorAtPoint(state.size,local.x,local.y);
  }
  function refreshPointerPreview() {
    if(lastPointer)previewPiece(pointerAnchor(lastPointer));
  }
  function trackPointer(event) {
    if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
    lastPointer={clientX:event.clientX,clientY:event.clientY};
    refreshPointerPreview();
  }

  function showPreparation(message='Preparing board…',busy=true) {
    grid.innerHTML='';
    if(queues){queues.innerHTML='';queues.toggleAttribute('hidden',true);}
    if(score){score.textContent='';score.toggleAttribute('hidden',true);}
    if(results)results.toggleAttribute('hidden',true);
    if(holdPanel)holdPanel.toggleAttribute('hidden',true);
    if(rerollPanel)rerollPanel.toggleAttribute('hidden',true);
    if(rerollButton)rerollButton.disabled=true;
    if(optimalNote)optimalNote.toggleAttribute('hidden',true);
    holdButtons.forEach(button=>{
      if(!button)return;
      button.disabled=true;
      const preview=button.querySelector('[data-hold-preview]');
      if(preview)preview.innerHTML='+';
    });
    viewButtons.forEach(button=>{button.disabled=true;button.setAttribute('aria-pressed',String(button.dataset.gameView==='player'));});
    reset.disabled=true;
    board.setAttribute('aria-busy',String(busy));
    widget.dataset.preparing=String(busy);
    widget.dataset.gameView='player';
    status.textContent=message;
    if(help)help.textContent='Cover as many squares as you can.';
  }

  function preparePuzzle(seed,size) {
    if(worker)worker.terminate();
    worker=null;position=null;state=null;solution=null;originalSolution=null;solverError=false;preparing=true;currentView='player';lastPointer=null;
    actions=[];completionReported=false;solvingObserved=false;
    const extent=size*32+16;
    board.setAttribute('viewBox',`${(400-size*32)/2-8} 0 ${extent} ${extent}`);
    widget.dataset.size=String(size);
    const token=++gameToken;
    showPreparation();
    function fail() {
      if(token!==gameToken)return;
      solverError=true;preparing=false;
      if(worker)worker.terminate();worker=null;
      showPreparation('Could not prepare a puzzle. Try New game.',false);
    }
    try {
      const activeWorker=new Worker(workerURL);
      worker=activeWorker;
      activeWorker.onmessage=event=>{
        const data=event.data;
        if(!data||token!==gameToken||data.id!==token)return;
        if(data.type==='generated'&&data.solution?.exact===true&&Number.isFinite(data.solution.optimalTiles)
          &&Array.isArray(data.solution.placements)&&data.position?.seed===seed&&data.position.size===size
          &&Array.isArray(data.position.sequence)&&Array.isArray(data.position.blocked)) {
          position={...data.position,difficulty:selectedDifficulty};
          originalSolution=data.solution;
          solution=null;
          state=packingState(position);preparing=false;solverError=false;currentView='player';
          reset.disabled=false;board.setAttribute('aria-busy','false');widget.dataset.preparing='false';
          render();
          activeWorker.terminate();if(worker===activeWorker)worker=null;
        } else if(data.type==='error')fail();
      };
      activeWorker.onerror=fail;
      activeWorker.postMessage({id:token,type:'generate',seed,size});
    } catch(error) {fail();}
  }

  widget.dataset.gameReady='true';
  const cellFrom=event=>event.target?.closest?.('[data-domino-cell]');
  board.addEventListener('click',event=>{
    const cell=cellFrom(event);
    // Assistive-technology clicks have no pointer coordinates; use the focused cell.
    if(event.detail===0||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)) {
      if(cell)placePiece(Number(cell.dataset.dominoCell),event.detail===0);
      return;
    }
    trackPointer(event);
    placePiece(pointerAnchor(event),false);
  });
  board.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' '&&event.key!=='Spacebar')return;
    const cell=cellFrom(event);if(!cell)return;event.preventDefault();
    if(!event.repeat)placePiece(Number(cell.dataset.dominoCell),true);
  });
  ['pointerover','pointermove'].forEach(type=>board.addEventListener(type,trackPointer));
  board.addEventListener('pointerleave',()=>{lastPointer=null;previewPiece(-1);});
  board.addEventListener('focusin',event=>{const cell=cellFrom(event);previewPiece(cell?Number(cell.dataset.dominoCell):-1);});
  board.addEventListener('focusout',()=>{previewPiece(-1);refreshPointerPreview();});
  widget.addEventListener('pointerenter',()=>{pointerInGame=true;});
  widget.addEventListener('pointerleave',()=>{pointerInGame=false;});
  holdButtons.forEach((button,slot)=>button?.addEventListener('click',event=>holdPiece(slot,event.detail===0)));
  if(rerollButton)rerollButton.addEventListener('click',event=>rerollPieces(event.detail===0));
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    const key=event.key?.toLowerCase(),slot=['h','j'].indexOf(key),reroll=key==='r';
    if((slot===-1&&!reroll)||!state||preparing||state.finished||currentView!=='player')return;
    if(reroll?!state.canReroll:!state.canHoldSlots[slot])return;
    const target=event.target;
    if(target?.isContentEditable||target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]'))return;
    const focusedInGame=widget.contains(document.activeElement)||widget.contains(target);
    if(!pointerInGame&&!focusedInGame)return;
    event.preventDefault();if(reroll)rerollPieces(focusedInGame);else holdPiece(slot,focusedInGame);
  });

  function updateSizeChoice() {
    sizeButtons.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.gameSize)===selectedSize)));
    difficultyButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gameDifficulty===selectedDifficulty)));
    widget.dataset.selectedSize=String(selectedSize);
    widget.dataset.difficulty=selectedDifficulty;
  }
  function showSetup(focusChoice=false) {
    if(worker)worker.terminate();worker=null;gameToken++;
    position=null;state=null;solution=null;preparing=false;currentView='player';lastPointer=null;
    actions=[];completionReported=false;solvingObserved=false;leaderboard?.cancelGame(selectedSize,selectedDifficulty);
    showPreparation('',false);
    if(setup)setup.toggleAttribute('hidden',false);
    if(play)play.toggleAttribute('hidden',true);
    updateSizeChoice();
    if(focusChoice)sizeButtons.find(button=>Number(button.dataset.gameSize)===selectedSize)?.focus({preventScroll:true});
  }
  function startSelectedGame() {
    if(setup)setup.toggleAttribute('hidden',true);
    if(play)play.toggleAttribute('hidden',false);
    const size=selectedSize;
    const begin=ticket=>{
      const seed=ticket?.seed??(typeof crypto!=='undefined'&&typeof crypto.getRandomValues==='function'?crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*4294967296));
      widget.dataset.seed=String(seed);preparePuzzle(seed,size);
    };
    if(leaderboard) {
      if(worker)worker.terminate();worker=null;
      position=null;state=null;solution=null;preparing=true;lastPointer=null;
      actions=[];completionReported=false;
      const token=++gameToken;
      showPreparation();
      leaderboard.startGame(size,selectedDifficulty).then(ticket=>{if(token===gameToken)begin(ticket);});
    } else begin(null);
    const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    widget.scrollIntoView?.({block:'start',behavior:reducedMotion?'auto':'smooth'});
  }
  sizeButtons.forEach(button=>button.addEventListener('click',()=>{
    const size=Number(button.dataset.gameSize);
    if([5,7,9,11].includes(size)){selectedSize=size;updateSizeChoice();leaderboard?.setCategory(size,selectedDifficulty);}
  }));
  difficultyButtons.forEach(button=>button.addEventListener('click',()=>{
    const difficulty=button.dataset.gameDifficulty;
    if(['easy','medium','hard','very-hard'].includes(difficulty)){selectedDifficulty=difficulty;updateSizeChoice();leaderboard?.setCategory(selectedSize,difficulty);}
  }));
  if(start)start.addEventListener('click',startSelectedGame);
  reset.addEventListener('click',()=>{
    if(!position||preparing)return;
    if(worker)worker.terminate();worker=null;gameToken++;
    actions=[];completionReported=false;solvingObserved=false;solverError=false;solution=null;leaderboard?.resetGame();
    state=packingState(position);currentView='player';lastPointer=null;render();
  });
  if(newGame)newGame.addEventListener('click',()=>showSetup(true));
  viewButtons.forEach(button=>button.addEventListener('click',()=>{
    if(!state||preparing||!state.finished||(button.dataset.gameView==='optimal'&&!solution?.exact))return;
    currentView=button.dataset.gameView==='optimal'?'optimal':'player';lastPointer=null;render();
  }));
  showSetup();
}

document.querySelectorAll('[data-domineering]').forEach(initializeDomineering);
