const CHARACTER_RAMP = "  ..,:;irsXA253hMHGS#9B&@";

const MAX_PIXEL_RATIO = 2;
const FONT_WEIGHT = 500;

const CELL_WIDTH_FACTOR = 1;
const CELL_HEIGHT_FACTOR = 1.15;

const LOWER_LUMINANCE_PERCENTILE = 0.05;
const UPPER_LUMINANCE_PERCENTILE = 0.95;

const MINIMUM_CONTRAST_RANGE = 0.08;
const TRANSPARENCY_THRESHOLD = 0.05;

const PORTRAIT_HOLD_MILLISECONDS = 5000;
const PORTRAIT_TRANSITION_MILLISECONDS = 2600;

const TARGET_FRAMES_PER_SECOND = 30;
const FRAME_INTERVAL = 1000 / TARGET_FRAMES_PER_SECOND;

const MAX_PARTICLE_STAGGER = 0.32;
const TARGET_ANGULAR_OFFSET = 0.16;
const MAXIMUM_ARC_CELLS = 7;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function initializeAboutPortrait() {
  const frame = document.querySelector("[data-about-portrait-frame]");

  const canvas = document.querySelector("[data-about-portrait]");

  const primaryImage = document.querySelector(
    '[data-about-portrait-source="primary"]',
  );

  const secondaryImage = document.querySelector(
    '[data-about-portrait-source="secondary"]',
  );

  const status = document.querySelector("[data-about-portrait-status]");

  if (
    !(frame instanceof HTMLElement) ||
    !(canvas instanceof HTMLCanvasElement) ||
    !(primaryImage instanceof HTMLImageElement) ||
    !(secondaryImage instanceof HTMLImageElement) ||
    !(status instanceof HTMLElement)
  ) {
    console.warn("About portrait could not be initialized.");

    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    setPortraitError({
      frame,
      status,
      message: "CANVAS ERROR",
    });

    return;
  }

  const samplingCanvas = document.createElement("canvas");

  const samplingContext = samplingCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!samplingContext) {
    setPortraitError({
      frame,
      status,
      message: "SAMPLER ERROR",
    });

    return;
  }

  const sourceImages = [primaryImage, secondaryImage];

  const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);

  const state = {
    isReady: false,
    isPageVisible: !document.hidden,

    prefersReducedMotion: motionPreference.matches,

    models: [],
    layout: null,

    currentModelIndex: 0,
    targetModelIndex: null,

    transitionParticles: null,
    transitionStartedAt: null,

    animationFrameId: null,
    holdTimeoutId: null,
    rebuildFrameId: null,

    lastDrawTimestamp: null,
  };

  const cancelCycle = () => {
    if (state.holdTimeoutId !== null) {
      window.clearTimeout(state.holdTimeoutId);

      state.holdTimeoutId = null;
    }

    if (state.animationFrameId !== null) {
      window.cancelAnimationFrame(state.animationFrameId);

      state.animationFrameId = null;
    }

    state.transitionParticles = null;
    state.transitionStartedAt = null;
    state.targetModelIndex = null;
    state.lastDrawTimestamp = null;
  };

  const updateStatus = () => {
    const portraitNumber = state.currentModelIndex + 1;

    const totalPortraits = state.models.length;

    if (state.prefersReducedMotion) {
      status.textContent = `STATIC ${formatNumber(
        portraitNumber,
      )} / ${formatNumber(totalPortraits)}`;

      return;
    }

    status.textContent = `PORTRAIT ${formatNumber(
      portraitNumber,
    )} / ${formatNumber(totalPortraits)}`;
  };

  const renderCurrentModel = () => {
    const currentModel = state.models[state.currentModelIndex];

    if (!currentModel || !state.layout) {
      return;
    }

    renderPortraitModel({
      context,
      portraitModel: currentModel,
      layout: state.layout,
    });

    frame.dataset.portraitState = "ready";

    canvas.dataset.portraitIndex = String(state.currentModelIndex + 1);

    updateStatus();
  };

  const scheduleNextTransition = () => {
    if (
      !state.isReady ||
      !state.isPageVisible ||
      state.prefersReducedMotion ||
      state.models.length < 2
    ) {
      return;
    }

    state.holdTimeoutId = window.setTimeout(
      startTransition,
      PORTRAIT_HOLD_MILLISECONDS,
    );
  };

  const finishTransition = () => {
    if (state.targetModelIndex === null) {
      return;
    }

    state.currentModelIndex = state.targetModelIndex;

    state.targetModelIndex = null;
    state.transitionParticles = null;
    state.transitionStartedAt = null;
    state.lastDrawTimestamp = null;

    renderCurrentModel();
    scheduleNextTransition();
  };

  const animateTransition = (timestamp) => {
    state.animationFrameId = null;

    if (!state.isPageVisible || state.prefersReducedMotion) {
      cancelCycle();
      renderCurrentModel();

      return;
    }

    if (state.transitionStartedAt === null) {
      state.transitionStartedAt = timestamp;
    }

    const elapsedMilliseconds = timestamp - state.transitionStartedAt;

    const progress = clamp(
      elapsedMilliseconds / PORTRAIT_TRANSITION_MILLISECONDS,
      0,
      1,
    );

    const shouldDraw =
      state.lastDrawTimestamp === null ||
      timestamp - state.lastDrawTimestamp >= FRAME_INTERVAL ||
      progress >= 1;

    if (shouldDraw && state.transitionParticles && state.layout) {
      renderTransitionFrame({
        context,
        particles: state.transitionParticles,
        layout: state.layout,
        progress,
      });

      state.lastDrawTimestamp = timestamp;
    }

    if (progress >= 1) {
      finishTransition();

      return;
    }

    state.animationFrameId = window.requestAnimationFrame(animateTransition);
  };

  function startTransition() {
    state.holdTimeoutId = null;

    if (
      !state.isReady ||
      !state.isPageVisible ||
      state.prefersReducedMotion ||
      state.models.length < 2 ||
      !state.layout
    ) {
      return;
    }

    const nextModelIndex = (state.currentModelIndex + 1) % state.models.length;

    const sourceModel = state.models[state.currentModelIndex];

    const targetModel = state.models[nextModelIndex];

    state.targetModelIndex = nextModelIndex;

    state.transitionParticles = createTransitionParticles({
      sourceModel,
      targetModel,
    });

    state.transitionStartedAt = null;
    state.lastDrawTimestamp = null;

    frame.dataset.portraitState = "transitioning";

    status.textContent = `MORPHING ${formatNumber(
      state.currentModelIndex + 1,
    )} → ${formatNumber(nextModelIndex + 1)}`;

    state.animationFrameId = window.requestAnimationFrame(animateTransition);
  }

  const rebuildPortraits = () => {
    cancelCycle();

    try {
      const portraitScene = createPortraitScene({
        canvas,
        context,
        sourceImages,
        samplingCanvas,
        samplingContext,
      });

      state.layout = portraitScene.layout;

      state.models = portraitScene.models;

      state.currentModelIndex = Math.min(
        state.currentModelIndex,
        state.models.length - 1,
      );

      state.isReady = true;

      canvas.dataset.columns = String(state.layout.grid.columnCount);

      canvas.dataset.rows = String(state.layout.grid.rowCount);

      canvas.dataset.portraitCount = String(state.models.length);

      renderCurrentModel();
      scheduleNextTransition();
    } catch (error) {
      console.error("The ASCII portraits could not be rendered.", error);

      setPortraitError({
        frame,
        status,
        message: "RENDER ERROR",
      });
    }
  };

  const scheduleRebuild = () => {
    if (!state.isReady || state.rebuildFrameId !== null) {
      return;
    }

    state.rebuildFrameId = window.requestAnimationFrame(() => {
      state.rebuildFrameId = null;

      rebuildPortraits();
    });
  };

  const handleVisibilityChange = () => {
    state.isPageVisible = !document.hidden;

    cancelCycle();

    if (state.isPageVisible && state.isReady) {
      renderCurrentModel();
      scheduleNextTransition();
    }
  };

  const handleMotionPreferenceChange = (event) => {
    state.prefersReducedMotion = event.matches;

    cancelCycle();

    if (!state.isReady) {
      return;
    }

    renderCurrentModel();
    scheduleNextTransition();
  };

  const resizeObserver = new ResizeObserver(scheduleRebuild);

  resizeObserver.observe(frame);

  document.addEventListener("visibilitychange", handleVisibilityChange);

  motionPreference.addEventListener("change", handleMotionPreferenceChange);

  frame.dataset.portraitState = "loading";

  status.textContent = "DECODING 01 / 02";

  Promise.all(sourceImages.map(prepareImage))
    .then(() => {
      status.textContent = "PROCESSING";

      rebuildPortraits();
    })
    .catch((error) => {
      console.error("The portrait source images could not be loaded.", error);

      setPortraitError({
        frame,
        status,
        message: "SOURCE ERROR",
      });
    });
}

async function prepareImage(image) {
  if (image.complete && image.naturalWidth === 0) {
    throw new Error(
      `Image could not be loaded: ${image.currentSrc || image.src}`,
    );
  }

  if (typeof image.decode === "function") {
    try {
      await image.decode();
    } catch (error) {
      if (!image.complete || image.naturalWidth === 0) {
        throw error;
      }
    }
  } else {
    await waitForImageLoad(image);
  }

  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("A source image has invalid dimensions.");
  }
}

function waitForImageLoad(image) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, {
      once: true,
    });

    image.addEventListener(
      "error",
      () => {
        reject(new Error("A source image failed to load."));
      },
      {
        once: true,
      },
    );
  });
}

function createPortraitScene({
  canvas,
  context,
  sourceImages,
  samplingCanvas,
  samplingContext,
}) {
  const canvasRect = canvas.getBoundingClientRect();

  const width = canvasRect.width;
  const height = canvasRect.height;

  if (width <= 0 || height <= 0) {
    throw new Error("The portrait canvas has no visible dimensions.");
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  configureCanvasResolution({
    canvas,
    context,
    width,
    height,
    pixelRatio,
  });

  const drawingConfiguration = configureDrawingContext({
    canvas,
    context,
  });

  const grid = calculateGrid({
    width,
    height,

    fontSize: drawingConfiguration.fontSize,

    context,
  });

  grid.offsetX = (width - grid.columnCount * grid.cellWidth) / 2;

  grid.offsetY = (height - grid.rowCount * grid.cellHeight) / 2;

  const invert = canvas.dataset.invert === "true";

  const models = sourceImages.map((sourceImage) => {
    const imageData = sampleImage({
      sourceImage,
      samplingCanvas,
      samplingContext,

      columnCount: grid.columnCount,

      rowCount: grid.rowCount,

      targetAspectRatio: width / height,

      focus: readImageFocus(sourceImage),
    });

    return createPortraitModel({
      imageData,

      columnCount: grid.columnCount,

      rowCount: grid.rowCount,

      invert,
    });
  });

  return {
    layout: {
      width,
      height,
      grid,
    },

    models,
  };
}

function configureCanvasResolution({
  canvas,
  context,
  width,
  height,
  pixelRatio,
}) {
  const bufferWidth = Math.max(1, Math.round(width * pixelRatio));

  const bufferHeight = Math.max(1, Math.round(height * pixelRatio));

  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function configureDrawingContext({ canvas, context }) {
  const computedStyles = window.getComputedStyle(canvas);

  const parsedFontSize = Number.parseFloat(computedStyles.fontSize);

  const fontSize = Number.isFinite(parsedFontSize) ? parsedFontSize : 10;

  context.font = `${FONT_WEIGHT} ${fontSize}px ` + computedStyles.fontFamily;

  context.fillStyle = computedStyles.color;

  context.textAlign = "center";
  context.textBaseline = "middle";

  return {
    fontSize,
  };
}

function calculateGrid({ width, height, fontSize, context }) {
  const characterMetrics = context.measureText("M");

  const cellWidth = Math.max(characterMetrics.width * CELL_WIDTH_FACTOR, 1);

  const cellHeight = Math.max(fontSize * CELL_HEIGHT_FACTOR, 1);

  return {
    cellWidth,
    cellHeight,

    columnCount: Math.max(1, Math.floor(width / cellWidth)),

    rowCount: Math.max(1, Math.floor(height / cellHeight)),

    offsetX: 0,
    offsetY: 0,
  };
}

function readImageFocus(image) {
  const parsedFocusX = Number.parseFloat(image.dataset.focusX);

  const parsedFocusY = Number.parseFloat(image.dataset.focusY);

  return {
    x: Number.isFinite(parsedFocusX) ? clamp(parsedFocusX, 0, 1) : 0.5,

    y: Number.isFinite(parsedFocusY) ? clamp(parsedFocusY, 0, 1) : 0.5,
  };
}

function sampleImage({
  sourceImage,
  samplingCanvas,
  samplingContext,
  columnCount,
  rowCount,
  targetAspectRatio,
  focus,
}) {
  samplingCanvas.width = columnCount;

  samplingCanvas.height = rowCount;

  samplingContext.clearRect(0, 0, columnCount, rowCount);

  const crop = calculateCoverCrop({
    sourceWidth: sourceImage.naturalWidth,

    sourceHeight: sourceImage.naturalHeight,

    targetAspectRatio,
    focus,
  });

  samplingContext.drawImage(
    sourceImage,

    crop.x,
    crop.y,
    crop.width,
    crop.height,

    0,
    0,
    columnCount,
    rowCount,
  );

  return samplingContext.getImageData(0, 0, columnCount, rowCount);
}

function calculateCoverCrop({
  sourceWidth,
  sourceHeight,
  targetAspectRatio,
  focus,
}) {
  const sourceAspectRatio = sourceWidth / sourceHeight;

  if (sourceAspectRatio > targetAspectRatio) {
    const cropHeight = sourceHeight;

    const cropWidth = cropHeight * targetAspectRatio;

    return {
      x: (sourceWidth - cropWidth) * focus.x,

      y: 0,

      width: cropWidth,
      height: cropHeight,
    };
  }

  const cropWidth = sourceWidth;

  const cropHeight = cropWidth / targetAspectRatio;

  return {
    x: 0,

    y: (sourceHeight - cropHeight) * focus.y,

    width: cropWidth,
    height: cropHeight,
  };
}

function createPortraitModel({ imageData, columnCount, rowCount, invert }) {
  const rawSamples = createRawSamples(imageData);

  const luminanceBounds = calculateLuminanceBounds(rawSamples);

  const cells = rawSamples.map((sample, index) => {
    const column = index % columnCount;

    const row = Math.floor(index / columnCount);

    if (sample.alpha < TRANSPARENCY_THRESHOLD) {
      return createEmptyCell({
        index,
        column,
        row,
      });
    }

    const normalizedLuminance = normalizeLuminance({
      luminance: sample.luminance,

      minimum: luminanceBounds.minimum,

      maximum: luminanceBounds.maximum,
    });

    const intensity = invert ? 1 - normalizedLuminance : normalizedLuminance;

    const adjustedIntensity = Math.pow(clamp(intensity, 0, 1), 0.9);

    const characterIndex = Math.floor(
      adjustedIntensity * (CHARACTER_RAMP.length - 1),
    );

    return {
      index,
      column,
      row,

      character: CHARACTER_RAMP[characterIndex],

      intensity: adjustedIntensity,

      opacity: sample.alpha * (0.12 + adjustedIntensity * 0.88),
    };
  });

  return {
    columnCount,
    rowCount,
    cells,
  };
}

function createEmptyCell({ index, column, row }) {
  return {
    index,
    column,
    row,
    character: " ",
    intensity: 0,
    opacity: 0,
  };
}

function createRawSamples(imageData) {
  const samples = [];

  for (let index = 0; index < imageData.data.length; index += 4) {
    const red = imageData.data[index];

    const green = imageData.data[index + 1];

    const blue = imageData.data[index + 2];

    const alpha = imageData.data[index + 3] / 255;

    const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;

    samples.push({
      luminance,
      alpha,
    });
  }

  return samples;
}

function calculateLuminanceBounds(samples) {
  const luminanceValues = samples
    .filter((sample) => sample.alpha >= TRANSPARENCY_THRESHOLD)
    .map((sample) => sample.luminance)
    .sort((valueA, valueB) => valueA - valueB);

  if (luminanceValues.length === 0) {
    return {
      minimum: 0,
      maximum: 1,
    };
  }

  const lowerIndex = Math.floor(
    (luminanceValues.length - 1) * LOWER_LUMINANCE_PERCENTILE,
  );

  const upperIndex = Math.floor(
    (luminanceValues.length - 1) * UPPER_LUMINANCE_PERCENTILE,
  );

  const minimum = luminanceValues[lowerIndex];

  const maximum = luminanceValues[upperIndex];

  if (maximum - minimum < MINIMUM_CONTRAST_RANGE) {
    return {
      minimum: 0,
      maximum: 1,
    };
  }

  return {
    minimum,
    maximum,
  };
}

function normalizeLuminance({ luminance, minimum, maximum }) {
  const range = maximum - minimum;

  if (range <= 0) {
    return luminance;
  }

  return clamp((luminance - minimum) / range, 0, 1);
}

function createTransitionParticles({ sourceModel, targetModel }) {
  const sourceCells = sortCellsForMorph({
    cells: sourceModel.cells,

    columnCount: sourceModel.columnCount,

    rowCount: sourceModel.rowCount,

    angularOffset: 0,
  });

  const targetCells = sortCellsForMorph({
    cells: targetModel.cells,

    columnCount: targetModel.columnCount,

    rowCount: targetModel.rowCount,

    angularOffset: TARGET_ANGULAR_OFFSET,
  });

  return sourceCells.map((sourceCell, index) => {
    const delayNoise = createDeterministicNoise(index, 17);

    const directionNoise = createDeterministicNoise(index, 53);

    return {
      sourceCell,

      targetCell: targetCells[index],

      delay: delayNoise * MAX_PARTICLE_STAGGER,

      curveDirection: directionNoise < 0.5 ? -1 : 1,
    };
  });
}

function sortCellsForMorph({ cells, columnCount, rowCount, angularOffset }) {
  return [...cells].sort((cellA, cellB) => {
    const keyA = calculateMorphKey({
      cell: cellA,
      columnCount,
      rowCount,
      angularOffset,
    });

    const keyB = calculateMorphKey({
      cell: cellB,
      columnCount,
      rowCount,
      angularOffset,
    });

    if (keyA !== keyB) {
      return keyA - keyB;
    }

    return cellA.index - cellB.index;
  });
}

function calculateMorphKey({ cell, columnCount, rowCount, angularOffset }) {
  const normalizedX = cell.column / Math.max(columnCount - 1, 1);

  const normalizedY = cell.row / Math.max(rowCount - 1, 1);

  const deltaX = normalizedX - 0.5;

  const deltaY = normalizedY - 0.5;

  const radius = Math.hypot(deltaX, deltaY);

  const rawAngle = (Math.atan2(deltaY, deltaX) + Math.PI) / (Math.PI * 2);

  const angle = (rawAngle + angularOffset) % 1;

  const isVisible = cell.character !== " " && cell.opacity > 0.01;

  const intensityBand = isVisible ? 1 + Math.round(cell.intensity * 10) : 0;

  return intensityBand * 1000 + radius * 100 + angle * 10;
}

function renderPortraitModel({ context, portraitModel, layout }) {
  context.clearRect(0, 0, layout.width, layout.height);

  for (const cell of portraitModel.cells) {
    if (cell.character === " " || cell.opacity <= 0) {
      continue;
    }

    const point = getCellPoint({
      cell,
      grid: layout.grid,
    });

    context.globalAlpha = cell.opacity;

    context.fillText(cell.character, point.x, point.y);
  }

  context.globalAlpha = 1;
}

function renderTransitionFrame({ context, particles, layout, progress }) {
  context.clearRect(0, 0, layout.width, layout.height);

  for (const particle of particles) {
    const localProgress = calculateLocalProgress({
      progress,
      delay: particle.delay,
    });

    const easedProgress = smootherstep(localProgress);

    const sourcePoint = getCellPoint({
      cell: particle.sourceCell,

      grid: layout.grid,
    });

    const targetPoint = getCellPoint({
      cell: particle.targetCell,

      grid: layout.grid,
    });

    const sourceOpacity = getRenderableOpacity(particle.sourceCell);

    const targetOpacity = getRenderableOpacity(particle.targetCell);

    const opacity = interpolate(sourceOpacity, targetOpacity, easedProgress);

    if (opacity <= 0.01) {
      continue;
    }

    const position = calculateCurvedPosition({
      sourcePoint,
      targetPoint,
      progress: easedProgress,

      curveDirection: particle.curveDirection,

      grid: layout.grid,
    });

    const intensity = interpolate(
      particle.sourceCell.intensity,

      particle.targetCell.intensity,

      easedProgress,
    );

    const characterIndex = Math.floor(
      clamp(intensity, 0, 1) * (CHARACTER_RAMP.length - 1),
    );

    const character = CHARACTER_RAMP[characterIndex];

    if (character === " ") {
      continue;
    }

    context.globalAlpha = clamp(opacity, 0, 1);

    context.fillText(character, position.x, position.y);
  }

  context.globalAlpha = 1;
}

function calculateLocalProgress({ progress, delay }) {
  if (progress <= delay) {
    return 0;
  }

  return clamp((progress - delay) / (1 - delay), 0, 1);
}

function calculateCurvedPosition({
  sourcePoint,
  targetPoint,
  progress,
  curveDirection,
  grid,
}) {
  const deltaX = targetPoint.x - sourcePoint.x;

  const deltaY = targetPoint.y - sourcePoint.y;

  const distance = Math.hypot(deltaX, deltaY);

  const linearX = interpolate(sourcePoint.x, targetPoint.x, progress);

  const linearY = interpolate(sourcePoint.y, targetPoint.y, progress);

  if (distance <= 0) {
    return {
      x: linearX,
      y: linearY,
    };
  }

  const perpendicularX = -deltaY / distance;

  const perpendicularY = deltaX / distance;

  const maximumArc =
    Math.max(grid.cellWidth, grid.cellHeight) * MAXIMUM_ARC_CELLS;

  const arcMagnitude =
    Math.min(distance * 0.28, maximumArc) *
    Math.sin(Math.PI * progress) *
    curveDirection;

  return {
    x: linearX + perpendicularX * arcMagnitude,

    y: linearY + perpendicularY * arcMagnitude,
  };
}

function getCellPoint({ cell, grid }) {
  return {
    x: grid.offsetX + cell.column * grid.cellWidth + grid.cellWidth / 2,

    y: grid.offsetY + cell.row * grid.cellHeight + grid.cellHeight / 2,
  };
}

function getRenderableOpacity(cell) {
  if (cell.character === " ") {
    return 0;
  }

  return cell.opacity;
}

function createDeterministicNoise(firstValue, secondValue) {
  const value =
    Math.sin(firstValue * 12.9898 + secondValue * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

function smootherstep(value) {
  const normalizedValue = clamp(value, 0, 1);

  return (
    normalizedValue *
    normalizedValue *
    normalizedValue *
    (normalizedValue * (normalizedValue * 6 - 15) + 10)
  );
}

function interpolate(start, end, progress) {
  return start + (end - start) * progress;
}

function formatNumber(value) {
  return String(value).padStart(2, "0");
}

function setPortraitError({ frame, status, message }) {
  frame.dataset.portraitState = "error";

  status.textContent = message;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
