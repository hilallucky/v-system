import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#754691] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#4A2260] text-white shadow-sm hover:bg-[#754691]",
        secondary: "border border-border bg-white text-slate-600 hover:border-[#d9c9e2] hover:bg-[#f5eff8] hover:text-[#754691]",
        ghost: "text-slate-600 hover:bg-[#f5eff8] hover:text-[#754691]",
        outline: "border border-border bg-white text-slate-700 hover:border-[#d9c9e2] hover:bg-[#f5eff8] hover:text-[#754691]",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-2.5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
