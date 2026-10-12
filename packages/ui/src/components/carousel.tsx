"use client";

import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { cn } from "@access/ui/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];

interface CarouselContextValue {
  carouselRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  /** The slide in view, from 0. */
  selectedIndex: number;
  /** How many slides there are to go through. */
  snapCount: number;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel(): CarouselContextValue {
  const context = useContext(CarouselContext);
  if (context === null) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }
  return context;
}

type CarouselProps = ComponentProps<"div"> & {
  /** Embla's options; `startIndex` opens on a slide other than the first. */
  opts?: CarouselOptions;
  setApi?: (api: CarouselApi) => void;
  /** Called when another slide comes into view, by swipe, by the arrow keys or by `scrollTo`. */
  onSelectedIndexChange?: (index: number) => void;
};

/**
 * shadcn/ui Carousel (embla), horizontal. One slide at a time, swiped on the phone and moved with
 * the arrow keys once it has the focus (it is a tab stop, with the focus ring of border/accent); the
 * position goes to CarouselDots and to `onSelectedIndexChange`. Without the
 * shadcn arrows for now: the tickets of an event are swiped (SPEC-014 M11), and the vitrine's
 * arrows come with SPEC-016 16C.
 */
function Carousel({
  opts,
  setApi,
  onSelectedIndexChange,
  className,
  children,
  ...props
}: CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel({ ...opts, axis: "x" });
  const [selectedIndex, setSelectedIndex] = useState(opts?.startIndex ?? 0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (api !== undefined) {
      setApi?.(api);
    }
  }, [api, setApi]);

  useEffect(() => {
    if (api === undefined) {
      return;
    }
    const onInit = (current: NonNullable<CarouselApi>) => {
      setSnapCount(current.scrollSnapList().length);
      setSelectedIndex(current.selectedScrollSnap());
    };
    const onSelect = (current: NonNullable<CarouselApi>) => {
      const index = current.selectedScrollSnap();
      setSelectedIndex(index);
      onSelectedIndexChange?.(index);
    };
    onInit(api);
    api.on("reInit", onInit);
    api.on("select", onSelect);
    return () => {
      api.off("reInit", onInit);
      api.off("select", onSelect);
    };
  }, [api, onSelectedIndexChange]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        api?.scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        api?.scrollNext();
      }
    },
    [api],
  );

  return (
    <CarouselContext.Provider value={{ carouselRef, api, selectedIndex, snapCount }}>
      <div
        onKeyDownCapture={onKeyDown}
        role="region"
        aria-roledescription="carrossel"
        data-slot="carousel"
        // A tab stop of its own, so the arrow keys reach it even when no slide has a control.
        tabIndex={0}
        className={cn(
          "relative rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

/** The track: slides side by side with space/4 between them, clipped to the carousel. */
function CarouselContent({ className, ...props }: ComponentProps<"div">) {
  const { carouselRef } = useCarousel();
  return (
    <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
      <div className={cn("-ml-4 flex", className)} {...props} />
    </div>
  );
}

function CarouselItem({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn("min-w-0 shrink-0 grow-0 basis-full pl-4", className)}
      {...props}
    />
  );
}

/**
 * Figma: Ponto de paginação (480:10), a row of them under the carousel, space/1-5 apart: the
 * current one size/dot-active wide in text/primary, the others size/dot in text/tertiary. Decorative:
 * the screen's caption says which slide is in view ("Ingresso 1 de 3").
 */
function CarouselDots({ className, ...props }: ComponentProps<"div">) {
  const { snapCount, selectedIndex } = useCarousel();
  if (snapCount <= 1) {
    return null;
  }
  return (
    <div
      aria-hidden
      data-slot="carousel-dots"
      className={cn("flex items-center justify-center gap-1-5", className)}
      {...props}
    >
      {Array.from({ length: snapCount }, (_, index) => (
        <span
          key={index}
          data-current={index === selectedIndex || undefined}
          className={cn(
            "h-dot rounded-full",
            index === selectedIndex ? "w-dot-active bg-text-primary" : "w-dot bg-text-tertiary",
          )}
        />
      ))}
    </div>
  );
}

export {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  type CarouselProps,
  useCarousel,
};
