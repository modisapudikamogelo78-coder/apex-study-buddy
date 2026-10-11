import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildBeatPrompt, PART_COUNT } from "./index.ts";

const script = { studio: "A cozy studio.", host_a: "a young woman.", host_b: "an older man." };

Deno.test("podcast is one video built from five continuous parts", () => {
  assertEquals(PART_COUNT, 5);
});

Deno.test("first part introduces both hosts, later parts continue the same video", () => {
  const first = buildBeatPrompt(script, { host_a_line: "Hi", host_b_line: "Hello" }, 0);
  const later = buildBeatPrompt(script, { host_a_line: "Why?", host_b_line: "Because." }, 2);
  assert(first.includes("a young woman.") && first.includes("an older man."));
  assert(later.startsWith("The same podcast conversation continues"));
  assert(!later.includes('"'));
});
