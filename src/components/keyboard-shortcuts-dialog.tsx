"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

function isMac() {
  if (typeof navigator === "undefined") return true;
  return navigator.platform?.toUpperCase().includes("MAC") ?? true;
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const mod = isMac() ? "⌘" : "Ctrl";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groups: ShortcutGroup[] = [
    {
      title: "Global",
      shortcuts: [
        { keys: [mod, "K"], description: "Open command palette" },
        { keys: [mod, "/"], description: "Show keyboard shortcuts" },
        { keys: ["Esc"], description: "Close dialog / modal" },
      ],
    },
    {
      title: "List Pages",
      shortcuts: [
        { keys: ["/"], description: "Focus search input" },
      ],
    },
    {
      title: "Forms",
      shortcuts: [
        { keys: ["Ctrl", "Enter"], description: "Save form" },
        { keys: ["Ctrl", "Shift", "Enter"], description: "Save and create new" },
        { keys: ["Esc"], description: "Cancel / close form" },
        { keys: ["Enter"], description: "Move to next field" },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        { keys: ["Click row"], description: "Open detail / navigate" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.title}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-700">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          {j > 0 && (
                            <span className="mx-0.5 text-slate-400">+</span>
                          )}
                          <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
