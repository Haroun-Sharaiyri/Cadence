/**
 * src/App.tsx
 * Cadence Root Application & Layout Orchestrator.
 * Full integration of useChecklist, Bottom Sheets, Goal Hero, Section Lists, and Live Cloud Sync.
 */

import React, { useState, useRef, Suspense, lazy } from 'react';
import { useIsDesktop } from './hooks/useMediaQuery';
import type { TabId } from './components/common/FloatingTabBar';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { formatHeaderDate } from './utils/time';
import { useChecklist } from './hooks/useChecklist';
import { useDoneCelebration } from './hooks/useDoneCelebration';
import { useSyncState } from './hooks/useSyncState';
import { signOut, getCurrentUser } from './sync/supabaseClient';
import { syncEngine } from './sync/syncEngine';
import { Settings as SettingsIcon } from 'lucide-react';
import { GoalHeroCard } from './components/goal/GoalHeroCard';
import { ClearCompletedTrigger } from './components/sheets/ClearCompletedTrigger';
import { ChecklistSection } from './components/checklist/ChecklistSection';
import { WorkStrategyPad } from './components/work/WorkStrategyPad';

const GoalEditorSheet = lazy(() => import('./components/sheets/GoalEditorSheet'));
const SettingsSheet = lazy(() => import('./components/sheets/SettingsSheet'));
const AuthModal = lazy(() => import('./components/auth/AuthModal'));
const ClearCompletedSheet = lazy(() => import('./components/sheets/ClearCompletedSheet'));

export const App: React.FC = () => {
  const isDesktop = useIsDesktop();
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState<boolean>(false);
  const [isClearCompletedOpen, setIsClearCompletedOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [mountedSheets, setMountedSheets] = useState({
    goal: false,
    settings: false,
    auth: false,
    clear: false,
  });

  // Scroll container ref for mobile collapsing navigation
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Live Sync Engine & Auth State Hook
  const { isOnline, isSyncing, user, isGuest, fallbackMode } = useSyncState();

  // Primary reactive store hook
  const {
    morningItems,
    todayWorkItems,
    eveningItems,
    workItems,
    goal,
    countdown,
    settings,
    morningProgress,
    todayWorkProgress,
    eveningProgress,
    dayProgress,
    completedWorkCount,
    addItem,
    toggleItem,
    renameItem,
    reorderItem,
    deleteItem,
    clearCompletedWork,
    updateGoal,
    setRolloverHour,
  } = useChecklist();

  // Restrained ambient celebration coordinator
  const { isDayShimmering } = useDoneCelebration({
    dayProgress,
    morningProgress,
    workProgress: todayWorkProgress,
    eveningProgress,
  });

  const toggleEditMode = () => setIsEditMode((prev) => !prev);
  const openSettings = () => {
    setMountedSheets((prev) => (prev.settings ? prev : { ...prev, settings: true }));
    setIsSettingsOpen(true);
  };
  const openGoalEditor = () => {
    setMountedSheets((prev) => (prev.goal ? prev : { ...prev, goal: true }));
    setIsGoalEditorOpen(true);
  };
  const openClearCompleted = () => {
    setMountedSheets((prev) => (prev.clear ? prev : { ...prev, clear: true }));
    setIsClearCompletedOpen(true);
  };

  const handleOpenAuth = () => {
    setIsSettingsOpen(false);
    setMountedSheets((prev) => (prev.auth ? prev : { ...prev, auth: true }));
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Goal Hero Card instance
  const goalHeroElement = (
    <GoalHeroCard
      goal={goal}
      countdown={countdown}
      isDayComplete={dayProgress.isAllCompleted}
      isShimmering={dayProgress.isAllCompleted && isDayShimmering}
      onOpenEditor={openGoalEditor}
    />
  );

  // Today tab routine lists
  const todaySectionsContent = (
    <div className="flex flex-col gap-4">
      {/* Morning Routine */}
      <ChecklistSection
        title="Morning Routine"
        listType="today_morning"
        items={morningItems}
        progress={morningProgress}
        isEditMode={isEditMode}
        isSwipeable={true}
        emptyMessage="No morning habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      {/* Work Day Routine */}
      <ChecklistSection
        title="Work Day"
        listType="today_work"
        items={todayWorkItems}
        progress={todayWorkProgress}
        isEditMode={isEditMode}
        isSwipeable={true}
        emptyMessage="No work habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      {/* Evening Routine */}
      <ChecklistSection
        title="Evening Routine"
        listType="today_evening"
        items={eveningItems}
        progress={eveningProgress}
        isEditMode={isEditMode}
        isSwipeable={true}
        emptyMessage="No evening habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />
    </div>
  );

  // Work tab persistent tasks list + Strategy & Brainstorm pad
  const workSectionContent = (
    <div className="flex flex-col gap-5">
      <ChecklistSection
        title="Work Tasks"
        listType="work"
        items={workItems}
        isEditMode={isEditMode}
        isSwipeable={true}
        emptyMessage="No tasks yet. Tap + to add work tasks."
        headerTrailing={
          <ClearCompletedTrigger
            completedCount={completedWorkCount}
            onOpenConfirm={openClearCompleted}
          />
        }
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      {/* Dedicated Writing, Brainstorming & Strategy Pad (Work Checklist Only) */}
      <WorkStrategyPad />
    </div>
  );

  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden app-aurora-bg text-[var(--label)] flex flex-col select-none">
      {isDesktop ? (
        /* ── Desktop View (>= 1024px) ─────────────────────────────────── */
        <div className="h-full w-full overflow-y-auto">
          <DesktopLayout
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            isOnline={isOnline}
            isSyncing={isSyncing}
            isGuest={isGuest}
            fallbackMode={fallbackMode}
            goalHeroSlot={goalHeroElement}
            todaySlot={todaySectionsContent}
            workSlot={workSectionContent}
          />
        </div>
      ) : (
        /* ── Mobile View (< 1024px) - Full Display ───────────────────── */
        <div className="relative h-full w-full flex flex-col overflow-hidden">
          {/* Native Momentum Scroll Container - Edge-to-Edge Full Display */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
            }}
          >
            {/* Fluid In-Flow Header (No fixed header/footer blocks) */}
            <div className="pt-2 pb-4 flex flex-col gap-3">
              {/* Header Top Row: Date, App Name, Settings Action */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--secondary-label)]">
                    {formatHeaderDate()}
                  </div>
                  <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--label)] leading-tight">
                    Cadence
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Settings and sync"
                    onClick={openSettings}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 active:scale-95 transition-all text-[var(--secondary-label)] hover:text-[var(--label)] border border-black/5 dark:border-white/10 backdrop-blur-md cursor-pointer"
                  >
                    <SettingsIcon className="w-5 h-5 stroke-[1.8]" />
                  </button>
                </div>
              </div>

              {/* Seamless Segmented Control: [ Today | Work ] */}
              <div className="flex items-center p-1 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-lg border border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('today')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'today'
                      ? 'bg-white dark:bg-white/20 text-[var(--label)] shadow-sm'
                      : 'text-[var(--secondary-label)] hover:text-[var(--label)]'
                  }`}
                >
                  <span>Today</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('work')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'work'
                      ? 'bg-white dark:bg-white/20 text-[var(--label)] shadow-sm'
                      : 'text-[var(--secondary-label)] hover:text-[var(--label)]'
                  }`}
                >
                  <span>Work</span>
                </button>
              </div>
            </div>

            {/* Seamless Content Flow */}
            {activeTab === 'today' ? (
              <div className="flex flex-col gap-4 pb-2">
                {goalHeroElement}
                {todaySectionsContent}
              </div>
            ) : (
              <div className="flex flex-col gap-4 pb-2">
                {workSectionContent}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Global Bottom Sheets & Modals (Code-Split via React.lazy) ──── */}
      <Suspense fallback={null}>
        {/* 1. Goal Editor Sheet */}
        {(mountedSheets.goal || isGoalEditorOpen) && (
          <GoalEditorSheet
            isOpen={isGoalEditorOpen}
            onClose={() => setIsGoalEditorOpen(false)}
            currentStatement={goal?.statement}
            currentTargetDate={goal?.target_date}
            onSave={async (stmt, date) => {
              await updateGoal(stmt, date);
              setIsGoalEditorOpen(false);
            }}
            onClear={async () => {
              await updateGoal('', null);
              setIsGoalEditorOpen(false);
            }}
          />
        )}

        {/* 2. Settings Sheet */}
        {(mountedSheets.settings || isSettingsOpen) && (
          <SettingsSheet
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            rolloverHour={settings.rollover_hour}
            onUpdateRolloverHour={setRolloverHour}
            userEmail={user?.email ?? null}
            onSignInClick={handleOpenAuth}
            onSignOutClick={handleSignOut}
            isOnline={isOnline}
            fallbackMode={fallbackMode}
          />
        )}

        {/* 3. Auth Modal (6-Digit Email OTP) */}
        {(mountedSheets.auth || isAuthModalOpen) && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={async () => {
              const u = await getCurrentUser();
              if (u) {
                await syncEngine.migrateLocalDataToUser(u.id);
                await syncEngine.triggerSync();
              }
            }}
          />
        )}

        {/* 4. Clear Completed Work Confirmation Sheet */}
        {(mountedSheets.clear || isClearCompletedOpen) && (
          <ClearCompletedSheet
            isOpen={isClearCompletedOpen}
            onClose={() => setIsClearCompletedOpen(false)}
            completedCount={completedWorkCount}
            onConfirm={async () => {
              await clearCompletedWork();
              setIsClearCompletedOpen(false);
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

export default App;
