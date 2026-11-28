import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const ICONS: ToasterProps["icons"] = {
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <OctagonXIcon className="size-4" />,
  loading: <Loader2Icon className="size-4 animate-spin" />,
};

// Sonner paints its own surface; map it onto the app brand tokens for a compact Telegram-like banner.
const STYLE: CSSProperties & Record<`--${string}`, string> = {
  "--normal-bg": "var(--brand-navy-deep)",
  "--normal-text": "#ffffff",
  "--normal-border": "color-mix(in srgb, var(--brand-lime) 38%, transparent)",
  "--border-radius": "14px",
};

const TOAST_OPTIONS: ToasterProps["toastOptions"] = {
  classNames: {
    toast:
      "cn-toast !px-3 !py-2.5 !text-[13px] !shadow-lg !rounded-[14px] !gap-2.5 !min-h-0 !max-w-[360px]",
    title: "!font-semibold !text-[13px] !leading-tight",
    description: "!text-[11px] !text-white/75 !leading-tight",
    actionButton:
      "!bg-brand-lime !text-brand-navy-deep !font-bold !text-[11px] !px-2.5 !py-1 !rounded-full",
  },
};

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={ICONS}
      style={STYLE}
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  );
};

export { Toaster };
