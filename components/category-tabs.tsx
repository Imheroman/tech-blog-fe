"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { categories } from "@/lib/blog-data";

interface CategoryTabsProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({ selected, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Toggle the edge fades based on how far the row is scrolled, so the user
  // sees there's more content rather than an abrupt cut-off.
  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftFade(scrollLeft > 1);
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFades();

    // While hovering this section, translate vertical wheel scroll into
    // horizontal scrolling so overflowing categories stay reachable.
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [updateFades]);

  return (
    <div className="relative">
      {/* Left fade */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-200 ${
          showLeftFade ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-2 overflow-x-auto scroll-px-4 px-0.5"
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-base font-medium transition-colors ${
              selected === cat
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Right fade */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-200 ${
          showRightFade ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
