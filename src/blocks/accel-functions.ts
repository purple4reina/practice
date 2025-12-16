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

  circle: (opts: accelFunctionOpts): number => {
    const { thisClick, totalClicks, initialTempo, finalTempo } = opts;
    const curvature = 1;
    if (Math.abs(finalTempo - initialTempo) < 1e-15) {
      return thisClick / initialTempo;
    }
    const circularProgress = (u: number): number => {
      if (u <= 0.5) {
        return Math.sqrt(u * (1 - u));
      } else {
        const x = 2 * u - 1;
        return 0.5 + 0.5 * (1 - Math.sqrt(1 - x * x));
      }
    };
    const progress = (u: number): number => {
      return (1 - curvature) * u + curvature * circularProgress(u);
    };
    const getTempo = (u: number): number => {
      return initialTempo + (finalTempo - initialTempo) * progress(u);
    };
    const T = 2 * totalClicks / (initialTempo + finalTempo);
    const integrateBeats = (uEnd: number): number => {
      const n = 100;
      const h = uEnd / n;
      let sum = getTempo(0);
      for (let i = 1; i < n; i++) {
        sum += (i % 2 === 0 ? 2 : 4) * getTempo(i * h);
      }
      sum += getTempo(uEnd);
      return T * (h / 3) * sum;
    };
    let u = thisClick / totalClicks;
    for (let i = 0; i < 50; i++) {
      const beats = integrateBeats(u);
      const f = beats - thisClick;
      const fp = T * getTempo(u);
      const uNew = u - f / fp;
      if (Math.abs(uNew - u) < 1e-12) break;
      u = Math.max(0, Math.min(1, uNew));
    }
    return u * T;
  },
};
