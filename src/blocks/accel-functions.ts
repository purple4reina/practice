type accelFunctionOpts = {
  thisClick: number,
  totalClicks: number,
  initialTempo: number,
  finalTempo: number,
};

export const accelFunctions = {
  linear: (opts: accelFunctionOpts): number => {
    const totalTime = opts.totalClicks / (opts.initialTempo + (opts.finalTempo - opts.initialTempo) / 2)
    const A = (opts.finalTempo - opts.initialTempo) / 2 / totalTime;
    const B = opts.initialTempo;
    const C = -opts.thisClick;
    return (-B + Math.sqrt(B**2 - 4*A*C)) / (2*A);
  },

  parabola: (opts: accelFunctionOpts): number => {
    const k = (opts.finalTempo - opts.initialTempo) / opts.totalClicks;
    if (Math.abs(k) < 1e-15) {
      return opts.thisClick / opts.initialTempo;
    }
    return Math.log(1 + (opts.thisClick * k) / opts.initialTempo) / k;
  },

  squareRoot: (opts: accelFunctionOpts): number => {
    const { thisClick, totalClicks, initialTempo, finalTempo } = opts;
    if (Math.abs(finalTempo - initialTempo) < 1e-15) {
      return thisClick / initialTempo;
    }
    const T = 3 * totalClicks / (initialTempo + 2 * finalTempo);
    const A = initialTempo;
    const B = (2 / 3) * (finalTempo - initialTempo) / Math.sqrt(T);
    let t = thisClick / initialTempo; // initial guess
    for (let i = 0; i < 50; i++) {
      const sqrtT = Math.sqrt(t);
      const f = A * t + B * t * sqrtT - thisClick;
      const fp = A + 1.5 * B * sqrtT;
      const tNew = t - f / fp;
      if (Math.abs(tNew - t) < 1e-12) break;
      t = tNew;
    }
    return t;
  }
};
