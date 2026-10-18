/**
 * src/components/work/WorkStrategyPad.tsx
 * Dedicated Apple-grade Liquid Glass writing, brainstorming, and strategy canvas
 * rendered exclusively beneath the Persistent Tasks in the Work checklist.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Check, List, ArrowRight, Star } from 'lucide-react';
import { GlassContainer } from '../common/GlassContainer';
import { triggerHaptic } from '../../utils/haptics';

const STRATEGY_STORAGE_KEY = 'cadence_work_strategy_v1';

export interface WorkStrategyPadProps {
  className?: string;
}

export const WorkStrategyPad: React.FC<WorkStrategyPadProps> = ({ className = '' }) => {
  const [content, setContent] = useState<string>(() => {
    try {
      return localStorage.getItem(STRATEGY_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('saved');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea height cleanly as user types
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(156, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  // Persist to localStorage with subtle "Saved" feedback
  const persistContent = useCallback((nextValue: string) => {
    setSaveState('saving');
    try {
      localStorage.setItem(STRATEGY_STORAGE_KEY, nextValue);
    } catch {
      // Ignore storage quota errors
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setSaveState('saved');
    }, 350);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    persistContent(val);
  };

  // Smart Enter continuation for "• ", "→ ", and "★ " prefixes
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const el = e.currentTarget;
    const cursor = el.selectionStart;
    const before = content.slice(0, cursor);
    const after = content.slice(el.selectionEnd);
    const currentLineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.slice(currentLineStart);

    const prefixMatch = currentLine.match(/^(\s*(?:•|→|★|-)\s+)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1]!;
      // If user pressed Enter on an empty bullet line, remove the bullet prefix
      if (currentLine.trim() === prefix.trim()) {
        e.preventDefault();
        const updated = content.slice(0, currentLineStart) + after;
        setContent(updated);
        persistContent(updated);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = currentLineStart;
        });
        return;
      }

      e.preventDefault();
      const insertion = `\n${prefix}`;
      const updated = before + insertion + after;
      setContent(updated);
      persistContent(updated);
      requestAnimationFrame(() => {
        const nextPos = cursor + insertion.length;
        el.selectionStart = el.selectionEnd = nextPos;
        adjustHeight();
      });
    }
  };

  // Insert prefix chip at current cursor or new line
  const insertSnippet = (prefix: string) => {
    triggerHaptic('light');
    const el = textareaRef.current;
    if (!el) {
      const next = content ? `${content}\n${prefix}` : prefix;
      setContent(next);
      persistContent(next);
      return;
    }

    const start = el.selectionStart ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(el.selectionEnd ?? content.length);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const snippet = `${needsNewline ? '\n' : ''}${prefix}`;
    const updated = before + snippet + after;

    setContent(updated);
    persistContent(updated);

    requestAnimationFrame(() => {
      el.focus();
      const nextCursor = start + snippet.length;
      el.selectionStart = el.selectionEnd = nextCursor;
      adjustHeight();
    });
  };

  return (
    <section
      aria-label="Strategy & Brainstorm"
      className={`flex flex-col gap-1.5 ${className}`}
    >
      {/* ── Section Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-1.5 px-1 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#EC4899] via-[#A855F7] to-[#F59E0B] text-white shadow-[0_2px_10px_rgba(236,72,153,0.4)]"
            aria-hidden="true"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[2.3]" />
          </span>
          <h2 className="text-[13px] font-bold uppercase tracking-[+0.45px] text-[#BE185D] dark:text-[#F472B6] truncate">
            Strategy & Brainstorm
          </h2>
        </div>

        {/* Auto-Save Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EC4899]/12 text-[#DB2777] dark:text-[#F472B6] border border-[#EC4899]/25">
            <Check className="w-3 h-3 stroke-[2.5]" />
            <span>{saveState === 'saving' ? 'Saving…' : 'Saved'}</span>
          </span>
        </div>
      </div>

      {/* ── Liquid Glass Writing & Strategy Canvas ─────────────────────── */}
      <GlassContainer
        variant="card"
        className="overflow-hidden p-0 rounded-[18px] border-[#EC4899]/25 dark:border-[#F472B6]/25 bg-gradient-to-b from-[#FCE7F3]/45 via-white/75 to-white/70 dark:from-[#EC4899]/[0.09] dark:via-[#141828]/80 dark:to-[#101422]/85"
      >
        {/* Luminous Top Accent Line */}
        <div
          className="h-[2px] w-full opacity-80 bg-gradient-to-r from-[#EC4899] via-[#A855F7] to-[#F59E0B]"
          aria-hidden="true"
        />

        {/* Quick-Insert Strategy Toolbar */}
        <div className="flex items-center justify-between gap-1.5 px-3.5 py-2 border-b border-[var(--separator)] bg-white/45 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => insertSnippet('• ')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#EC4899]/12 hover:bg-[#EC4899]/22 text-[#BE185D] dark:text-[#F472B6] transition-colors cursor-pointer border-none"
            >
              <List className="w-3 h-3" />
              <span>Bullet</span>
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('→ ')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#0EA5E9]/12 hover:bg-[#0EA5E9]/22 text-[#0369A1] dark:text-[#38BDF8] transition-colors cursor-pointer border-none"
            >
              <ArrowRight className="w-3 h-3" />
              <span>Action</span>
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('★ ')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#F59E0B]/14 hover:bg-[#F59E0B]/24 text-[#B45309] dark:text-[#FBBF24] transition-colors cursor-pointer border-none"
            >
              <Star className="w-3 h-3" />
              <span>Key Idea</span>
            </button>
          </div>
        </div>

        {/* Freeform Strategy Textarea */}
        <div className="p-4 bg-white/55 dark:bg-white/[0.02]">
          <textarea
            ref={textareaRef}
            aria-label="Work strategy and brainstorm notes"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Write, brainstorm, map out priorities, or strategize your next move…"
            rows={6}
            className="w-full min-h-[156px] resize-none bg-transparent text-[17px] leading-[25px] tracking-[-0.3px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none border-none p-0 m-0"
            style={{ fontSize: '17px' }}
          />
        </div>
      </GlassContainer>
    </section>
  );
};

export default WorkStrategyPad;
