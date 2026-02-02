export const breakpoints = {
  xsMax: 520,
  smMin: 521,
  smMax: 639,
  mdMin: 640,
  mdMax: 899,
  lgMin: 900,
  lgMax: 1279,
  xlMin: 1280,
  xlMax: 1439,
  xxlMin: 1440,
  xxlMax: 1919,
  ultraMin: 1920
};

const media = query => window.matchMedia ? window.matchMedia(query) : { matches: false };

export const mqAtMost = valuePx => media(`(max-width: ${valuePx}px)`);
export const mqAtLeast = valuePx => media(`(min-width: ${valuePx}px)`);
export const isAtMost = valuePx => mqAtMost(valuePx).matches;
export const isAtLeast = valuePx => mqAtLeast(valuePx).matches;

export const mq = {
  xs: () => mqAtMost(breakpoints.xsMax),
  smDown: () => mqAtMost(breakpoints.smMax),
  md: () => media(`(min-width: ${breakpoints.mdMin}px) and (max-width: ${breakpoints.mdMax}px)`),
  mdDown: () => mqAtMost(breakpoints.mdMax),
  mdUp: () => mqAtLeast(breakpoints.mdMin),
  lg: () => media(`(min-width: ${breakpoints.lgMin}px) and (max-width: ${breakpoints.lgMax}px)`),
  lgUp: () => mqAtLeast(breakpoints.lgMin),
  lgDown: () => mqAtMost(breakpoints.lgMax),
  xl: () => media(`(min-width: ${breakpoints.xlMin}px) and (max-width: ${breakpoints.xlMax}px)`),
  xxl: () => media(`(min-width: ${breakpoints.xxlMin}px) and (max-width: ${breakpoints.xxlMax}px)`),
  ultra: () => mqAtLeast(breakpoints.ultraMin)
};
