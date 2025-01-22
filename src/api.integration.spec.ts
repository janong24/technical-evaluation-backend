import { testClient } from "hono/testing";
import { describe, it } from "vitest";
import { app } from "./api";

describe("API", () => {
  const client = testClient(app);

  it("returns 422 if no body is included", async ({ expect }) => {
    const fileName = 'test-small-file.txt';
    const res = await client.upload[':fileName'].index.$post({ param: { fileName } });

    expect(res.status).toBe(422);
  });
});
