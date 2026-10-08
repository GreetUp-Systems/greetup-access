import { coverKeyContentType, isAcceptedCover, newCoverKey } from "./event-cover";

const eventId = "00000000-0000-4000-8000-000000000010";

describe("event cover", () => {
  it("issues a fresh key under the event, with the extension of the type", () => {
    const first = newCoverKey(eventId, "image/jpeg");
    const second = newCoverKey(eventId, "image/jpeg");

    expect(first).toMatch(new RegExp(`^events/${eventId}/[0-9a-f-]{36}\\.jpg$`));
    expect(second).not.toBe(first);
    expect(newCoverKey(eventId, "image/png")).toMatch(/\.png$/);
    expect(newCoverKey(eventId, "image/webp")).toMatch(/\.webp$/);
  });

  it("reads back the type of a key issued for the event", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"] as const) {
      expect(coverKeyContentType(eventId, newCoverKey(eventId, type))).toBe(type);
    }
  });

  it.each([
    newCoverKey("00000000-0000-4000-8000-000000000099", "image/png"),
    `events/${eventId}/cover.png`,
    `events/${eventId}/../00000000-0000-4000-8000-0000000000c2.png`,
    `events/${eventId}/00000000-0000-4000-8000-0000000000c2.png/extra`,
    `events/${eventId}/00000000-0000-4000-8000-0000000000c2.PNG`,
    `/events/${eventId}/00000000-0000-4000-8000-0000000000c2.png`,
  ])("rejects a key that is not a cover of the event: %s", (key) => {
    expect(coverKeyContentType(eventId, key)).toBeNull();
  });

  it("accepts the signed type up to 5 MB and nothing else", () => {
    expect(isAcceptedCover("image/png", { contentType: "image/png", size: 5 * 1024 * 1024 })).toBe(
      true,
    );
    expect(isAcceptedCover("image/png", { contentType: "Image/PNG; q=1", size: 10 })).toBe(true);
    expect(
      isAcceptedCover("image/png", { contentType: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ).toBe(false);
    expect(isAcceptedCover("image/png", { contentType: "image/webp", size: 10 })).toBe(false);
    expect(isAcceptedCover("image/png", { contentType: null, size: 10 })).toBe(false);
    expect(isAcceptedCover("image/png", { contentType: "image/png", size: 0 })).toBe(false);
  });
});
