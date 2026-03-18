"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StoryInputFormProps {
  onSubmit: (storyIdea: string) => void;
  disabled?: boolean;
  defaultValue?: string;
}

export function StoryInputForm({ onSubmit, disabled, defaultValue }: StoryInputFormProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="story-idea"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Story Idea
          </label>
          <textarea
            id="story-idea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            placeholder="A photographer discovers an abandoned mansion in the woods..."
            rows={3}
            className={cn(
              "w-full px-4 py-3 rounded-lg border border-input bg-background",
              "text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-200"
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            One sentence is enough. The AI will break it into scenes.
          </p>
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className={cn(
              "px-6 py-2.5 rounded-lg font-medium text-sm",
              "bg-orange-500 text-white",
              "hover:bg-orange-600 transition-colors duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            )}
          >
            {disabled ? "Generating..." : "Generate Storyboard"}
          </button>
        </div>
      </div>
    </form>
  );
}
