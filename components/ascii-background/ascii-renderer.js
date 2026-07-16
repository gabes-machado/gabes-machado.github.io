import {
  CELL_HEIGHT_FACTOR,
  CELL_WIDTH_FACTOR,
  CHARACTER_RAMP,
  FONT_WEIGHT,
  MAX_PIXEL_RATIO,
} from "./ascii-config.js";

import { calculateProceduralIntensity } from "./ascii-field.js";

export function calculateCanvasLayout({ canvas, context }) {
  const canvasRect = canvas.getBoundingClientRect();

  const cssWidth = canvasRect.width;
  const cssHeight = canvasRect.height;

  if (cssWidth <= 0 || cssHeight <= 0) {
    return null;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  const bufferWidth = Math.max(1, Math.round(cssWidth * pixelRatio));

  const bufferHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const computedStyles = window.getComputedStyle(canvas);

  const parsedFontSize = Number.parseFloat(computedStyles.fontSize);

  const fontSize = Number.isFinite(parsedFontSize) ? parsedFontSize : 12;

  context.font = `${FONT_WEIGHT} ${fontSize}px ` + computedStyles.fontFamily;

  context.fillStyle = computedStyles.color;

  context.textBaseline = "top";
  context.textAlign = "left";

  const measuredCharacter = context.measureText("M");

  const cellWidth = Math.max(measuredCharacter.width * CELL_WIDTH_FACTOR, 1);

  const cellHeight = Math.max(fontSize * CELL_HEIGHT_FACTOR, 1);

  return {
    width: cssWidth,
    height: cssHeight,

    cellWidth,
    cellHeight,

    columnCount: Math.ceil(cssWidth / cellWidth) + 1,

    rowCount: Math.ceil(cssHeight / cellHeight) + 1,
  };
}

export function drawAsciiFrame({
  context,
  layout,
  animationTime,
  pointer,
  fieldParameters,
}) {
  context.clearRect(0, 0, layout.width, layout.height);

  for (let row = 0; row < layout.rowCount; row += 1) {
    for (let column = 0; column < layout.columnCount; column += 1) {
      const sample = createCellSample({
        column,
        row,

        columnCount: layout.columnCount,

        rowCount: layout.rowCount,

        width: layout.width,
        height: layout.height,

        animationTime,
        pointer,
        fieldParameters,
      });

      if (sample.character === " ") {
        continue;
      }

      context.globalAlpha = sample.opacity;

      context.fillText(
        sample.character,
        column * layout.cellWidth,
        row * layout.cellHeight,
      );
    }
  }

  context.globalAlpha = 1;
}

function createCellSample({
  column,
  row,
  columnCount,
  rowCount,
  width,
  height,
  animationTime,
  pointer,
  fieldParameters,
}) {
  const proceduralIntensity = calculateProceduralIntensity({
    column,
    row,
    columnCount,
    rowCount,
    animationTime,
    fieldParameters,
  });

  const normalizedColumn = column / Math.max(columnCount - 1, 1);

  const normalizedRow = row / Math.max(rowCount - 1, 1);

  const pointerDeltaX = (normalizedColumn - pointer.currentX) * width;

  const pointerDeltaY = (normalizedRow - pointer.currentY) * height;

  const pointerDistance = Math.hypot(pointerDeltaX, pointerDeltaY);

  const pointerRadius =
    Math.min(width, height) * fieldParameters.pointerRadiusRatio;

  const rawPointerInfluence = clamp(
    1 - pointerDistance / Math.max(pointerRadius, 1),
    0,
    1,
  );

  const pointerInfluence =
    smoothstep(rawPointerInfluence) * pointer.currentStrength;

  const pointerRipple =
    Math.sin(
      pointerDistance * fieldParameters.pointerRippleFrequency -
        animationTime * fieldParameters.pointerRippleSpeed,
    ) * pointerInfluence;

  const intensity = clamp(
    proceduralIntensity +
      pointerInfluence * fieldParameters.pointerDensityBoost +
      pointerRipple * fieldParameters.pointerRippleAmplitude,
    0,
    1,
  );

  const characterIndex = Math.floor(intensity * (CHARACTER_RAMP.length - 1));

  return {
    character: CHARACTER_RAMP[characterIndex],

    opacity: clamp(0.16 + intensity * 0.84 + pointerInfluence * 0.08, 0, 1),
  };
}

function smoothstep(value) {
  const normalizedValue = clamp(value, 0, 1);

  return normalizedValue * normalizedValue * (3 - 2 * normalizedValue);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
