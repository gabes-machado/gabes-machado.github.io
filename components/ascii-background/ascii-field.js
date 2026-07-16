import { GENE_NAMES, GENE_RANGES } from "./ascii-config.js";

const DEFAULT_GENE_VALUE = 0.5;

export function createInitialGenome() {
  const genome = {};

  for (const geneName of GENE_NAMES) {
    genome[geneName] = DEFAULT_GENE_VALUE;
  }

  return genome;
}

export function decodeGenome(genome) {
  const parameters = {};

  for (const [geneName, [minimum, maximum]] of Object.entries(GENE_RANGES)) {
    const geneValue = readGeneValue(genome, geneName);

    parameters[geneName] = interpolate(minimum, maximum, geneValue);
  }

  normalizeWaveWeights(parameters);

  return parameters;
}

export function calculateProceduralIntensity({
  column,
  row,
  columnCount,
  rowCount,
  animationTime,
  fieldParameters,
}) {
  const horizontalWave = Math.sin(
    column * fieldParameters.horizontalFrequency +
      animationTime * fieldParameters.horizontalSpeed,
  );

  const verticalWave = Math.cos(
    row * fieldParameters.verticalFrequency -
      animationTime * fieldParameters.verticalSpeed,
  );

  const diagonalWave = Math.sin(
    (column + row) * fieldParameters.diagonalFrequency +
      animationTime * fieldParameters.diagonalSpeed,
  );

  const normalizedColumn = column / Math.max(columnCount - 1, 1);

  const normalizedRow = row / Math.max(rowCount - 1, 1);

  const distanceFromCenter = Math.hypot(
    normalizedColumn - 0.5,
    normalizedRow - 0.5,
  );

  const radialWave = Math.sin(
    distanceFromCenter * fieldParameters.radialFrequency -
      animationTime * fieldParameters.radialSpeed,
  );

  const combinedWave =
    horizontalWave * fieldParameters.horizontalWeight +
    verticalWave * fieldParameters.verticalWeight +
    diagonalWave * fieldParameters.diagonalWeight +
    radialWave * fieldParameters.radialWeight;

  const normalizedWave = (combinedWave + 1) / 2;

  const noise = createCoordinateNoise(column, row);

  return clamp(
    normalizedWave * (1 - fieldParameters.noiseWeight) +
      noise * fieldParameters.noiseWeight +
      fieldParameters.densityBias,
    0,
    1,
  );
}

function readGeneValue(genome, geneName) {
  const value = genome?.[geneName];

  if (!Number.isFinite(value)) {
    return DEFAULT_GENE_VALUE;
  }

  return clamp(value, 0, 1);
}

function normalizeWaveWeights(parameters) {
  const totalWeight =
    parameters.horizontalWeight +
    parameters.verticalWeight +
    parameters.diagonalWeight +
    parameters.radialWeight;

  if (totalWeight <= 0) {
    parameters.horizontalWeight = 0.25;
    parameters.verticalWeight = 0.25;
    parameters.diagonalWeight = 0.25;
    parameters.radialWeight = 0.25;

    return;
  }

  parameters.horizontalWeight /= totalWeight;

  parameters.verticalWeight /= totalWeight;

  parameters.diagonalWeight /= totalWeight;

  parameters.radialWeight /= totalWeight;
}

function createCoordinateNoise(column, row) {
  const value = Math.sin(column * 12.9898 + row * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

function interpolate(start, end, progress) {
  return start + (end - start) * progress;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
