import { cn } from "./utils";

describe("cn", () => {
  it("lets the later design system class win within the same kind", () => {
    expect(cn("h-control-md px-4", "h-control-lg")).toBe("px-4 h-control-lg");
    expect(cn("type-body-m", "type-heading-h2")).toBe("type-heading-h2");
    expect(cn("rounded-md", "rounded-full")).toBe("rounded-full");
    expect(cn("shadow-elevation-1", "shadow-elevation-2")).toBe("shadow-elevation-2");
  });

  it("keeps classes of different kinds together", () => {
    expect(cn("type-body-m text-text-primary", "text-text-secondary")).toBe(
      "type-body-m text-text-secondary",
    );
    expect(cn("size-icon-md", "p-2")).toBe("size-icon-md p-2");
  });
});
