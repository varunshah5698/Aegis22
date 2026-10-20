import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        outline: "border border-foreground/20 bg-transparent text-foreground hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-risk-critical text-white hover:bg-risk-critical/90",
        link: "text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-9 p-0",
        "icon-sm": "size-7 p-0",
        "icon-xs": "size-6 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
