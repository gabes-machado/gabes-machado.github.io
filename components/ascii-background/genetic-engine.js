const DEFAULT_POPULATION_SIZE = 14;
const DEFAULT_ELITE_COUNT = 2;
const DEFAULT_TOURNAMENT_SIZE = 3;

const DEFAULT_MUTATION_RATE = 0.24;
const DEFAULT_MUTATION_STEP_MIN = 0.03;
const DEFAULT_MUTATION_STEP_MAX = 0.16;

const DEFAULT_GENERATION_INTERVAL_SECONDS = 9;
const DEFAULT_TRANSITION_DURATION_SECONDS = 4.5;

const INITIAL_POPULATION_SPREAD = 0.4;

export function createGeneticEngine({
  geneNames,
  initialGenome,
  evaluateGenome,

  populationSize = DEFAULT_POPULATION_SIZE,
  eliteCount = DEFAULT_ELITE_COUNT,
  tournamentSize = DEFAULT_TOURNAMENT_SIZE,

  mutationRate = DEFAULT_MUTATION_RATE,
  mutationStepMin = DEFAULT_MUTATION_STEP_MIN,
  mutationStepMax = DEFAULT_MUTATION_STEP_MAX,

  generationIntervalSeconds = DEFAULT_GENERATION_INTERVAL_SECONDS,

  transitionDurationSeconds = DEFAULT_TRANSITION_DURATION_SECONDS,
}) {
  validateConfiguration({
    geneNames,
    initialGenome,
    evaluateGenome,
    populationSize,
    eliteCount,
    tournamentSize,
  });

  let rankedPopulation = rankPopulation({
    population: createInitialPopulation({
      geneNames,
      initialGenome,
      populationSize,
    }),
    evaluateGenome,
  });

  const state = {
    generation: 0,

    currentGenome: cloneGenome(initialGenome),

    transitionStartGenome: cloneGenome(initialGenome),

    targetGenome: cloneGenome(initialGenome),

    bestFitness: rankedPopulation[0]?.fitness ?? 0,

    isTransitioning: false,
    transitionStartedAt: 0,

    nextGenerationAt: generationIntervalSeconds,
  };

  function update(animationTime) {
    if (animationTime >= state.nextGenerationAt) {
      rankedPopulation = evolvePopulation({
        rankedPopulation,
        geneNames,
        evaluateGenome,

        populationSize,
        eliteCount,
        tournamentSize,

        mutationRate,
        mutationStepMin,
        mutationStepMax,
      });

      const bestIndividual = rankedPopulation[0];

      state.transitionStartGenome = cloneGenome(state.currentGenome);

      state.targetGenome = cloneGenome(bestIndividual.genome);

      state.bestFitness = bestIndividual.fitness;

      state.transitionStartedAt = animationTime;

      state.nextGenerationAt = animationTime + generationIntervalSeconds;

      state.generation += 1;
      state.isTransitioning = true;
    }

    updateGenomeTransition({
      state,
      geneNames,
      animationTime,
      transitionDurationSeconds,
    });

    return state.currentGenome;
  }

  function getCurrentGenome() {
    return state.currentGenome;
  }

  function getGeneration() {
    return state.generation;
  }

  function getBestFitness() {
    return state.bestFitness;
  }

  return {
    update,
    getCurrentGenome,
    getGeneration,
    getBestFitness,
  };
}

function createInitialPopulation({ geneNames, initialGenome, populationSize }) {
  const population = [cloneGenome(initialGenome)];

  while (population.length < populationSize) {
    population.push(
      randomizeGenome({
        genome: initialGenome,
        geneNames,
        spread: INITIAL_POPULATION_SPREAD,
      }),
    );
  }

  return population;
}

function evolvePopulation({
  rankedPopulation,
  geneNames,
  evaluateGenome,

  populationSize,
  eliteCount,
  tournamentSize,

  mutationRate,
  mutationStepMin,
  mutationStepMax,
}) {
  const nextPopulation = [];

  const actualEliteCount = Math.min(
    eliteCount,
    populationSize,
    rankedPopulation.length,
  );

  for (let index = 0; index < actualEliteCount; index += 1) {
    nextPopulation.push(cloneGenome(rankedPopulation[index].genome));
  }

  while (nextPopulation.length < populationSize) {
    const parentA = selectByTournament({
      rankedPopulation,
      tournamentSize,
    });

    const parentB = selectByTournament({
      rankedPopulation,
      tournamentSize,
    });

    const childGenome = crossoverGenomes({
      parentA: parentA.genome,
      parentB: parentB.genome,
      geneNames,
    });

    const mutatedChild = mutateGenome({
      genome: childGenome,
      geneNames,
      mutationRate,
      mutationStepMin,
      mutationStepMax,
    });

    nextPopulation.push(mutatedChild);
  }

  return rankPopulation({
    population: nextPopulation,
    evaluateGenome,
  });
}

function rankPopulation({ population, evaluateGenome }) {
  return population
    .map((genome) => {
      const fitness = evaluateGenome(genome);

      return {
        genome,
        fitness: Number.isFinite(fitness) ? fitness : 0,
      };
    })
    .sort(
      (individualA, individualB) => individualB.fitness - individualA.fitness,
    );
}

function selectByTournament({ rankedPopulation, tournamentSize }) {
  let selectedIndividual = null;

  for (let round = 0; round < tournamentSize; round += 1) {
    const randomIndex = Math.floor(Math.random() * rankedPopulation.length);

    const candidate = rankedPopulation[randomIndex];

    if (
      selectedIndividual === null ||
      candidate.fitness > selectedIndividual.fitness
    ) {
      selectedIndividual = candidate;
    }
  }

  return selectedIndividual ?? rankedPopulation[0];
}

function crossoverGenomes({ parentA, parentB, geneNames }) {
  const childGenome = {};

  for (const geneName of geneNames) {
    /*
     * Cruzamento aritmético:
     *
     * o gene do filho fica em algum ponto
     * entre os genes dos dois pais.
     */
    const blendFactor = Math.random();

    childGenome[geneName] = interpolate(
      parentA[geneName],
      parentB[geneName],
      blendFactor,
    );
  }

  return childGenome;
}

function mutateGenome({
  genome,
  geneNames,
  mutationRate,
  mutationStepMin,
  mutationStepMax,
}) {
  const mutatedGenome = cloneGenome(genome);

  let mutationCount = 0;

  for (const geneName of geneNames) {
    if (Math.random() >= mutationRate) {
      continue;
    }

    mutatedGenome[geneName] = mutateGene({
      geneValue: mutatedGenome[geneName],

      mutationStepMin,
      mutationStepMax,
    });

    mutationCount += 1;
  }

  /*
   * Garante pelo menos uma mutação para
   * manter diversidade genética.
   */
  if (mutationCount === 0 && geneNames.length > 0) {
    const randomGeneIndex = Math.floor(Math.random() * geneNames.length);

    const randomGeneName = geneNames[randomGeneIndex];

    mutatedGenome[randomGeneName] = mutateGene({
      geneValue: mutatedGenome[randomGeneName],

      mutationStepMin,
      mutationStepMax,
    });
  }

  return mutatedGenome;
}

function mutateGene({ geneValue, mutationStepMin, mutationStepMax }) {
  const magnitude = interpolate(
    mutationStepMin,
    mutationStepMax,
    Math.random(),
  );

  const direction = Math.random() < 0.5 ? -1 : 1;

  const mutationDelta = magnitude * direction;

  const mutatedValue = clamp(geneValue + mutationDelta, 0, 1);

  if (mutatedValue !== geneValue) {
    return mutatedValue;
  }

  return clamp(geneValue - mutationDelta, 0, 1);
}

function randomizeGenome({ genome, geneNames, spread }) {
  const randomizedGenome = {};

  for (const geneName of geneNames) {
    const randomOffset = (Math.random() * 2 - 1) * spread;

    randomizedGenome[geneName] = clamp(genome[geneName] + randomOffset, 0, 1);
  }

  return randomizedGenome;
}

function updateGenomeTransition({
  state,
  geneNames,
  animationTime,
  transitionDurationSeconds,
}) {
  if (!state.isTransitioning) {
    return;
  }

  const transitionProgress = clamp(
    (animationTime - state.transitionStartedAt) / transitionDurationSeconds,
    0,
    1,
  );

  const easedProgress = smoothstep(transitionProgress);

  state.currentGenome = interpolateGenomes({
    startGenome: state.transitionStartGenome,

    targetGenome: state.targetGenome,

    geneNames,
    progress: easedProgress,
  });

  if (transitionProgress >= 1) {
    state.currentGenome = cloneGenome(state.targetGenome);

    state.isTransitioning = false;
  }
}

function interpolateGenomes({
  startGenome,
  targetGenome,
  geneNames,
  progress,
}) {
  const interpolatedGenome = {};

  for (const geneName of geneNames) {
    interpolatedGenome[geneName] = interpolate(
      startGenome[geneName],
      targetGenome[geneName],
      progress,
    );
  }

  return interpolatedGenome;
}

function cloneGenome(genome) {
  return { ...genome };
}

function validateConfiguration({
  geneNames,
  initialGenome,
  evaluateGenome,
  populationSize,
  eliteCount,
  tournamentSize,
}) {
  if (!Array.isArray(geneNames)) {
    throw new TypeError("geneNames must be an array.");
  }

  if (typeof initialGenome !== "object" || initialGenome === null) {
    throw new TypeError("initialGenome must be an object.");
  }

  if (typeof evaluateGenome !== "function") {
    throw new TypeError("evaluateGenome must be a function.");
  }

  if (!Number.isInteger(populationSize) || populationSize < 2) {
    throw new RangeError("populationSize must be at least 2.");
  }

  if (
    !Number.isInteger(eliteCount) ||
    eliteCount < 0 ||
    eliteCount >= populationSize
  ) {
    throw new RangeError("eliteCount must be smaller than populationSize.");
  }

  if (!Number.isInteger(tournamentSize) || tournamentSize < 1) {
    throw new RangeError("tournamentSize must be at least 1.");
  }
}

function smoothstep(value) {
  const normalizedValue = clamp(value, 0, 1);

  return normalizedValue * normalizedValue * (3 - 2 * normalizedValue);
}

function interpolate(start, end, progress) {
  return start + (end - start) * progress;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
