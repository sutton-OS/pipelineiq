"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/goldbot/kbd";

type GoldBotTableToolbarChip = {
  value: string;
  label: string;
  count?: number;
};

type GoldBotTableSortOption = {
  value: string;
  label: string;
};

type GoldBotTableToolbarProps = {
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchPlaceholder?: string;
  chips?: GoldBotTableToolbarChip[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  sortValue?: string;
  onSortValueChange?: (value: string) => void;
  sortOptions?: GoldBotTableSortOption[];
  sortAriaLabel?: string;
  className?: string;
  showShortcutHint?: boolean;
};

export function TableToolbar({
  searchValue = "",
  onSearchValueChange,
  searchPlaceholder = "Search...",
  chips = [],
  activeChip,
  onChipChange,
  sortValue,
  onSortValueChange,
  sortOptions = [],
  sortAriaLabel = "Sort rows",
  className,
  showShortcutHint = false,
}: GoldBotTableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 pb-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchValueChange?.(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-border/70 bg-paper/30 pl-9 pr-12 text-sm text-ink placeholder:text-ink-2"
            aria-label={searchPlaceholder}
          />
          {showShortcutHint ? (
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-ink-2">
              <Kbd>/</Kbd>
            </span>
          ) : null}
        </div>

        {sortOptions.length > 0 ? (
          <Select value={sortValue} onValueChange={onSortValueChange}>
            <SelectTrigger
              className="h-9 w-full border-border/70 bg-paper/30 text-sm text-ink lg:w-[170px]"
              aria-label={sortAriaLabel}
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="border-border/70 bg-paper-2/95">
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const isActive = activeChip === chip.value;

            return (
              <Button
                key={chip.value}
                type="button"
                variant={isActive ? "secondary" : "outline"}
                size="xs"
                onClick={() => onChipChange?.(chip.value)}
                className={cn(
                  "rounded-full border-border/70 px-2.5 text-[11px] tracking-[0.02em]",
                  isActive
                    ? "bg-paper-2 text-ink shadow-none"
                    : "bg-paper/20 text-ink-2 hover:bg-paper/40 hover:text-ink",
                )}
                aria-pressed={isActive}
              >
                {chip.label}
                {typeof chip.count === "number" ? (
                  <span className="text-[10px] text-ink-3">{chip.count}</span>
                ) : null}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
