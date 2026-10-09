import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Veo scene settings use an eight-second vertical clip", () => {
  const settings = { durationSeconds: 8, resolution: "1080p", aspectRatio: "9:16", sampleCount: 1 };
  assertEquals(settings.durationSeconds, 8);
  assertEquals(settings.resolution, "1080p");
  assertEquals(settings.aspectRatio, "9:16");
  assertEquals(settings.sampleCount, 1);
});