import { renderToStaticMarkup } from "react-dom/server";

import { FileField, type FileFieldProps } from "./file-field";

const noop = (): void => undefined;

function render(props: Partial<FileFieldProps> = {}): string {
  return renderToStaticMarkup(
    <FileField
      state="empty"
      title="Frente do RG"
      detail="Fotos em JPG ou PNG; PDF até 3 MB."
      accept="application/pdf,image/jpeg,image/png"
      onFileSelect={noop}
      {...props}
    />,
  );
}

/** The text of the element whose id is in `attribute` of the button. */
function referenced(markup: string, attribute: string): string[] {
  const ids = new RegExp(`${attribute}="([^"]+)"`).exec(markup)?.[1]?.split(" ") ?? [];
  return ids.map((id) => {
    const element = new RegExp(
      `id="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([^<]*)<`,
    ).exec(markup);
    return element?.[1] ?? "";
  });
}

describe("FileField", () => {
  it("hides the file input from the tab order and from screen readers, with its accept", () => {
    const markup = render();

    expect(markup).toMatch(
      /<input type="file" accept="application\/pdf,image\/jpeg,image\/png" tabindex="-1" aria-hidden="true" class="sr-only"\/>/,
    );
  });

  it("names the action by its label and the title, and describes it by the line", () => {
    const markup = render();

    expect(referenced(markup, "aria-labelledby")).toEqual(["Escolher", "Frente do RG"]);
    expect(referenced(markup, "aria-describedby")).toEqual(["Fotos em JPG ou PNG; PDF até 3 MB."]);
    expect(markup).toContain('aria-live="polite"');
  });

  it("shows Escolher while empty and on error, Trocar once sent", () => {
    expect(render({ state: "empty" })).toContain(">Escolher</button>");
    expect(
      render({ state: "error", error: "PDF maior que 3 MB. Escolha outro arquivo." }),
    ).toContain(">Escolher</button>");
    expect(render({ state: "sent", fileName: "rg-frente.jpg" })).toContain(">Trocar</button>");
  });

  it("shows Enviando… without an action while the file goes, and takes no file", () => {
    const markup = render({ state: "uploading" });

    expect(markup).toContain(">Enviando…<");
    expect(markup).not.toContain("<button");
    expect(markup).toMatch(/<input type="file"[^>]* disabled=""/);
  });

  it("puts the file's name, or the error, in the detail's place", () => {
    const sent = render({ state: "sent", fileName: "rg-frente.jpg" });
    expect(referenced(sent, "aria-describedby")).toEqual(["rg-frente.jpg"]);

    const failed = render({
      state: "error",
      error: "A selfie precisa ser uma foto em JPG ou PNG.",
    });
    expect(referenced(failed, "aria-describedby")).toEqual([
      "A selfie precisa ser uma foto em JPG ou PNG.",
    ]);
    expect(failed).toContain('data-state="error"');
    expect(failed).toContain("text-text-danger");
  });

  it("keeps the action and the input off when disabled", () => {
    const markup = render({ disabled: true });

    expect(markup).toMatch(/<button[^>]* disabled=""/);
    expect(markup).toMatch(/<input type="file"[^>]* disabled=""/);
  });
});
