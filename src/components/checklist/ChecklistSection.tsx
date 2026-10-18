/**
 * src/components/checklist/ChecklistSection.tsx
 * Inset grouped section container managing section header with progress ring,
 * Reorder.Group / Reorder.Item drag reordering with fractional sort order,
 * empty state, and inline quick-add item row.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Plus } from 'lucide-react';
import { GlassContainer } from '../common/GlassContainer';
import { ChecklistItemRow } from './ChecklistItemRow';
import { SectionHeader } from './SectionHeader';
import type { SectionAccent } from './Checkbox';
import { calculateNewSortOrder } from '../../db/repository';
import { triggerHaptic } from '../../utils/haptics';
import type { ChecklistItem, ChecklistType, SectionProgress } from '../../domain/types';

export interface ChecklistSectionProps {
  title: string;
  listType: ChecklistType;
  items: ChecklistItem[];
  progress?: SectionProgress;
  isEditMode: boolean;
  emptyMessage?: string;
  headerTrailing?: React.ReactNode;
  onToggleItem: (id: string) => Promise<ChecklistItem | null> | void;
  onRenameItem: (id: string, newTitle: string) => Promise<ChecklistItem | null> | void;
  onDeleteItem: (id: string) => Promise<boolean> | void;
  onReorderItem: (id: string, newSortOrder: number) => Promise<ChecklistItem | null> | void;
  onAddItem: (listType: ChecklistType, title: string) => Promise<ChecklistItem> | void;
  isSwipeable?: boolean;
  accent?: SectionAccent;
  className?: string;
}

const LIST_TYPE_ACCENT: Record<ChecklistType, SectionAccent> = {
  today_morning: 'amber',
  today_work: 'cyan',
  today_evening: 'purple',
  work: 'emerald',
};

const CARD_ACCENT_STYLES: Record<
  SectionAccent,
  {
    cardTint: string;
    topBar: string;
    addBtn: string;
    plusIcon: string;
  }
> = {
  amber: {
    cardTint:
      'border-[#F59E0B]/25 dark:border-[#F59E0B]/25 bg-gradient-to-b from-[#FEF3C7]/45 via-white/75 to-white/70 dark:from-[#F59E0B]/[0.09] dark:via-[#141828]/80 dark:to-[#101422]/85',
    topBar: 'bg-gradient-to-r from-[#F59E0B] via-[#FB923C] to-transparent',
    addBtn: 'bg-gradient-to-r from-[#F59E0B] to-[#F97316] text-white shadow-sm',
    plusIcon: 'text-[#F59E0B]',
  },
  cyan: {
    cardTint:
      'border-[#0EA5E9]/25 dark:border-[#38BDF8]/25 bg-gradient-to-b from-[#E0F2FE]/50 via-white/75 to-white/70 dark:from-[#0EA5E9]/[0.09] dark:via-[#141828]/80 dark:to-[#101422]/85',
    topBar: 'bg-gradient-to-r from-[#0EA5E9] via-[#6366F1] to-transparent',
    addBtn: 'bg-gradient-to-r from-[#0EA5E9] to-[#3B82F6] text-white shadow-sm',
    plusIcon: 'text-[#0EA5E9]',
  },
  purple: {
    cardTint:
      'border-[#A855F7]/25 dark:border-[#C084FC]/25 bg-gradient-to-b from-[#F3E8FF]/50 via-white/75 to-white/70 dark:from-[#A855F7]/[0.09] dark:via-[#141828]/80 dark:to-[#101422]/85',
    topBar: 'bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-transparent',
    addBtn: 'bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-sm',
    plusIcon: 'text-[#A855F7]',
  },
  emerald: {
    cardTint:
      'border-[#10B981]/25 dark:border-[#34D399]/25 bg-gradient-to-b from-[#D1FAE5]/45 via-white/75 to-white/70 dark:from-[#10B981]/[0.09] dark:via-[#141828]/80 dark:to-[#101422]/85',
    topBar: 'bg-gradient-to-r from-[#10B981] via-[#06B6D4] to-transparent',
    addBtn: 'bg-gradient-to-r from-[#10B981] to-[#06B6D4] text-white shadow-sm',
    plusIcon: 'text-[#10B981]',
  },
};

// Dedicated wrapper component so useDragControls is called inside each Reorder.Item
const ReorderItemWrapper: React.FC<{
  item: ChecklistItem;
  isEditMode: boolean;
  isLast: boolean;
  isSwipeable: boolean;
  accent: SectionAccent;
  onToggle: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}> = ({ item, isEditMode, isLast, isSwipeable, accent, onToggle, onRename, onDelete }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={false}
      dragControls={dragControls}
      className="relative list-none m-0 p-0"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 50,
      }}
    >
      <ChecklistItemRow
        item={item}
        isEditMode={isEditMode}
        onToggle={onToggle}
        onRename={onRename}
        onDelete={onDelete}
        isLast={isLast}
        dragControls={dragControls}
        isSwipeable={isSwipeable}
        accent={accent}
      />
    </Reorder.Item>
  );
};

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  title,
  listType,
  items,
  progress,
  isEditMode,
  emptyMessage = 'No items yet. Tap + to add.',
  headerTrailing,
  onToggleItem,
  onRenameItem,
  onDeleteItem,
  onReorderItem,
  onAddItem,
  isSwipeable = true,
  accent,
  className = '',
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveAccent: SectionAccent = accent ?? LIST_TYPE_ACCENT[listType];
  const cardStyle = CARD_ACCENT_STYLES[effectiveAccent];

  // Trigger quick add from SectionHeader (+) or empty state tap
  const handleStartAdd = useCallback(() => {
    if (isEditMode) return;
    setIsAdding(true);
    triggerHaptic('light');
    setTimeout(() => addInputRef.current?.focus(), 50);
  }, [isEditMode]);

  // Handle drag reordering with fractional indexing
  const handleReorder = useCallback(
    async (newOrderedItems: ChecklistItem[]) => {
      if (items.length !== newOrderedItems.length) return;

      // Identify which item moved
      let movedItemId: string | null = null;
      let newIdx = -1;

      for (let i = 0; i < newOrderedItems.length; i++) {
        const item = newOrderedItems[i];
        if (!item) continue;
        const oldIdx = items.findIndex((x) => x.id === item.id);
        if (oldIdx !== i) {
          movedItemId = item.id;
          newIdx = i;
          break;
        }
      }

      if (!movedItemId || newIdx === -1) return;

      const prevItem = newIdx > 0 ? newOrderedItems[newIdx - 1] : undefined;
      const nextItem = newIdx < newOrderedItems.length - 1 ? newOrderedItems[newIdx + 1] : undefined;
      const prevOrder = prevItem ? prevItem.sort_order : null;
      const nextOrder = nextItem ? nextItem.sort_order : null;

      const newSortOrder = calculateNewSortOrder(prevOrder, nextOrder);
      await onReorderItem(movedItemId, newSortOrder);
    },
    [items, onReorderItem]
  );

  // Commit new item creation
  const handleCreateItem = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    triggerHaptic('light');
    try {
      await onAddItem(listType, trimmed);
      setNewTitle('');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  }, [listType, newTitle, onAddItem]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleCreateItem();
    },
    [handleCreateItem]
  );

  return (
    <section aria-label={title} className={`flex flex-col gap-1.5 ${className}`}>
      {/* ── Section Header ─────────────────────────────────────────────── */}
      <SectionHeader
        title={title}
        completed={progress?.completed}
        total={progress?.total}
        showProgress={Boolean(progress)}
        onAddItem={handleStartAdd}
        isEditMode={isEditMode}
        accent={effectiveAccent}
        actionSlot={headerTrailing}
      />

      {/* ── Inset Grouped Card ─────────────────────────────────────────── */}
      <GlassContainer
        variant="card"
        className={`overflow-hidden p-0 rounded-[18px] ${cardStyle.cardTint}`}
      >
        {/* Subtle Luminous Top Accent Line */}
        <div className={`h-[2px] w-full opacity-75 ${cardStyle.topBar}`} aria-hidden="true" />

        {items.length === 0 && !isAdding ? (
          <div
            onClick={handleStartAdd}
            className="py-5 px-4 text-center cursor-pointer hover:bg-white/40 dark:hover:bg-white/[0.03] transition-colors"
          >
            <p className="text-[15px] text-[var(--secondary-label)] italic">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={handleReorder}
            className="flex flex-col m-0 p-0"
          >
            {items.map((item, index) => (
              <ReorderItemWrapper
                key={item.id}
                item={item}
                isEditMode={isEditMode}
                isLast={index === items.length - 1 && !isAdding}
                isSwipeable={isSwipeable}
                accent={effectiveAccent}
                onToggle={onToggleItem}
                onRename={onRenameItem}
                onDelete={onDeleteItem}
              />
            ))}
          </Reorder.Group>
        )}

        {/* ── Inline Quick Add Form (Only shown when actively adding) ───── */}
        {isAdding && (
          <form
            onSubmit={handleSubmit}
            className={`flex items-center min-h-[52px] px-4 gap-2 bg-white/80 dark:bg-white/[0.05] ${
              items.length > 0 ? 'border-t border-[var(--separator)]' : ''
            }`}
          >
            <Plus className={`w-5 h-5 shrink-0 ${cardStyle.plusIcon}`} />
            <input
              ref={addInputRef}
              type="text"
              aria-label={`New item for ${title}`}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewTitle('');
                }
              }}
              placeholder="New item…"
              autoFocus
              className="flex-1 bg-transparent text-[17px] leading-[22px] text-[var(--label)] outline-none border-none p-0 m-0"
              style={{ fontSize: '17px' }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                }}
                className="min-h-[36px] px-2.5 rounded-full text-[14px] font-medium text-[var(--secondary-label)] hover:text-[var(--label)] bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className={`min-h-[36px] min-w-[44px] px-3.5 rounded-full text-[14px] font-semibold disabled:opacity-30 transition-opacity border-none cursor-pointer ${cardStyle.addBtn}`}
              >
                Add
              </button>
            </div>
          </form>
        )}
      </GlassContainer>
    </section>
  );
};

export default ChecklistSection;
