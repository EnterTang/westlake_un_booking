import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

test("schema retains the atomic capacity fields", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("reservedCount Int @default(0)");
  expect(schema).toContain("enum SlotType");
});
