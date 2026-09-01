import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { buttonVariants, type ButtonVariantProps } from "@/ui/button-variants";
import { cn } from "@/ui/lib/utils";

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  ButtonVariantProps & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
