import {
  FITNESS_SAMPLE_COLUMNS,
  FITNESS_SAMPLE_ROWS,
  FITNESS_TIME_A,
  FITNESS_TIME_B,
} from "./ascii-config.js";

import { calculateProceduralIntensity, decodeGenome } from "./ascii-field.js";

export function evaluateGenome(genome) {
  const fieldParameters = decodeGenome(genome);

  const frameA = sampleField({
    fieldParameters,
    animationTime: FITNESS_TIME_A,
  });

  const frameB = sampleField({
    fieldParameters,
    animationTime: FITNESS_TIME_B,
  });

  const mean = calculateMean(frameA.values);

  const standardDeviation = calculateStandardDeviation({
    values: frameA.values,
    mean,
  });

  const denseRatio = calculateDenseRatio(frameA.values, 0.52);

  const spatialRoughness = calculateSpatialRoughness(frameA.matrix);

  const temporalMovement = calculateTemporalMovement({
    frameA: frameA.values,
    frameB: frameB.values,
  });

  const densityScore = scoreTarget({
    value: mean,
    target: 0.5,
    tolerance: 0.24,
  });

  const contrastScore = scoreTarget({
    value: standardDeviation,
    target: 0.17,
    tolerance: 0.14,
  });

  const distributionScore = scoreTarget({
    value: denseRatio,
    target: 0.46,
    tolerance: 0.36,
  });

  const continuityScore = scoreTarget({
    value: spatialRoughness,
    target: 0.11,
    tolerance: 0.11,
  });

  const movementScore = scoreTarget({
    value: temporalMovement,
    target: 0.11,
    tolerance: 0.11,
  });

  const interactionScore = calculateInteractionScore(genome);

  const fitness =
    densityScore * 0.2 +
    contrastScore * 0.22 +
    distributionScore * 0.17 +
    continuityScore * 0.18 +
    movementScore * 0.18 +
    interactionScore * 0.05;

  return clamp(fitness, 0, 1);
}

function sampleField({ fieldParameters, animationTime }) {
  const matrix = [];
  const values = [];

  for (let row = 0; row < FITNESS_SAMPLE_ROWS; row += 1) {
    const matrixRow = [];

    for (let column = 0; column < FITNESS_SAMPLE_COLUMNS; column += 1) {
      const intensity = calculateProceduralIntensity({
        column,
        row,

        columnCount: FITNESS_SAMPLE_COLUMNS,

        rowCount: FITNESS_SAMPLE_ROWS,

        animationTime,
        fieldParameters,
      });

      matrixRow.push(intensity);
      values.push(intensity);
    }

    matrix.push(matrixRow);
  }

  return {
    matrix,
    values,
  };
}

function calculateInteractionScore(genome) {
  const pointerGenes = [
    genome.pointerRadiusRatio,
    genome.pointerDensityBoost,
    genome.pointerRippleAmplitude,
    genome.pointerRippleFrequency,
    genome.pointerRippleSpeed,
  ];

  const totalScore = pointerGenes.reduce(
    (score, geneValue) =>
      score +
      scoreTarget({
        value: geneValue,
        target: 0.5,
        tolerance: 0.5,
      }),
    0,
  );

  return pointerGenes.length > 0 ? totalScore / pointerGenes.length : 0;
}

function calculateMean(values) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return total / values.length;
}

function calculateStandardDeviation({ values, mean }) {
  if (values.length === 0) {
    return 0;
  }

  const squaredDifferences = values.reduce((sum, value) => {
    const difference = value - mean;

    return sum + difference * difference;
  }, 0);

  return Math.sqrt(squaredDifferences / values.length);
}

function calculateDenseRatio(values, threshold) {
  if (values.length === 0) {
    return 0;
  }

  const denseCellCount = values.reduce(
    (count, value) => (value >= threshold ? count + 1 : count),
    0,
  );

  return denseCellCount / values.length;
}

function calculateSpatialRoughness(matrix) {
  let differenceTotal = 0;
  let comparisonCount = 0;

  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      const currentValue = matrix[row][column];

      if (column > 0) {
        differenceTotal += Math.abs(currentValue - matrix[row][column - 1]);

        comparisonCount += 1;
      }

      if (row > 0) {
        differenceTotal += Math.abs(currentValue - matrix[row - 1][column]);

        comparisonCount += 1;
      }
    }
  }

  return comparisonCount > 0 ? differenceTotal / comparisonCount : 0;
}

function calculateTemporalMovement({ frameA, frameB }) {
  const sampleCount = Math.min(frameA.length, frameB.length);

  if (sampleCount === 0) {
    return 0;
  }

  let movementTotal = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    movementTotal += Math.abs(frameA[index] - frameB[index]);
  }

  return movementTotal / sampleCount;
}

function scoreTarget({ value, target, tolerance }) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (tolerance <= 0) {
    return value === target ? 1 : 0;
  }

  return clamp(1 - Math.abs(value - target) / tolerance, 0, 1);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
