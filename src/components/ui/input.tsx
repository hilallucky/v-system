import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-border bg-white px-3 text-xs outline-none placeholder:text-slate-400 focus-visible:border-[#754691] focus-visible:ring-2 focus-visible:ring-[#754691]/30",
        className,
      )}
      {...props}
    />
  );
}
