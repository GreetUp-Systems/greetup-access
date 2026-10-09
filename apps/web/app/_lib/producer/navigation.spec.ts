import { activeSection, initials, showsTabBar } from "./navigation";

describe("activeSection", () => {
  it.each([
    ["/producer", "dashboard"],
    ["/producer/", "dashboard"],
    ["/producer/events", "events"],
    ["/producer/events/new", "events"],
    ["/producer/events/0b0c", "events"],
    ["/producer/receiving", "receiving"],
    ["/producer/receiving/terms", "receiving"],
    ["/producer/profile", null],
    ["/producer/start", null],
    ["/producer/eventsx", null],
  ] as const)("%s → %s", (path, section) => {
    expect(activeSection(path)).toBe(section);
  });
});

describe("showsTabBar", () => {
  it.each([
    ["/producer", true],
    ["/producer/", true],
    ["/producer/events", true],
    ["/producer/receiving", true],
    ["/producer/profile", false],
    ["/producer/events/new", false],
    ["/producer/events/0b0c", false],
  ] as const)("%s → %s", (path, shown) => {
    expect(showsTabBar(path)).toBe(shown);
  });
});

describe("initials", () => {
  it.each([
    ["Casa Fluida", "CF"],
    ["  casa   fluida  ", "CF"],
    ["Ateliê Ávila & Filhos", "AF"],
    ["Access", "A"],
    ["Bar do Zé", "BZ"],
    ["", ""],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
