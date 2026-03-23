"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";

interface ChatActionsMenuProps {
  onRenameChat?: () => void;
  onDeleteChat?: () => void;
  triggerClassName?: string;
  menuAlign?: "left" | "right";
}

export function ChatActionsMenu({
  onRenameChat,
  onDeleteChat,
  triggerClassName,
  menuAlign = "right",
}: ChatActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 176;

    const left = menuAlign === "left" ? rect.left : Math.max(8, rect.right - menuWidth);

    setMenuPosition({
      top: rect.bottom + 6,
      left,
    });
  }, [menuAlign]);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);

      if (!insideTrigger && !insideMenu) {
        setOpen(false);
      }
    };
    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Chat actions"
        onClick={() => setOpen((prev) => !prev)}
        className={`px-1 text-zinc-500 transition hover:text-zinc-200 ${triggerClassName ?? ""}`}
      >
        <Ellipsis aria-hidden="true" className="h-6 w-6" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] min-w-44 rounded-[10px] bg-zinc-900 p-1 shadow-lg shadow-black/40"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {onRenameChat && (
              <button
                type="button"
                onClick={() => {
                  onRenameChat();
                  setOpen(false);
                }}
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                Rename chat
              </button>
            )}
            {onDeleteChat && (
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm("Delete this chat?");
                  if (confirmed) {
                    onDeleteChat();
                  }
                  setOpen(false);
                }}
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-rose-400 transition hover:bg-zinc-800 hover:text-rose-300"
              >
                Delete chat
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
