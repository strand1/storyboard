"use client";

import { cn } from "@/lib/utils";

interface LiveStatusIndicatorProps {
  status: "idle" | "generating" | "complete";
  currentScene?: number;
  totalScenes?: number;
  passedCount?: number;
  reviewCount?: number;
  className?: string;
}

export function LiveStatusIndicator({
  status,
  currentScene,
  totalScenes,
  passedCount,
  reviewCount,
  className,
}: LiveStatusIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {status === "generating" ? (
          <>
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              Generating scene {currentScene} of {totalScenes}
            </span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-foreground">
              Generation complete
            </span>
          </>
        )}
      </div>

      {status === "complete" && (passedCount !== undefined || reviewCount !== undefined) && (
        <div className="flex items-center gap-4 text-sm">
          {passedCount !== undefined && passedCount > 0 && (
            <span className="text-green-600 dark:text-green-400">
              {passedCount} passed
            </span>
          )}
          {reviewCount !== undefined && reviewCount > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {reviewCount} need review
            </span>
          )}
        </div>
      )}
    </div>
  );
}
