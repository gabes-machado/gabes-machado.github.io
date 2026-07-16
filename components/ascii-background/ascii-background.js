import {
  ELITE_COUNT,
  FRAME_INTERVAL,
  GENERATION_INTERVAL_SECONDS,
  GENE_NAMES,
  GENOME_TRANSITION_SECONDS,
  MUTATION_RATE,
  MUTATION_STEP_MAX,
  MUTATION_STEP_MIN,
  POINTER_POSITION_RESPONSE,
  POINTER_STRENGTH_RESPONSE,
  POPULATION_SIZE,
  REDUCED_MOTION_QUERY,
  TOURNAMENT_SIZE,
} from "./ascii-config.js";

import { createInitialGenome, decodeGenome } from "./ascii-field.js";

import { evaluateGenome } from "./ascii-fitness.js";

import { calculateCanvasLayout, drawAsciiFrame } from "./ascii-renderer.js";

import { createGeneticEngine } from "./genetic-engine.js";

export function initializeAsciiBackground() {
  const canvas = document.querySelector("[data-ascii-background]");

  if (!(canvas instanceof HTMLCanvasElement)) {
    console.warn("ASCII background could not be initialized.");

    return;
  }

  const hero = canvas.closest(".hero");

  if (!(hero instanceof HTMLElement)) {
    console.warn("The hero element for the ASCII background was not found.");

    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    console.warn("A 2D canvas context is not available.");

    return;
  }

  const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);

  const geneticEngine = createGeneticEngine({
    geneNames: GENE_NAMES,

    initialGenome: createInitialGenome(),

    evaluateGenome,

    populationSize: POPULATION_SIZE,

    eliteCount: ELITE_COUNT,

    tournamentSize: TOURNAMENT_SIZE,

    mutationRate: MUTATION_RATE,

    mutationStepMin: MUTATION_STEP_MIN,

    mutationStepMax: MUTATION_STEP_MAX,

    generationIntervalSeconds: GENERATION_INTERVAL_SECONDS,

    transitionDurationSeconds: GENOME_TRANSITION_SECONDS,
  });

  const animationState = {
    animationFrameId: null,

    animationTime: 0,

    lastAnimationTimestamp: null,
    lastDrawTimestamp: null,

    isPageVisible: !document.hidden,

    prefersReducedMotion: motionPreference.matches,

    layout: null,

    pointer: {
      currentX: 0.5,
      currentY: 0.5,

      targetX: 0.5,
      targetY: 0.5,

      currentStrength: 0,
      targetStrength: 0,
    },
  };

  let lastReportedGeneration = -1;

  const updateLayout = () => {
    animationState.layout = calculateCanvasLayout({
      canvas,
      context,
    });
  };

  const updateGenetics = () => {
    geneticEngine.update(animationState.animationTime);

    const currentGeneration = geneticEngine.getGeneration();

    if (currentGeneration === lastReportedGeneration) {
      return;
    }

    lastReportedGeneration = currentGeneration;

    canvas.dataset.generation = String(currentGeneration);

    canvas.dataset.fitness = geneticEngine.getBestFitness().toFixed(4);
  };

  const drawCurrentFrame = () => {
    if (!animationState.layout) {
      return;
    }

    const fieldParameters = decodeGenome(geneticEngine.getCurrentGenome());

    drawAsciiFrame({
      context,

      layout: animationState.layout,

      animationTime: animationState.prefersReducedMotion
        ? 0
        : animationState.animationTime,

      pointer: animationState.pointer,

      fieldParameters,
    });
  };

  const stopAnimation = () => {
    if (animationState.animationFrameId !== null) {
      window.cancelAnimationFrame(animationState.animationFrameId);
    }

    animationState.animationFrameId = null;

    animationState.lastAnimationTimestamp = null;

    animationState.lastDrawTimestamp = null;
  };

  const animationLoop = (timestamp) => {
    animationState.animationFrameId = null;

    if (!animationState.isPageVisible || animationState.prefersReducedMotion) {
      return;
    }

    const elapsedSeconds = updateAnimationTime({
      animationState,
      timestamp,
    });

    updatePointerState({
      pointer: animationState.pointer,

      elapsedSeconds,
    });

    updateGenetics();

    if (
      shouldDrawFrame({
        animationState,
        timestamp,
      })
    ) {
      drawCurrentFrame();

      animationState.lastDrawTimestamp = timestamp;
    }

    animationState.animationFrameId =
      window.requestAnimationFrame(animationLoop);
  };

  const startAnimation = () => {
    if (!animationState.isPageVisible) {
      return;
    }

    if (animationState.prefersReducedMotion) {
      drawCurrentFrame();

      return;
    }

    if (animationState.animationFrameId !== null) {
      return;
    }

    animationState.lastAnimationTimestamp = null;

    animationState.lastDrawTimestamp = null;

    animationState.animationFrameId =
      window.requestAnimationFrame(animationLoop);
  };

  const handleLayoutChange = () => {
    updateLayout();
    drawCurrentFrame();
    startAnimation();
  };

  const handleVisibilityChange = () => {
    animationState.isPageVisible = !document.hidden;

    if (!animationState.isPageVisible) {
      stopAnimation();

      return;
    }

    startAnimation();
  };

  const handleMotionPreferenceChange = (event) => {
    animationState.prefersReducedMotion = event.matches;

    stopAnimation();

    resetPointerInfluence(animationState.pointer);

    drawCurrentFrame();

    if (!animationState.prefersReducedMotion) {
      startAnimation();
    }
  };

  const handlePointerMove = (event) => {
    if (animationState.prefersReducedMotion || !event.isPrimary) {
      return;
    }

    const heroRect = hero.getBoundingClientRect();

    if (heroRect.width <= 0 || heroRect.height <= 0) {
      return;
    }

    animationState.pointer.targetX = clamp(
      (event.clientX - heroRect.left) / heroRect.width,
      0,
      1,
    );

    animationState.pointer.targetY = clamp(
      (event.clientY - heroRect.top) / heroRect.height,
      0,
      1,
    );

    animationState.pointer.targetStrength = 1;
  };

  const handlePointerLeave = () => {
    animationState.pointer.targetStrength = 0;
  };

  const handlePointerEnd = (event) => {
    if (event.pointerType !== "mouse") {
      animationState.pointer.targetStrength = 0;
    }
  };

  const resizeObserver = new ResizeObserver(handleLayoutChange);

  resizeObserver.observe(canvas);

  window.addEventListener("resize", handleLayoutChange);

  document.addEventListener("visibilitychange", handleVisibilityChange);

  motionPreference.addEventListener("change", handleMotionPreferenceChange);

  hero.addEventListener("pointermove", handlePointerMove, {
    passive: true,
  });

  hero.addEventListener("pointerleave", handlePointerLeave);

  hero.addEventListener("pointercancel", handlePointerLeave);

  hero.addEventListener("pointerup", handlePointerEnd);

  updateLayout();
  updateGenetics();
  drawCurrentFrame();
  startAnimation();
}

function updateAnimationTime({ animationState, timestamp }) {
  if (animationState.lastAnimationTimestamp === null) {
    animationState.lastAnimationTimestamp = timestamp;

    return 0;
  }

  const elapsedMilliseconds = timestamp - animationState.lastAnimationTimestamp;

  const cappedElapsedMilliseconds = Math.min(elapsedMilliseconds, 100);

  const elapsedSeconds = cappedElapsedMilliseconds / 1000;

  animationState.animationTime += elapsedSeconds;

  animationState.lastAnimationTimestamp = timestamp;

  return elapsedSeconds;
}

function updatePointerState({ pointer, elapsedSeconds }) {
  if (elapsedSeconds <= 0) {
    return;
  }

  const positionFactor = calculateDampingFactor(
    POINTER_POSITION_RESPONSE,
    elapsedSeconds,
  );

  const strengthFactor = calculateDampingFactor(
    POINTER_STRENGTH_RESPONSE,
    elapsedSeconds,
  );

  pointer.currentX += (pointer.targetX - pointer.currentX) * positionFactor;

  pointer.currentY += (pointer.targetY - pointer.currentY) * positionFactor;

  pointer.currentStrength +=
    (pointer.targetStrength - pointer.currentStrength) * strengthFactor;
}

function calculateDampingFactor(response, elapsedSeconds) {
  return 1 - Math.exp(-response * elapsedSeconds);
}

function shouldDrawFrame({ animationState, timestamp }) {
  if (animationState.lastDrawTimestamp === null) {
    return true;
  }

  return timestamp - animationState.lastDrawTimestamp >= FRAME_INTERVAL;
}

function resetPointerInfluence(pointer) {
  pointer.currentStrength = 0;
  pointer.targetStrength = 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
