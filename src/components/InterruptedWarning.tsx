"use client";

import { cn } from "@/lib/utils";

interface InterruptedWarningProps {
  projectName: string;
  idea: string;
  onDismiss: () => void;
  onViewPartial: () => void;
  className?: string;
}

export function InterruptedWarning({
  projectName,
  idea,
  onDismiss,
  onViewPartial,
  className,
}: InterruptedWarningProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border border-amber-500/30 bg-amber-500/10",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-amber-500 text-xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">
            Previous run was interrupted
          </h3>
          <p className="text-sm text-foreground mb-1">
            {projectName && (
              <span className="font-medium">{projectName}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {idea}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onViewPartial}
              className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              View partial results
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs font-medium rounded border border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
