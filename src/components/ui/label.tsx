import { forwardRef } from "react";
import { cn } from "@/components/lib/cn";

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-1.5 block text-sm font-medium text-text", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";
