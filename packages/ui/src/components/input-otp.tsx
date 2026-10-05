"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { type ComponentProps, useContext } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: "Código" of Identificação · Código (145:1506, 148:2183). One real input under the slots,
 * so pasting and the OS one-time-code autofill work (FigJam, Identificação). Boxes are 48 × 60 on
 * bg/surface at 360; the desktop window passes md:gap-4, md:aspect-14/17 and md:bg-bg-subtle.
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn("flex w-full items-center", containerClassName)}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex w-full items-center gap-2", className)}
      {...props}
    />
  );
}

/** One box: Heading/H2 digit, border/strong; the active box takes a 2 px border/accent. */
function InputOTPSlot({ index, className, ...props }: ComponentProps<"div"> & { index: number }) {
  const context = useContext(OTPInputContext);
  const slot = context.slots[index];

  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive || undefined}
      className={cn(
        "flex aspect-4/5 flex-1 items-center justify-center rounded-md border border-border-strong bg-bg-surface type-heading-h2 text-text-primary",
        // An invalid code paints every box in the danger color, the active one included.
        "data-active:not-aria-invalid:border-border-accent data-active:not-aria-invalid:inset-ring data-active:not-aria-invalid:inset-ring-border-accent",
        "aria-invalid:border-border-danger",
        className,
      )}
      {...props}
    >
      {slot?.char}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
