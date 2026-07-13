import { useEffect, useState, RefObject, useRef } from 'react';

interface SelectionInfo {
  word: string;
  x: number;
  y: number;
}

export function useTextSelectionLookup(
  containerRef: RefObject<HTMLElement | null>
) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const justSelectedRef = useRef(false);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !containerRef.current) {
        setSelection(null);
        return;
      }

      const text = sel.toString().trim();
      
      if (!text || /\s/.test(text) || text.length > 50) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      
      let node: Node | null = range.commonAncestorContainer;
      let isInside = false;
      while (node) {
        if (node === container) {
          isInside = true;
          break;
        }
        node = node.parentNode;
      }

      if (!isInside) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      
      justSelectedRef.current = true;
      if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current);
      selectionTimeoutRef.current = setTimeout(() => {
        justSelectedRef.current = false;
      }, 300);
      
      setSelection({
        word: text,
        x: rect.left + rect.width / 2 - 160,
        y: rect.bottom + 8,
      });
    };

    const handleClick = (e: MouseEvent) => {
      if (justSelectedRef.current) {
        return;
      }
      
      const target = e.target as Node;
      const container = containerRef.current;
      if (container && container.contains(target)) {
        setSelection(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [containerRef]);

  const closeSelection = () => setSelection(null);

  return { selection, closeSelection };
}