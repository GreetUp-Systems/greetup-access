import { renderToStaticMarkup } from "react-dom/server";

import { CoverField, type CoverFieldProps } from "./cover-field";

const noop = (): void => undefined;

function render(props: Partial<CoverFieldProps> = {}): string {
  return renderToStaticMarkup(
    <CoverField
      state="empty"
      accept="image/jpeg,image/png,image/webp"
      onFileSelect={noop}
      {...props}
    />,
  );
}

describe("CoverField", () => {
  it("hides the file input from the tab order and from screen readers, with its accept", () => {
    expect(render()).toMatch(
      /<input type="file" accept="image\/jpeg,image\/png,image\/webp" tabindex="-1" aria-hidden="true" class="sr-only"\/>/,
    );
  });

  it("asks for the cover while empty, with the phone's and the desktop's titles", () => {
    const markup = render();
    expect(markup).toContain("Escolha a imagem da capa");
    expect(markup).toContain("Arraste a capa ou escolha um arquivo");
    expect(markup).toContain("JPG, PNG ou WebP até 5 MB, no formato 16:9 (pelo menos 1600 × 900)");
    expect(markup).toContain(">Escolher arquivo</button>");
  });

  it("shows the progress while the cover goes, and takes no file", () => {
    const markup = render({ state: "uploading", progress: 20.4 });
    expect(markup).toContain("Enviando capa… 20%");
    expect(markup).not.toContain("<button");
    expect(markup).toMatch(/<input type="file"[^>]*disabled=""/);
  });

  it("shows the cover sent with Trocar capa, and never a way to remove it (E7)", () => {
    const markup = render({ state: "sent", previewUrl: "https://covers.test/e1.png" });
    expect(markup).toContain('src="https://covers.test/e1.png"');
    expect(markup).toContain("Trocar capa</button>");
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain("Capa enviada.");
  });

  it("says why an image could not be used and offers another file", () => {
    const markup = render({
      state: "error",
      errorDetail: "O arquivo tem 8,4 MB. Envie JPG, PNG ou WebP até 5 MB.",
    });
    expect(markup).toContain("Não foi possível usar esta imagem");
    expect(markup).toContain("O arquivo tem 8,4 MB. Envie JPG, PNG ou WebP até 5 MB.");
    expect(markup).toContain(">Escolher outro arquivo</button>");
  });
});
