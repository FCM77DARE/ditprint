import { describe, expect, it } from "vitest";

describe("NewsAPI key validation", () => {
  it("should have NEWS_API_KEY set in environment", () => {
    const key = process.env.NEWS_API_KEY;
    expect(key).toBeDefined();
    expect(key?.length).toBeGreaterThan(10);
  });

  it("should successfully fetch news from NewsAPI", async () => {
    const key = process.env.NEWS_API_KEY;
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=Baía+de+Guanabara&language=pt&pageSize=1&apiKey=${key}`
    );
    const data = await response.json() as { status: string; totalResults?: number; message?: string };
    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
  }, 15000);
});
