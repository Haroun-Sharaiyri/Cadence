import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Briefcase } from 'lucide-react';
import { SPRING_PRESETS, REDUCED_MOTION_TRANSITION } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

export type TabId = 'today' | 'work';

export interface FloatingTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'work', label: 'Work', icon: Briefcase },
];

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const handleTabClick = (tabId: TabId) => {
    if (tabId !== activeTab) {
      triggerHaptic('selection');
      onTabChange(tabId);
    }
  };

  return (
    <nav
      role="tablist"
      aria-label="Primary navigation"
      className="fixed left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 20px) + 12px)',
      }}
    >
      {/* Floating Capsule Glass Container */}
      <div
        className="w-[260px] h-[56px] rounded-full p-[4px] flex items-center justify-around relative
                   bg-[var(--tab-bar-bg)] backdrop-blur-[28px] backdrop-saturate-[200%]
                   border border-[var(--tab-bar-border)] shadow-[var(--tab-bar-shadow)]
                   after:content-[''] after:absolute after:inset-0 after:rounded-full after:pointer-events-none
                   after:shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.45)] dark:after:shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.14)]"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleTabClick(tab.id)}
              className="relative flex-1 h-full min-h-[44px] flex flex-col items-center justify-center rounded-full z-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)]"
            >
              {/* Sliding Active Pill Background Highlight */}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-full bg-[var(--tab-active-indicator)] z-[-1]"
                  transition={
                    shouldReduceMotion
                      ? REDUCED_MOTION_TRANSITION
                      : SPRING_PRESETS.tabIndicator
                  }
                />
              )}

              {/* Tab Icon */}
              <Icon
                className={`w-[20px] h-[20px] mb-[2px] transition-colors duration-150 ${
                  isActive
                    ? 'text-[var(--system-blue)] stroke-[2.2]'
                    : 'text-[var(--secondary-label)] stroke-[1.8]'
                }`}
              />

              {/* Tab Label */}
              <span
                className={`text-[11px] leading-[13px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-[var(--system-blue)] font-semibold'
                    : 'text-[var(--secondary-label)]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
