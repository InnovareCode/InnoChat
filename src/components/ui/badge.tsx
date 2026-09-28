import { cn } from "@/components/lib/cn";
import { badgeVariants, type BadgeVariants } from "./badge.variants";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & BadgeVariants;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
