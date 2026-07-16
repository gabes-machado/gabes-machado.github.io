export const CHARACTER_RAMP = "  ..::--==++**##%%@@";

export const MAX_PIXEL_RATIO = 2;

export const FONT_WEIGHT = 500;
export const CELL_WIDTH_FACTOR = 1.35;
export const CELL_HEIGHT_FACTOR = 1.55;

export const TARGET_FRAMES_PER_SECOND = 20;

export const FRAME_INTERVAL = 1000 / TARGET_FRAMES_PER_SECOND;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const POINTER_POSITION_RESPONSE = 12;
export const POINTER_STRENGTH_RESPONSE = 7;

export const POPULATION_SIZE = 14;
export const ELITE_COUNT = 2;
export const TOURNAMENT_SIZE = 3;

export const MUTATION_RATE = 0.24;
export const MUTATION_STEP_MIN = 0.03;
export const MUTATION_STEP_MAX = 0.16;

export const GENERATION_INTERVAL_SECONDS = 9;
export const GENOME_TRANSITION_SECONDS = 4.5;

export const FITNESS_SAMPLE_COLUMNS = 18;
export const FITNESS_SAMPLE_ROWS = 12;

export const FITNESS_TIME_A = 0;
export const FITNESS_TIME_B = 1.4;

export const GENE_RANGES = Object.freeze({
  horizontalFrequency: Object.freeze([0.1, 0.24]),

  verticalFrequency: Object.freeze([0.14, 0.32]),

  diagonalFrequency: Object.freeze([0.06, 0.16]),

  radialFrequency: Object.freeze([10, 24]),

  horizontalSpeed: Object.freeze([0.35, 1.15]),

  verticalSpeed: Object.freeze([0.25, 0.95]),

  diagonalSpeed: Object.freeze([0.18, 0.72]),

  radialSpeed: Object.freeze([0.45, 1.55]),

  horizontalWeight: Object.freeze([0.18, 0.42]),

  verticalWeight: Object.freeze([0.16, 0.36]),

  diagonalWeight: Object.freeze([0.12, 0.32]),

  radialWeight: Object.freeze([0.1, 0.3]),

  noiseWeight: Object.freeze([0.06, 0.22]),

  densityBias: Object.freeze([-0.1, 0.1]),

  pointerRadiusRatio: Object.freeze([0.24, 0.4]),

  pointerDensityBoost: Object.freeze([0.2, 0.46]),

  pointerRippleAmplitude: Object.freeze([0.08, 0.22]),

  pointerRippleFrequency: Object.freeze([0.025, 0.065]),

  pointerRippleSpeed: Object.freeze([2.2, 4.6]),
});

export const GENE_NAMES = Object.freeze(Object.keys(GENE_RANGES));
