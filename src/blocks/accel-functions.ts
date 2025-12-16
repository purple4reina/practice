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

  // TODO:
  // parabola
  // "square root"
};
