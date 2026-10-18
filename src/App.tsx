/**
 * src/App.tsx
 * Cadence Root Application & Layout Orchestrator.
 * Full integration of useChecklist, Bottom Sheets, Goal Hero, Section Lists, and Live Cloud Sync.
 */

import React, { useState, useRef, Suspense, lazy } from 'react';
import { useIsDesktop } from './hooks/useMediaQuery';
import { CollapsingHeader } from './components/common/CollapsingHeader';
import { FloatingTabBar, type TabId } from './components/common/FloatingTabBar';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { formatHeaderDate } from './utils/time';
import { useChecklist } from './hooks/useChecklist';
import { useDoneCelebration } from './hooks/useDoneCelebration';
import { useSyncState } from './hooks/useSyncState';
import { signOut, getCurrentUser } from './sync/supabaseClient';
import { syncEngine } from './sync/syncEngine';
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
        /* ── Mobile View (< 1024px) ──────────────────────────────────── */
        <div className="relative h-full w-full flex flex-col">
          {/* Native Momentum Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 44px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 88px)',
            }}
          >
            {/* Collapsing Header Top Chrome */}
            <CollapsingHeader
              title={activeTab === 'today' ? 'Today' : 'Work'}
              subtitle={activeTab === 'today' ? formatHeaderDate() : undefined}
              isEditMode={isEditMode}
              onToggleEditMode={toggleEditMode}
              onOpenSettings={openSettings}
              scrollContainerRef={scrollContainerRef}
            />

            {activeTab === 'today' ? (
              <div className="flex flex-col gap-4">
                {goalHeroElement}
                {todaySectionsContent}
              </div>
            ) : (
              workSectionContent
            )}
          </div>

          {/* Floating Glass Capsule Tab Bar */}
          <FloatingTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
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
