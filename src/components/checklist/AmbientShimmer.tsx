/**
 * src/components/checklist/AmbientShimmer.tsx
 * Single subtle ambient specular shimmer sweeping across glass cards upon day completion.
 * Fully supports prefers-reduced-motion with static glow cross-fade fallback.
 */

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export interface AmbientShimmerProps {
  /** Whether the shimmer trigger is active */
  active: boolean;
  /** Optional callback fired when the single sweep finishes */
  onComplete?: () => void;
  /** Custom class overrides */
  className?: string;
}

export const AmbientShimmer: React.FC<AmbientShimmerProps> = ({
  active,
  onComplete,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    if (active) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, 1300);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {isAnimating && (
        <div
          aria-hidden="true"
          className={clsx(
            'absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] z-10',
            className
          )}
        >
          {shouldReduceMotion ? (
            /* ── Reduced Motion Fallback: Soft in-place opacity pulse ── */
            <motion.div
              className="absolute inset-0 rounded-[inherit] bg-[var(--system-blue)]/10 border border-[var(--system-blue)]/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          ) : (
            /* ── Apple Liquid Glass Specular Shimmer Sweep ─────────── */
            <motion.div
              className="absolute top-0 bottom-0 w-[60%] -skew-x-12"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.28) 45%, rgba(50, 173, 230, 0.35) 55%, transparent 100%)',
              }}
              initial={{ left: '-70%' }}
              animate={{ left: '150%' }}
              transition={{
                duration: 1.25,
                ease: [0.25, 1, 0.5, 1], // iOS easeOutQuint
              }}
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default AmbientShimmer;
