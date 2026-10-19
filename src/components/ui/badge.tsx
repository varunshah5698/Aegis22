import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-foreground text-background",
        accent: "border-transparent bg-accent text-accent-foreground",
        outline: "border-border bg-transparent text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        low: "border-transparent bg-risk-low/15 text-risk-low dark:bg-risk-low/20",
        medium: "border-transparent bg-risk-medium/20 text-[#6b4a00] dark:text-risk-medium",
        high: "border-transparent bg-risk-high/15 text-[#9a3510] dark:text-risk-high",
        critical: "border-transparent bg-risk-critical/12 text-[#a3131a] dark:text-risk-critical",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
