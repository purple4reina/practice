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

  // TODO:
  // "square root"
};
