type accelFunctionOpts = {
  thisClick: number,
  totalClicks: number,
  initialTempo: number,
  finalTempo: number,
};

export const accelFunctions = {
  linear: (opts: accelFunctionOpts): number => {
    const { thisClick, totalClicks, initialTempo, finalTempo } = opts;
    const totalTime = totalClicks / (initialTempo + (finalTempo - initialTempo) / 2)
    const A = (finalTempo - initialTempo) / 2 / totalTime;
    const B = initialTempo;
    const C = -thisClick;
    return (-B + Math.sqrt(B**2 - 4*A*C)) / (2*A);
  },

  parabola: (opts: accelFunctionOpts): number => {
    const { thisClick, totalClicks, initialTempo, finalTempo } = opts;
    const k = (finalTempo - initialTempo) / totalClicks;
    if (Math.abs(k) < 1e-15) {
      return thisClick / initialTempo;
    }
    return Math.log(1 + (thisClick * k) / initialTempo) / k;
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
  },

  cosine: (opts: accelFunctionOpts): number => {
    const { thisClick, totalClicks, initialTempo, finalTempo } = opts;
    if (Math.abs(finalTempo - initialTempo) < 1e-15) {
      return thisClick / initialTempo;
    }
    const T = 2 * totalClicks / (initialTempo + finalTempo);
    const A = (initialTempo + finalTempo) / 2;
    const B = (finalTempo - initialTempo) * T / (2 * Math.PI);
    let t = thisClick / A; // initial guess
    for (let i = 0; i < 50; i++) {
      const sinTerm = Math.sin(Math.PI * t / T);
      const cosTerm = Math.cos(Math.PI * t / T);
      const f = A * t - B * sinTerm - thisClick;
      const fp = A - (finalTempo - initialTempo) / 2 * cosTerm;
      const tNew = t - f / fp;
      if (Math.abs(tNew - t) < 1e-12) break;
      t = tNew;
    }
    return t;
  },
};
