import assert from "node:assert/strict";
import test from "node:test";

import { getNextMenuOpenState } from "../components/site-shell/navigation-state.mjs";

test("mobile toggle opens a closed navigation menu", () => {
  assert.equal(
    getNextMenuOpenState({
      isOpen: false,
      action: "toggle",
      isMobile: true,
    }),
    true,
  );
});

test("mobile toggle closes an open navigation menu", () => {
  assert.equal(
    getNextMenuOpenState({
      isOpen: true,
      action: "toggle",
      isMobile: true,
    }),
    false,
  );
});

test("close actions always close the navigation menu", () => {
  assert.equal(
    getNextMenuOpenState({
      isOpen: true,
      action: "close",
      isMobile: true,
    }),
    false,
  );
});

test("viewport changes clear stale mobile navigation state", () => {
  assert.equal(
    getNextMenuOpenState({
      isOpen: true,
      action: "viewport-change",
      isMobile: false,
    }),
    false,
  );
});

test("desktop navigation cannot be toggled into the mobile open state", () => {
  assert.equal(
    getNextMenuOpenState({
      isOpen: false,
      action: "toggle",
      isMobile: false,
    }),
    false,
  );
});
