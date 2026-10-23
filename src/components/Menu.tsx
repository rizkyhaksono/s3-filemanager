"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type MenuItem =
  | { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }
  | "divider";

/** Small "⋯" dropdown positioned with fixed coords so it escapes scroll containers. */
export function Menu({ items }: { items: MenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const width = 200;
    const visible = items.filter((i) => i === "divider" || !i.hidden).length;
    const height = visible * 34 + 8;
    const top = r.bottom + height > window.innerHeight ? r.top - height - 4 : r.bottom + 4;
    setPos({ top, left: Math.max(8, r.right - width) });
  };

  return (
    <>
      <button
        ref={btn}
        onClick={toggle}
        onDoubleClick={(e) => e.stopPropagation()}
        className="grid size-7 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg"
        aria-label="Aksi"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {pos && (
        <div
          className="fixed z-50 w-[200px] rounded-lg border border-line bg-surface py-1 shadow-xl animate-in"
          style={pos}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={i} className="my-1 border-t border-line" />
            ) : item.hidden ? null : (
              <button
                key={i}
                onClick={() => {
                  setPos(null);
                  item.onClick();
                }}
                className={`flex h-[34px] w-full items-center gap-2.5 px-3 text-left text-[13px] hover:bg-subtle ${
                  item.danger ? "text-red-600" : "text-fg"
                }`}
              >
                <span className="text-muted [&>svg]:size-4">{item.icon}</span>
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}
