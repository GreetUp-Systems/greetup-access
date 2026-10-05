import desktop from "@access/ui/assets/cover-desktop.svg";
import mobile from "@access/ui/assets/cover-mobile.svg";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Cartaz, the brand's default cover art (SPEC-014 A2), exported from the event page
 * (138:322 and 140:931). Below md it fills the top of the screen behind the top bar and fades into
 * bg/canvas (Esmaecimento do cartaz: bg/canvas up to glass/clear over the bottom 240 of 380);
 * from md it is the 740 × 440 poster with radius/xl. Decorative: the page title names the event.
 */
function EventCover({ className }: { className?: string }) {
  return (
    <div
      data-slot="event-cover"
      aria-hidden
      className={cn("relative w-full overflow-hidden md:rounded-xl", className)}
    >
      <picture>
        <source media="(width >= 768px)" srcSet={desktop.src} />
        <img
          src={mobile.src}
          alt=""
          draggable={false}
          className="block aspect-18/19 w-full object-cover md:aspect-37/22"
        />
      </picture>
      <div className="absolute inset-0 bg-linear-to-t from-bg-canvas to-glass-clear to-63% md:hidden" />
    </div>
  );
}

export { EventCover };
