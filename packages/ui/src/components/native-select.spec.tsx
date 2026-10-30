import { renderToStaticMarkup } from "react-dom/server";

import { NativeSelect, NativeSelectOption, type NativeSelectProps } from "./native-select";

function render(props: Partial<NativeSelectProps> = {}): string {
  return renderToStaticMarkup(
    <NativeSelect id="uf" defaultValue="" {...props}>
      <NativeSelectOption value="" disabled>
        Escolha
      </NativeSelectOption>
      <NativeSelectOption value="SP">SP</NativeSelectOption>
    </NativeSelect>,
  );
}

/** The classes of the element with this data-slot, as written in the markup's attribute. */
function classesOf(markup: string, slot: string): string[] {
  const tag = new RegExp(`<[^>]*data-slot="${slot}"[^>]*>`).exec(markup)?.[0] ?? "";
  const classes = /class="([^"]*)"/.exec(tag)?.[1] ?? "";
  return classes.replaceAll("&#x27;", "'").split(" ");
}

describe("NativeSelect", () => {
  it("is the browser's own select, with the field's look and the chevron beside", () => {
    const markup = render();

    expect(markup).toMatch(/<select data-slot="native-select" class="[^"]*" id="uf">/);
    expect(classesOf(markup, "native-select")).toEqual(
      expect.arrayContaining(["appearance-none", "h-control-md", "type-body-m", "pr-12"]),
    );
    expect(/<svg[^>]*data-slot="native-select-icon"[^>]*>/.exec(markup)?.[0]).toContain(
      'aria-hidden="true"',
    );
    expect(classesOf(markup, "native-select-icon")).toEqual(
      expect.arrayContaining(["pointer-events-none", "size-icon-md", "text-icon-secondary"]),
    );
  });

  it("follows the field's sizes: S with the 16 chevron, L with Body/L", () => {
    const small = render({ size: "s" });
    expect(classesOf(small, "native-select")).toContain("h-control-sm");
    expect(classesOf(small, "native-select-icon")).toContain("size-icon-sm");

    const large = render({ size: "l" });
    expect(classesOf(large, "native-select")).toEqual(
      expect.arrayContaining(["h-control-lg", "type-body-l"]),
    );
    expect(classesOf(large, "native-select-icon")).toContain("size-icon-md");
  });

  it("shows the empty-value option as the placeholder while it is chosen", () => {
    const markup = render();

    expect(classesOf(markup, "native-select")).toContain(
      "has-[option[value='']:checked]:text-text-tertiary",
    );
    expect(markup).toContain(
      '<option data-slot="native-select-option" value="" disabled="" selected="">Escolha</option>',
    );
  });

  it("passes the state to the select and the layout to the wrapper", () => {
    const markup = render({ "aria-invalid": true, disabled: true, className: "w-column-s" });

    expect(markup).toMatch(/<select[^>]* aria-invalid="true" disabled=""/);
    expect(classesOf(markup, "native-select-wrapper")).toContain("w-column-s");
    expect(classesOf(markup, "native-select")).not.toContain("w-column-s");
  });
});
