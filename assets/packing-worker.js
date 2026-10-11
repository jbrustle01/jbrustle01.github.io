'use strict';
importScripts('./packing-pieces.js?v=reroll-19', './packing-solver.js?v=reroll-19');
self.onmessage = function (event) {
  const {id, position, seed, size, type} = event.data || {};
  try {
    const options={size,onProgress: progress => self.postMessage({id,type:'progress',...progress})};
    if(type==='generate') {
      const generated=PackingSolver.generate(seed,options);
      self.postMessage({id,type:'generated',...generated});
    } else if(type==='observed') {
      const result=PackingSolver.solveObserved(position,options);
      self.postMessage({id,type:'result',...result});
    } else {
      const result=PackingSolver.solve(position,options);
      self.postMessage({id,type:'result',...result});
    }
  } catch(error) {
    self.postMessage({id,type:'error',message:error.message || 'Unable to calculate the hindsight optimum.'});
  }
};
