import { expect, describe, test } from "vitest";
import { accelFunctions } from "./accel-functions";

const tests = {
  linear: [
    1005.25400,
    1570.88324,
    2012.62644,
    2387.74711,
    2719.55937,
    3020.30324,
    3297.35214,
    3555.55556,
  ],
  quadratic: [
    1436.81979,
    2312.23066,
    2943.66694,
    3437.89119,
    3844.01960,
    4188.75763,
    4488.25080,
    4753.00924,
  ],
  squareRoot: [
    625.642301,
    1042.75923,
    1399.91988,
    1722.35975,
    2020.96914,
    2301.73635,
    2568.40825,
    2823.52941,
  ],
  cosine: [
    1219.92415,
    1769.12755,
    2163.07735,
    2489.60095,
    2779.57486,
    3048.19524,
    3304.65868,
    3555.55556,
  ],
  circular: [
    683.98579,
    1176.63843,
    1630.07387,
    2073.64450,
    2503.15048,
    2901.43045,
    3256.47452,
    3555.55556,
  ],
};
const startTempo = 30  // bpm
const endTempo = 240  // bpm

for (const funcName in tests) {
  const cases = tests[funcName as keyof typeof tests];
  describe(`${funcName}: ${startTempo} to ${endTempo}`, () => {
    for (let i = 0; i < cases.length; i++) {
      test(`  click ${i + 1}`, () => {
        const result = accelFunctions[funcName as keyof typeof accelFunctions]({
          thisClick: i + 1,
          totalClicks: cases.length,
          initialTempo: startTempo / 60 / 1000,
          finalTempo: endTempo / 60 / 1000,
        });
        expect(result).toBeCloseTo(cases[i], 5);
      });
    }
  });
}
