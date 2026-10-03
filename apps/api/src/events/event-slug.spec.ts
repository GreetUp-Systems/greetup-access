import { publicSlugPattern, slugCandidates, slugify, withRandomSuffix } from "./event-slug";

describe("event slug", () => {
  it.each([
    ["Festival Access", "festival-access"],
    ["  São João da Mantiqueira  ", "sao-joao-da-mantiqueira"],
    ["Show #1 — Ação & Reação!", "show-1-acao-reacao"],
    ["Ünïcödé Çàfé", "unicode-cafe"],
    ["---", "evento"],
    ["🎉🎉", "evento"],
  ])("normalizes %p to %p", (name, expected) => {
    expect(slugify(name)).toBe(expected);
    expect(publicSlugPattern.test(slugify(name))).toBe(true);
  });

  it("limits the base to 80 characters without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(79)} bcd`);

    expect(slug).toBe("a".repeat(79));
    expect(slugify("x".repeat(200))).toHaveLength(80);
  });

  it("adds a six character suffix that keeps the public pattern and the column limit", () => {
    const slug = withRandomSuffix("x".repeat(80));

    expect(slug).toMatch(/^x{80}-[a-z0-9]{6}$/);
    expect(slug.length).toBeLessThanOrEqual(100);
    expect(publicSlugPattern.test(slug)).toBe(true);
  });

  it("tries the plain base first and then distinct suffixed candidates", () => {
    const candidates = slugCandidates("Festival Access", 5);

    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toBe("festival-access");
    for (const candidate of candidates.slice(1)) {
      expect(candidate).toMatch(/^festival-access-[a-z0-9]{6}$/);
    }
  });
});
