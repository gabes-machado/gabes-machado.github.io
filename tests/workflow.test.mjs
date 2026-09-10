import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/verify.yml", import.meta.url);

test("workflow pins third-party actions to immutable commits", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const actionReferences = [...workflow.matchAll(/uses:\s+([^\s#]+)/gu)].map(
    (match) => match[1],
  );

  assert.ok(actionReferences.length > 0);
  for (const actionReference of actionReferences) {
    assert.match(actionReference, /^[^@]+@[a-f\d]{40}$/u);
  }
});

test("workflow disables persisted checkout credentials", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(
    workflow,
    /uses: actions\/checkout@[a-f\d]{40}[^]*?with:\n\s+persist-credentials: false/u,
  );
});
