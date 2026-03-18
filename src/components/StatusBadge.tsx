"use client";

import { cn } from "@/lib/utils";

export type StatusType = "pass" | "needs_review" | "generating" | "retrying" | "idle";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; color: string }> = {
  pass: { label: "Pass", color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-600/20" },
  needs_review: { label: "Review", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-600/20" },
  generating: { label: "Generating", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-600/20" },
  retrying: { label: "Retrying", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-600/20" },
  idle: { label: "Pending", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-600/20" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        config.color,
        className
      )}
    >
      {status === "generating" || status === "retrying" ? (
        <>
          <span className="animate-spin mr-1.5">●</span>
          {config.label}
        </>
      ) : (
        config.label
      )}
    </span>
  );
}
