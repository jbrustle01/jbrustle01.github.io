/* Exact hindsight packing. A feasible prefix can be searched as a multiset:
   disjoint, fixed placements can always be played again in arrival order. */
(function (root) {
  'use strict';
  const pieces = typeof module !== 'undefined' && module.exports ? require('./packing-pieces.js') : root.PackingPieces;
  if (!pieces) throw new Error('Piece definitions must be loaded before the packing solver.');
  const variants = pieces.variants;
  const typeOf = piece => variants.findIndex(variant => variant.kind === piece.kind && variant.orientation === piece.orientation);

  function solve(position, options = {}) {
    const started=Date.now(), size=position.size;
    if(!Number.isInteger(size) || size<1 || size>13)throw new Error('The solver supports square boards of size 1–13.');
    const total=size*size, blocked=new Set(position.blocked || []);
    if([...blocked].some(cell=>!Number.isInteger(cell)||cell<0||cell>=total))throw new Error('Invalid blocked square.');
    const sequence=position.sequence || [];
    const types=sequence.map(piece=>{const type=typeOf(piece);if(type<0)throw new Error('Invalid piece.');return type;});
    const area=variants[0].cells.length;
    if(variants.some(variant=>variant.cells.length!==area))throw new Error('All pieces must have equal area.');
    const freeArea=total-blocked.size;
    let prefix=Math.min(types.length,Math.floor(freeArea/area)), targetTiles=prefix*area;
    const counts=Array(variants.length).fill(0);
    types.slice(0,prefix).forEach(type=>counts[type]++);
    const initialTypes=counts.map((count,type)=>count?type:-1).filter(type=>type>=0);
    const board=new Uint8Array(total), words=new Uint32Array(Math.ceil(total/32));
    const wordIndex=Array.from({length:total},(_,cell)=>cell>>>5), bit=Array.from({length:total},(_,cell)=>(1<<(cell&31))>>>0);
    blocked.forEach(cell=>{board[cell]=1;words[wordIndex[cell]]|=bit[cell];});
    const neighbors=Array.from({length:total},(_,cell)=>{
      const row=Math.floor(cell/size),col=cell%size;
      return [row?cell-size:-1,row+1<size?cell+size:-1,col?cell-1:-1,col+1<size?cell+1:-1].filter(next=>next>=0);
    });
    const checker=Array.from({length:total},(_,cell)=>(Math.floor(cell/size)+cell%size)%2?-1:1);
    const colorWeight=variants.map(variant=>Math.abs(variant.cells.reduce((sum,[row,col])=>sum+((row+col)%2?-1:1),0)));
    const placements=[], byCell=Array.from({length:total},()=>[]), byType=Array.from({length:variants.length},()=>[]);
    for(const type of initialTypes)for(let anchor=0;anchor<total;anchor++) {
      const row=Math.floor(anchor/size),col=anchor%size, offsets=variants[type].cells;
      if(offsets.some(([dr,dc])=>row+dr<0||row+dr>=size||col+dc<0||col+dc>=size))continue;
      const cells=offsets.map(([dr,dc])=>(row+dr)*size+col+dc);
      if(cells.some(cell=>board[cell]))continue;
      const index=placements.push({type,anchor,cells})-1;
      byType[type].push(index);cells.forEach(cell=>byCell[cell].push(index));
    }
    const hits=new Uint8Array(placements.length), validCounts=byType.map(list=>list.length), cellOptions=new Int32Array(total);
    const chosen=[];
    let nodes=0,lastProgress=0,attempts=0;
    function report(force) {
      const now=Date.now();
      if(options.onProgress && (force||now-lastProgress>250)) {
        lastProgress=now;
        options.onProgress({targetTiles,upperBound:targetTiles,testedPrefixes:attempts,nodes,elapsedMs:now-started});
      }
    }
    // Maintain available placements incrementally instead of scanning every
    // piece footprint at each search node.
    function occupy(cell) {
      board[cell]=1;words[wordIndex[cell]]|=bit[cell];
      for(const index of byCell[cell])if(hits[index]++===0) {
        const placement=placements[index];validCounts[placement.type]--;
        if(counts[placement.type])for(const member of placement.cells)cellOptions[member]--;
      }
    }
    function release(cell) {
      board[cell]=0;words[wordIndex[cell]]^=bit[cell];
      for(const index of byCell[cell])if(--hits[index]===0) {
        const placement=placements[index];validCounts[placement.type]++;
        if(counts[placement.type])for(const member of placement.cells)cellOptions[member]++;
      }
    }
    function activateType(type,delta) {
      for(const index of byType[type])if(!hits[index])for(const cell of placements[index].cells)cellOptions[cell]+=delta;
    }
    const seen=new Uint32Array(total),stack=new Int32Array(total);
    let generation=0;
    function islandsPossible(empty) {
      const current=++generation;
      let minimumEmpty=0,difference=0,free=0;
      for(let cell=0;cell<total;cell++) {
        if(board[cell]||seen[cell]===current)continue;
        let count=0,length=1;stack[0]=cell;seen[cell]=current;
        while(length) {
          const next=stack[--length];count++;difference+=checker[next];
          for(const neighbor of neighbors[next])if(!board[neighbor]&&seen[neighbor]!==current) {
            seen[neighbor]=current;stack[length++]=neighbor;
          }
        }
        free+=count;minimumEmpty+=count%area;
        if(minimumEmpty>empty)return false;
      }
      // All tetrominoes except T are checkerboard-balanced. A T has a
      // difference of +2 or -2. Allow every possible color split of holes.
      let tees=0;
      for(const type of initialTypes) {
        if(colorWeight[type]===2)tees+=counts[type];
        else if(colorWeight[type]!==0)return true;
      }
      const black=(free+difference)/2,white=free-black;
      for(let blackEmpty=Math.max(0,empty-white);blackEmpty<=Math.min(empty,black);blackEmpty++) {
        const required=difference-(2*blackEmpty-empty);
        if(Math.abs(required)<=2*tees && (required+2*tees)%4===0)return true;
      }
      return false;
    }
    while(prefix>=0) {
      attempts++;
      const empty=freeArea-targetTiles,memo=new Set(),multipliers=Array(variants.length).fill(0);
      let radix=1,code=0;
      for(const type of initialTypes){multipliers[type]=radix;code+=counts[type]*radix;radix*=counts[type]+1;}
      cellOptions.fill(0);
      for(const type of initialTypes)if(counts[type])activateType(type,1);
      report(true);
      function search(holes,remaining,countCode) {
        nodes++;if((nodes&16383)===0)report(false);
        if(!remaining)return true;
        const key=words.join('.')+':'+countCode;
        if(memo.has(key))return false;
        for(const type of initialTypes)if(validCounts[type]<counts[type])return false;
        let bestCell=-1,bestCount=Infinity;
        const forced=[];
        for(let cell=0;cell<total;cell++)if(!board[cell]) {
          const count=cellOptions[cell];
          if(!count)forced.push(cell);
          else if(count<bestCount){bestCell=cell;bestCount=count;}
        }
        if(forced.length) {
          if(forced.length>holes)return false;
          forced.forEach(occupy);
          const result=search(holes-forced.length,remaining,countCode);
          for(let index=forced.length-1;index>=0;index--)release(forced[index]);
          return result;
        }
        if(bestCell<0||!islandsPossible(holes))return false;
        const candidates=byCell[bestCell].filter(index=>!hits[index]&&counts[placements[index].type]);
        candidates.sort((left,right)=>{
          const a=placements[left].type,b=placements[right].type;
          return validCounts[a]/counts[a]-validCounts[b]/counts[b];
        });
        for(const index of candidates) {
          const placement=placements[index],type=placement.type;
          if(--counts[type]===0)activateType(type,-1);
          placement.cells.forEach(occupy);chosen.push(placement);
          if(search(holes,remaining-1,countCode-multipliers[type]))return true;
          chosen.pop();
          for(let index=placement.cells.length-1;index>=0;index--)release(placement.cells[index]);
          if(counts[type]++===0)activateType(type,1);
        }
        if(holes) {
          occupy(bestCell);
          const result=search(holes-1,remaining,countCode);
          release(bestCell);
          if(result)return true;
        }
        if(memo.size<300000)memo.add(key);
        return false;
      }
      if(search(empty,prefix,code)) {
        const pools=Array.from({length:variants.length},()=>[]);
        chosen.forEach(placement=>pools[placement.type].push(placement));
        const result=types.slice(0,prefix).map((type,index)=>{
          const placement=pools[type].pop();
          return {index,kind:sequence[index].kind,orientation:sequence[index].orientation,anchor:placement.anchor,cells:[...placement.cells]};
        });
        return {optimalTiles:targetTiles,placements:result,exact:true,nodes,elapsedMs:Date.now()-started};
      }
      if(prefix===0)break;
      counts[types[--prefix]]--;targetTiles-=area;
    }
    return {optimalTiles:0,placements:[],exact:true,nodes,elapsedMs:Date.now()-started};
  }
  // Exact best subset of all revealed draws; unused inventory may be discarded.
  function solveObserved(position, options = {}) {
    const started=Date.now(), size=position.size;
    if(!Number.isInteger(size) || size<1 || size>13)throw new Error('The solver supports square boards of size 1–13.');
    const total=size*size, blocked=new Set(position.blocked || []);
    if([...blocked].some(cell=>!Number.isInteger(cell)||cell<0||cell>=total))throw new Error('Invalid blocked square.');
    const sequence=position.pool || [];
    if(!Array.isArray(sequence)||sequence.length>128||sequence.some(piece=>!piece||typeof piece.id!=='string')||new Set(sequence.map(piece=>piece.id)).size!==sequence.length)throw new Error('An observed pool requires unique draw IDs.');
    const types=sequence.map(piece=>{const type=typeOf(piece);if(type<0)throw new Error('Invalid piece.');return type;});
    const area=variants[0].cells.length;
    if(variants.some(variant=>variant.cells.length!==area))throw new Error('All pieces must have equal area.');
    const freeArea=total-blocked.size;
    let prefix=Math.min(types.length,Math.floor(freeArea/area)), targetTiles=prefix*area;
    // Remap a legal original-board packing to available observed variants.
    // Its IDs and claimed score carry no authority; every footprint is checked.
    const hintKeys=new Set(),hintResult=[],hintOccupied=new Set(blocked);
    const hintPools=Array.from({length:variants.length},()=>[]);
    sequence.forEach((piece,index)=>hintPools[types[index]].push(piece));
    let hintValid=true;
    for(const placement of position.hint || []) {
      const type=typeOf(placement),anchor=placement.anchor;
      if(type<0||!Number.isInteger(anchor)||anchor<0||anchor>=total){hintValid=false;break;}
      const row=Math.floor(anchor/size),col=anchor%size,offsets=variants[type].cells;
      if(offsets.some(([dr,dc])=>row+dr<0||row+dr>=size||col+dc<0||col+dc>=size)){hintValid=false;break;}
      const cells=offsets.map(([dr,dc])=>(row+dr)*size+col+dc);
      if(cells.some(cell=>hintOccupied.has(cell))){hintValid=false;break;}
      cells.forEach(cell=>hintOccupied.add(cell));hintKeys.add(`${type}:${anchor}`);
      if(hintPools[type].length)hintResult.push({...hintPools[type].shift(),anchor,cells});
    }
    if(!hintValid){hintKeys.clear();hintResult.length=0;}
    if(hintResult.length>=prefix)return {optimalTiles:targetTiles,placements:hintResult.slice(0,prefix),exact:true,nodes:0,elapsedMs:Date.now()-started};
    const counts=Array(variants.length).fill(0);
    types.forEach(type=>counts[type]++);
    const initialTypes=counts.map((count,type)=>count?type:-1).filter(type=>type>=0);
    const board=new Uint8Array(total), words=new Uint32Array(Math.ceil(total/32));
    const wordIndex=Array.from({length:total},(_,cell)=>cell>>>5), bit=Array.from({length:total},(_,cell)=>(1<<(cell&31))>>>0);
    blocked.forEach(cell=>{board[cell]=1;words[wordIndex[cell]]|=bit[cell];});
    const neighbors=Array.from({length:total},(_,cell)=>{
      const row=Math.floor(cell/size),col=cell%size;
      return [row?cell-size:-1,row+1<size?cell+size:-1,col?cell-1:-1,col+1<size?cell+1:-1].filter(next=>next>=0);
    });
    const checker=Array.from({length:total},(_,cell)=>(Math.floor(cell/size)+cell%size)%2?-1:1);
    const colorWeight=variants.map(variant=>Math.abs(variant.cells.reduce((sum,[row,col])=>sum+((row+col)%2?-1:1),0)));
    const placements=[], byCell=Array.from({length:total},()=>[]), byType=Array.from({length:variants.length},()=>[]);
    for(const type of initialTypes)for(let anchor=0;anchor<total;anchor++) {
      const row=Math.floor(anchor/size),col=anchor%size, offsets=variants[type].cells;
      if(offsets.some(([dr,dc])=>row+dr<0||row+dr>=size||col+dc<0||col+dc>=size))continue;
      const cells=offsets.map(([dr,dc])=>(row+dr)*size+col+dc);
      if(cells.some(cell=>board[cell]))continue;
      const index=placements.push({type,anchor,cells})-1;
      byType[type].push(index);cells.forEach(cell=>byCell[cell].push(index));
    }
    const hits=new Uint8Array(placements.length), validCounts=byType.map(list=>list.length), cellOptions=new Int32Array(total);
    const chosen=[];
    let nodes=0,lastProgress=0,attempts=0;
    const maxNodes=options.maxNodes===undefined?Infinity:options.maxNodes;
    function report(force) {
      const now=Date.now();
      if(options.onProgress && (force||now-lastProgress>250)) {
        lastProgress=now;
        options.onProgress({targetTiles,upperBound:targetTiles,testedPrefixes:attempts,nodes,elapsedMs:now-started});
      }
    }
    // Maintain available placements incrementally instead of scanning every
    // piece footprint at each search node.
    function occupy(cell) {
      board[cell]=1;words[wordIndex[cell]]|=bit[cell];
      for(const index of byCell[cell])if(hits[index]++===0) {
        const placement=placements[index];validCounts[placement.type]--;
        if(counts[placement.type])for(const member of placement.cells)cellOptions[member]--;
      }
    }
    function release(cell) {
      board[cell]=0;words[wordIndex[cell]]^=bit[cell];
      for(const index of byCell[cell])if(--hits[index]===0) {
        const placement=placements[index];validCounts[placement.type]++;
        if(counts[placement.type])for(const member of placement.cells)cellOptions[member]++;
      }
    }
    function activateType(type,delta) {
      for(const index of byType[type])if(!hits[index])for(const cell of placements[index].cells)cellOptions[cell]+=delta;
    }
    const seen=new Uint32Array(total),stack=new Int32Array(total);
    let generation=0;
    function islandsPossible(empty,remaining) {
      const current=++generation;
      let minimumEmpty=0,difference=0,free=0;
      for(let cell=0;cell<total;cell++) {
        if(board[cell]||seen[cell]===current)continue;
        let count=0,length=1;stack[0]=cell;seen[cell]=current;
        while(length) {
          const next=stack[--length];count++;difference+=checker[next];
          for(const neighbor of neighbors[next])if(!board[neighbor]&&seen[neighbor]!==current) {
            seen[neighbor]=current;stack[length++]=neighbor;
          }
        }
        free+=count;minimumEmpty+=count%area;
        if(minimumEmpty>empty)return false;
      }
      // All tetrominoes except T are checkerboard-balanced. A T has a
      // difference of +2 or -2. Allow every possible color split of holes.
      let tees=0,balanced=0;
      for(const type of initialTypes) {
        if(colorWeight[type]===2)tees+=counts[type];
        else if(colorWeight[type]!==0)return true;
        else balanced+=counts[type];
      }
      const black=(free+difference)/2,white=free-black;
      for(let blackEmpty=Math.max(0,empty-white);blackEmpty<=Math.min(empty,black);blackEmpty++) {
        const required=difference-(2*blackEmpty-empty);
        for(let usedTees=Math.max(0,remaining-balanced);usedTees<=Math.min(tees,remaining);usedTees++) {
          if(Math.abs(required)<=2*usedTees && (required+2*usedTees)%4===0)return true;
        }
      }
      return false;
    }
    while(prefix>=0) {
      attempts++;
      const empty=freeArea-targetTiles,memo=new Set();
      cellOptions.fill(0);
      for(const type of initialTypes)if(counts[type])activateType(type,1);
      report(true);
      function search(holes,remaining) {
        nodes++;if(nodes>maxNodes){const error=new Error('The observed-pool optimum needs more search time.');error.code='PACKING_SEARCH_LIMIT';error.nodes=nodes;throw error;}
        if((nodes&16383)===0)report(false);
        if(!remaining)return true;
        const key=words.join('.')+':'+counts.join(',');
        if(memo.has(key))return false;
        let capacity=0;
        for(const type of initialTypes)capacity+=Math.min(validCounts[type],counts[type]);
        if(capacity<remaining)return false;
        let bestCell=-1,bestCount=Infinity;
        const forced=[];
        for(let cell=0;cell<total;cell++)if(!board[cell]) {
          const count=cellOptions[cell];
          if(!count)forced.push(cell);
          else if(count<bestCount){bestCell=cell;bestCount=count;}
        }
        if(forced.length) {
          if(forced.length>holes)return false;
          forced.forEach(occupy);
          const result=search(holes-forced.length,remaining);
          for(let index=forced.length-1;index>=0;index--)release(forced[index]);
          return result;
        }
        if(bestCell<0||!islandsPossible(holes,remaining))return false;
        const candidates=byCell[bestCell].filter(index=>!hits[index]&&counts[placements[index].type]);
        candidates.sort((left,right)=>{
          const a=placements[left].type,b=placements[right].type;
          const preferredLeft=hintKeys.has(`${a}:${placements[left].anchor}`)?0:1;
          const preferredRight=hintKeys.has(`${b}:${placements[right].anchor}`)?0:1;
          return preferredLeft-preferredRight || validCounts[a]/counts[a]-validCounts[b]/counts[b];
        });
        for(const index of candidates) {
          const placement=placements[index],type=placement.type;
          if(--counts[type]===0)activateType(type,-1);
          placement.cells.forEach(occupy);chosen.push(placement);
          if(search(holes,remaining-1))return true;
          chosen.pop();
          for(let index=placement.cells.length-1;index>=0;index--)release(placement.cells[index]);
          if(counts[type]++===0)activateType(type,1);
        }
        if(holes) {
          occupy(bestCell);
          const result=search(holes-1,remaining);
          release(bestCell);
          if(result)return true;
        }
        if(memo.size<300000)memo.add(key);
        return false;
      }
      if(search(empty,prefix)) {
        const pools=Array.from({length:variants.length},()=>[]);
        sequence.forEach((piece,index)=>pools[types[index]].push(piece));
        const result=chosen.map(placement=>{
          const piece=pools[placement.type].shift();
          return {...piece,anchor:placement.anchor,cells:[...placement.cells]};
        });
        return {optimalTiles:targetTiles,placements:result,exact:true,nodes,elapsedMs:Date.now()-started};
      }
      if(prefix===0)break;
      prefix--;targetTiles-=area;
    }
    return {optimalTiles:0,placements:[],exact:true,nodes,elapsedMs:Date.now()-started};
  }
  function seededRandom(seed) {
    let value=Number(seed)>>>0;
    return function () {
      value=(value+0x6D2B79F5)>>>0;
      let mixed=Math.imul(value^(value>>>15),1|value);
      mixed^=mixed+Math.imul(mixed^(mixed>>>7),61|mixed);
      return ((mixed^(mixed>>>14))>>>0)/4294967296;
    };
  }

  // Build the puzzle and its arrival stream together. The displayed optimum
  // is certified by a legal packing that reaches the board's area bound.
  // A fixed node limit only rejects candidate boards; it never labels a
  // partial packing optimal and never makes generation depend on elapsed time.
  function generate(seed, options={}) {
    seed=Number(seed)>>>0;
    const size=options.size===undefined?7:options.size;
    const blockRanges={5:[0,1],7:[1,3],9:[2,4],11:[3,6]};
    if(!Object.prototype.hasOwnProperty.call(blockRanges,size)||!Number.isInteger(size))throw new Error('Choose a board size of 5, 7, 9 or 11.');
    const [minimumBlocks,maximumBlocks]=blockRanges[size];
    const started=Date.now(),rng=seededRandom(seed),total=size*size,area=variants[0].cells.length;
    const neighbors=Array.from({length:total},(_,cell)=>{
      const row=Math.floor(cell/size),col=cell%size;
      return [row?cell-size:-1,row+1<size?cell+size:-1,col?cell-1:-1,col+1<size?cell+1:-1].filter(next=>next>=0);
    });
    const familyIndex=new Map(pieces.families.map((kind,index)=>[kind,index]));
    const familyVariants=pieces.families.map(kind=>variants.filter(variant=>variant.kind===kind).length);
    const wordIndex=Array.from({length:total},(_,cell)=>cell>>>5),bits=Array.from({length:total},(_,cell)=>(1<<(cell&31))>>>0);
    let attempts=0,totalNodes=0,lastProgress=0;
    for(;;) {
      attempts++;
      const count=minimumBlocks+Math.floor(rng()*(maximumBlocks-minimumBlocks+1)),blocked=new Set();
      while(blocked.size<count) {
        let cell;
        if(blocked.size && rng()<0.28) {
          const previous=[...blocked][Math.floor(rng()*blocked.size)];
          const adjacent=neighbors[previous];cell=adjacent[Math.floor(rng()*adjacent.length)];
        } else cell=Math.floor(rng()*total);
        blocked.add(cell);
      }
      const board=new Uint8Array(total),words=new Uint32Array(Math.ceil(total/32));
      blocked.forEach(cell=>{board[cell]=1;words[wordIndex[cell]]|=bits[cell];});
      const seen=new Uint32Array(total),stack=new Int32Array(total);
      let generation=0;
      function islandMinimum(rejectSmall=false) {
        const current=++generation;
        let minimum=0;
        for(let cell=0;cell<total;cell++) {
          if(board[cell]||seen[cell]===current)continue;
          let count=0,length=1;stack[0]=cell;seen[cell]=current;
          while(length) {
            const next=stack[--length];count++;
            for(const neighbor of neighbors[next])if(!board[neighbor]&&seen[neighbor]!==current) {
              seen[neighbor]=current;stack[length++]=neighbor;
            }
          }
          if(rejectSmall&&count<area)return Infinity;
          minimum+=count%area;
        }
        return minimum;
      }
      const prefix=Math.floor((total-count)/area),holes=total-count-prefix*area;
      if(islandMinimum(true)>holes)continue;
      const placements=[],byCell=Array.from({length:total},()=>[]);
      for(let type=0;type<variants.length;type++)for(let anchor=0;anchor<total;anchor++) {
        const row=Math.floor(anchor/size),col=anchor%size,variant=variants[type];
        if(variant.cells.some(([dr,dc])=>row+dr<0||row+dr>=size||col+dc<0||col+dc>=size))continue;
        const cells=variant.cells.map(([dr,dc])=>(row+dr)*size+col+dc);
        if(cells.some(cell=>board[cell]))continue;
        const family=familyIndex.get(variant.kind);
        const priority=-Math.log(Math.max(rng(),1/4294967296))*familyVariants[family];
        const index=placements.push({type,anchor,cells,family,priority})-1;
        cells.forEach(cell=>byCell[cell].push(index));
      }
      const hits=new Uint8Array(placements.length),cellOptions=Int32Array.from(byCell,list=>list.length);
      const used=new Uint8Array(pieces.families.length),chosen=[],memo=new Set();
      let nodes=0,aborted=false;
      function occupy(cell) {
        board[cell]=1;words[wordIndex[cell]]|=bits[cell];
        for(const index of byCell[cell])if(hits[index]++===0)for(const member of placements[index].cells)cellOptions[member]--;
      }
      function release(cell) {
        board[cell]=0;words[wordIndex[cell]]^=bits[cell];
        for(const index of byCell[cell])if(--hits[index]===0)for(const member of placements[index].cells)cellOptions[member]++;
      }
      function search(empty,remaining) {
        nodes++;totalNodes++;
        if(nodes>25000){aborted=true;return false;}
        if((nodes&1023)===0 && options.onProgress && Date.now()-lastProgress>250) {
          lastProgress=Date.now();options.onProgress({stage:'generating',attempts,nodes:totalNodes,elapsedMs:lastProgress-started});
        }
        if(!remaining)return true;
        const key=words.join('.')+':'+empty;
        if(memo.has(key))return false;
        let bestCell=-1,bestCount=Infinity;
        const forced=[];
        for(let cell=0;cell<total;cell++)if(!board[cell]) {
          const available=cellOptions[cell];
          if(!available)forced.push(cell);
          else if(available<bestCount){bestCell=cell;bestCount=available;}
        }
        if(forced.length) {
          if(forced.length>empty)return false;
          forced.forEach(occupy);
          const result=search(empty-forced.length,remaining);
          for(let index=forced.length-1;index>=0;index--)release(forced[index]);
          return result;
        }
        if(bestCell<0||islandMinimum()>empty)return false;
        const candidates=byCell[bestCell].filter(index=>!hits[index]);
        candidates.sort((a,b)=>{
          const left=placements[a],right=placements[b];
          return left.priority*(1+used[left.family])**2-right.priority*(1+used[right.family])**2 || a-b;
        });
        for(const index of candidates) {
          const placement=placements[index];
          placement.cells.forEach(occupy);used[placement.family]++;chosen.push(placement);
          if(search(empty,remaining-1))return true;
          chosen.pop();used[placement.family]--;
          for(let index=placement.cells.length-1;index>=0;index--)release(placement.cells[index]);
          if(aborted)return false;
        }
        if(empty) {
          occupy(bestCell);const result=search(empty-1,remaining);release(bestCell);
          if(result)return true;
        }
        if(memo.size<25000)memo.add(key);
        return false;
      }
      if(!search(holes,prefix))continue;
      // Fix the entire online sequence before play. Shuffle the certificate's
      // pieces, with a soft guard against more than three identical families.
      const order=[...chosen];
      for(let index=order.length-1;index>0;index--) {
        const selected=Math.floor(rng()*(index+1));[order[index],order[selected]]=[order[selected],order[index]];
      }
      for(let index=3;index<order.length;index++) {
        const kind=variants[order[index].type].kind;
        if([1,2,3].every(offset=>variants[order[index-offset].type].kind===kind)) {
          const replacement=order.findIndex((placement,next)=>next>index&&variants[placement.type].kind!==kind);
          if(replacement>=0)[order[index],order[replacement]]=[order[replacement],order[index]];
        }
      }
      const result=order.map((placement,index)=>({index,kind:variants[placement.type].kind,orientation:variants[placement.type].orientation,anchor:placement.anchor,cells:[...placement.cells]}));
      const sequence=result.map(({kind,orientation})=>({kind,orientation}));
      while(sequence.length<64) {
        const bag=[...pieces.families];
        for(let index=bag.length-1;index>0;index--) {
          const selected=Math.floor(rng()*(index+1));[bag[index],bag[selected]]=[bag[selected],bag[index]];
        }
        for(const kind of bag) {
          if(sequence.length===64)break;
          const orientations=pieces.orientations(kind);
          sequence.push({kind,orientation:orientations[Math.floor(rng()*orientations.length)]});
        }
      }
      const position={size,blocked:[...blocked].sort((a,b)=>a-b),seed,sequence};
      const solution={optimalTiles:prefix*area,placements:result,exact:true,nodes:totalNodes,elapsedMs:Date.now()-started};
      return {position,solution,attempts};
    }
  }
  const api={solve,solveObserved,generate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.PackingSolver=api;
})(typeof self!=='undefined'?self:globalThis);
