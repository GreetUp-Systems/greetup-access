import { Skeleton } from "@access/ui/components/skeleton";
import { cn } from "@access/ui/lib/utils";

/** An esqueleto as wide as a text in that typography, so the shape matches what will come. */
export function TextSkeleton({
  text,
  type,
  height,
}: {
  text: string;
  type: string;
  height?: string;
}) {
  return (
    <Skeleton className={cn("w-fit overflow-hidden rounded-sm", height)}>
      <span className={cn("invisible block whitespace-nowrap", type)}>{text}</span>
    </Skeleton>
  );
}
