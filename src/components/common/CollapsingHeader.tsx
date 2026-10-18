import React from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Settings as SettingsIcon } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export interface CollapsingHeaderProps {
  title: string;
  subtitle?: string;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onOpenSettings: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const CollapsingHeader: React.FC<CollapsingHeaderProps> = ({
  title,
  subtitle,
  onOpenSettings,
  scrollContainerRef,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Bind Framer Motion scroll tracker to scrollContainerRef or window
  const { scrollY } = useScroll(
    scrollContainerRef ? { container: scrollContainerRef } : {}
  );

  // Optical transitions
  // 1. Navigation bar glazed background opacity: 0 at scroll 0, 1 by scroll 36px
  const navBgOpacity = useTransform(scrollY, [0, 36], [0, 1]);
  // 2. Hairline bottom separator opacity: 0 at scroll 10px, 1 by scroll 44px
  const separatorOpacity = useTransform(scrollY, [10, 44], [0, 1]);
  // 3. Inline centered title: fades in between 24px and 48px
  const inlineTitleOpacity = useTransform(scrollY, [24, 48], [0, 1]);
  const inlineTitleY = useTransform(scrollY, [24, 48], [6, 0]);
  // 4. Large title: fades out between 0px and 38px
  const largeTitleOpacity = useTransform(scrollY, [0, 38], [1, 0]);

  const handleSettingsOpen = () => {
    triggerHaptic('light');
    onOpenSettings();
  };

  return (
    <>
      {/* ── Fixed Glazed Top Navigation Bar ─────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 select-none"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Dynamic Glass Backdrop */}
        <motion.div
          className="absolute inset-0 bg-[var(--nav-bar-bg)] backdrop-blur-[24px] backdrop-saturate-[190%]"
          style={{ opacity: shouldReduceMotion ? 1 : navBgOpacity }}
        />

        {/* Dynamic Hairline Separator */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[0.5px] bg-[var(--separator)]"
          style={{ opacity: shouldReduceMotion ? 1 : separatorOpacity }}
        />

        {/* Navigation Content Bar (44px height) */}
        <div className="relative h-[44px] px-4 flex items-center justify-between">
          {/* Leading slot: empty spacer for balance */}
          <div className="w-[80px] flex items-center justify-start" />

          {/* Centered Inline Title (17px Headline) */}
          <motion.div
            className="flex-1 text-center font-semibold text-[17px] text-[var(--label)] tracking-[-0.41px] truncate pointer-events-none"
            style={{
              opacity: shouldReduceMotion ? 1 : inlineTitleOpacity,
              y: shouldReduceMotion ? 0 : inlineTitleY,
            }}
          >
            {title}
          </motion.div>

          {/* Trailing Controls: Settings Gear */}
          <div className="w-[80px] flex items-center justify-end">
            <button
              type="button"
              onClick={handleSettingsOpen}
              aria-label="Settings"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--label)] active:opacity-60 transition-opacity"
            >
              <SettingsIcon className="w-[20px] h-[20px] stroke-[2]" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Scrollable Large Title Slot ─────────────────────────────────── */}
      <motion.div
        className="pt-1 pb-3 select-none"
        style={{ opacity: shouldReduceMotion ? 1 : largeTitleOpacity }}
      >
        {subtitle && (
          <div className="text-[13px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)] mb-0.5">
            {subtitle}
          </div>
        )}
        <h1 className="text-[34px] leading-[41px] font-bold tracking-[+0.37px] text-[var(--label)]">
          {title}
        </h1>
      </motion.div>
    </>
  );
};
