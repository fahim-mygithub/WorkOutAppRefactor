/** Round a weight to the nearest 5 lb (the practical step for in-session cues). */
export const round5 = (n: number): number => Math.round(n / 5) * 5;
