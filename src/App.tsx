import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleExclamation,
  faCloud,
  faCloudArrowUp,
  faEye,
  faHardDrive,
  faLeaf,
  faRotate,
} from '@fortawesome/free-solid-svg-icons';
import type { Session } from '@supabase/supabase-js';
import { BottomNavigation } from './components/BottomNavigation';
import {
  CloudPanel,
  type CloudMode,
  type CloudStatus,
} from './components/CloudPanel';
import { BookingsPage } from './features/BookingsPage';
import { ExpensePage } from './features/ExpensePage';
import { PlanningPage } from './features/PlanningPage';
import { PhotosPage } from './features/PhotosPage';
import { SchedulePage } from './features/SchedulePage';
import {
  ensureMediaUploaded,
  friendlyCloudError,
  hydrateCloudState,
  mergeStoragePaths,
  serializeCloudSeed,
  serializeCloudState,
} from './lib/cloud';
import { loadTravelState, saveTravelState } from './lib/storage';
import { supabase } from './lib/supabase';
import type { AppTab, ChecklistKind, TravelState } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('schedule');
  const [state, setState] = useState<TravelState>(() => loadTravelState());
  const [storageError, setStorageError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudPanelOpen, setCloudPanelOpen] = useState(false);
  const [cloudMode, setCloudMode] = useState<CloudMode>('local');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('idle');
  const [cloudError, setCloudError] = useState('');
  const [cloudTripId, setCloudTripId] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<string[]>([]);

  const stateRef = useRef(state);
  const localBackupRef = useRef(state);
  const editableRef = useRef(true);
  const cloudTripIdRef = useRef<string | null>(null);
  const previousModeRef = useRef<CloudMode>('local');
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const readOnly = cloudMode === 'viewer';

  useEffect(() => {
    stateRef.current = state;
    editableRef.current = !readOnly;
    if (readOnly) return;
    try {
      saveTravelState(state);
      localBackupRef.current = state;
      setStorageError('');
    } catch {
      setStorageError('本機儲存空間不足。新修改目前仍在畫面上，但重新整理後可能不會保留。');
    }
  }, [readOnly, state]);

  const loadFamilyMembers = useCallback(async (tripId: string) => {
    const { data, error } = await supabase
      .from('trip_members')
      .select('email')
      .eq('trip_id', tripId)
      .order('email');
    if (error) throw error;
    setFamilyMembers((data ?? []).map((item) => item.email));
  }, []);

  const loadCloudTrip = useCallback(async (userId: string) => {
    setCloudStatus('loading');
    setCloudError('');
    setCloudReady(false);

    try {
      const { data, error } = await supabase
        .from('trips')
        .select('id, owner_id, state')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        cloudTripIdRef.current = null;
        setCloudTripId(null);
        setCloudMode('local');
        previousModeRef.current = 'local';
        setFamilyMembers([]);
        setCloudStatus('idle');
        return;
      }

      const mode: CloudMode = data.owner_id === userId ? 'owner' : 'viewer';
      const hydrated = await hydrateCloudState(data.state);
      cloudTripIdRef.current = data.id;
      setCloudTripId(data.id);
      setCloudMode(mode);
      previousModeRef.current = mode;
      setState(hydrated);
      if (mode === 'owner') await loadFamilyMembers(data.id);
      else setFamilyMembers([]);
      setCloudReady(true);
      setCloudStatus('saved');
    } catch (error) {
      setCloudStatus('error');
      setCloudError(friendlyCloudError(error, '未能載入雲端旅程，請稍後再試。'));
    }
  }, [loadFamilyMembers]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setCloudError('未能讀取登入狀態，請重新登入。');
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!session) {
      if (previousModeRef.current === 'viewer') setState(localBackupRef.current);
      cloudTripIdRef.current = null;
      setCloudTripId(null);
      setCloudMode('local');
      previousModeRef.current = 'local';
      setCloudReady(false);
      setFamilyMembers([]);
      setCloudStatus('idle');
      return;
    }
    void loadCloudTrip(session.user.id);
  }, [authReady, loadCloudTrip, session]);

  const performCloudSave = useCallback(async (snapshot: TravelState, tripId: string) => {
    setCloudStatus('saving');
    setCloudError('');
    try {
      const needsPathMerge = snapshot.photos.some((item) => !item.storagePath)
        || snapshot.vouchers.some((item) => !item.storagePath);
      const uploaded = await ensureMediaUploaded(snapshot, tripId);
      const { data, error } = await supabase
        .from('trips')
        .update({
          title: uploaded.trip.title,
          state: serializeCloudState(uploaded),
        })
        .eq('id', tripId)
        .select('id, state')
        .single();
      if (error) throw error;
      if (!data || typeof data.state !== 'object' || data.state === null) {
        throw new Error('雲端資料讀回確認失敗。');
      }
      if (needsPathMerge) {
        setState((current) => mergeStoragePaths(current, uploaded));
      }
      setCloudStatus('saved');
    } catch (error) {
      setCloudStatus('error');
      setCloudError(friendlyCloudError(error, '雲端同步失敗；本機後備仍然保留。'));
      throw error;
    }
  }, []);

  const queueCloudSave = useCallback((snapshot: TravelState) => {
    const tripId = cloudTripIdRef.current;
    if (!tripId) return Promise.reject(new Error('未建立雲端旅程。'));
    const next = saveChainRef.current
      .catch(() => undefined)
      .then(() => performCloudSave(snapshot, tripId));
    saveChainRef.current = next;
    return next;
  }, [performCloudSave]);

  useEffect(() => {
    if (cloudMode !== 'owner' || !cloudReady || !cloudTripId) return;
    const timer = window.setTimeout(() => {
      void queueCloudSave(state).catch(() => undefined);
    }, 1_400);
    return () => window.clearTimeout(timer);
  }, [cloudMode, cloudReady, cloudTripId, queueCloudSave, state]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'read_trip_summary',
          title: '查看旅程摘要',
          description: '讀取旅程日期、目的地和目前支出摘要，不會修改資料。',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            const current = stateRef.current;
            return {
              title: current.trip.title,
              startDate: current.trip.startDate,
              endDate: current.trip.endDate,
              destinations: current.trip.destinations,
              expenseCount: current.expenses.length,
            };
          },
        },
        { signal: lifecycle.signal },
      );

      await context.registerTool(
        {
          name: 'add_checklist_item',
          title: '加入準備清單',
          description: '把一項新內容加入待辦或購物清單，並更新畫面和儲存資料。',
          inputSchema: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['todo', 'shopping'] },
              text: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['kind', 'text'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            if (!editableRef.current) throw new Error('家庭帳戶只可查看，不能修改。');
            const value = input as { kind?: unknown; text?: unknown };
            if (
              !['todo', 'shopping'].includes(String(value.kind))
              || typeof value.text !== 'string'
              || !value.text.trim()
            ) {
              throw new Error('清單類別或內容無效。');
            }
            const kind = value.kind as ChecklistKind;
            const item = { id: crypto.randomUUID(), text: value.text.trim(), done: false };
            setState((current) => ({
              ...current,
              checklists: {
                ...current.checklists,
                [kind]: [...current.checklists[kind], item],
              },
            }));
            setActiveTab('planning');
            return { status: 'added', kind, itemId: item.id };
          },
        },
        { signal: lifecycle.signal },
      );
    };

    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const updateBookings = (
    patch: Partial<Pick<TravelState, 'flight' | 'accommodation' | 'carRental' | 'vouchers'>>,
  ) => {
    if (!readOnly) setState((current) => ({ ...current, ...patch }));
  };

  const updateSchedule = (
    patch: Partial<Pick<TravelState, 'trip' | 'itinerary' | 'weather'>>,
  ) => {
    if (!readOnly) setState((current) => ({ ...current, ...patch }));
  };

  const updateExpenseData = (
    patch: Partial<Pick<TravelState, 'trip' | 'expenses'>>,
  ) => {
    if (!readOnly) setState((current) => ({ ...current, ...patch }));
  };

  const toggleChecklist = (kind: ChecklistKind, itemId: string) => {
    if (readOnly) return;
    setState((current) => ({
      ...current,
      checklists: {
        ...current.checklists,
        [kind]: current.checklists[kind].map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        ),
      },
    }));
  };

  const addChecklist = (kind: ChecklistKind, text: string) => {
    if (readOnly) return;
    setState((current) => ({
      ...current,
      checklists: {
        ...current.checklists,
        [kind]: [
          ...current.checklists[kind],
          { id: crypto.randomUUID(), text, done: false },
        ],
      },
    }));
  };

  const signIn = async (email: string, password: string) => {
    setCloudError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setCloudError(friendlyCloudError(error, '登入失敗，請檢查資料後再試。'));
      return '';
    }
    return '登入成功，正在載入旅程。';
  };

  const signUp = async (email: string, password: string) => {
    setCloudError('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href },
    });
    if (error) {
      setCloudError(friendlyCloudError(error, '未能建立帳戶，請稍後再試。'));
      return '';
    }
    return data.session
      ? '帳戶已建立，正在載入旅程。'
      : '帳戶已建立。請開啟 Supabase 確認電郵，再返回登入。';
  };

  const signOut = async () => {
    await saveChainRef.current.catch(() => undefined);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setCloudError('登出失敗，請稍後再試。');
      return;
    }
    setCloudPanelOpen(false);
  };

  const createCloudTrip = async () => {
    if (!session) return;
    const tripId = crypto.randomUUID();
    setCloudStatus('saving');
    setCloudError('');

    const { error } = await supabase.from('trips').insert({
      id: tripId,
      owner_id: session.user.id,
      title: stateRef.current.trip.title,
      state: serializeCloudSeed(stateRef.current),
    });
    if (error) {
      setCloudStatus('error');
      setCloudError(friendlyCloudError(error, '未能建立雲端旅程，本機資料冇受影響。'));
      return;
    }

    cloudTripIdRef.current = tripId;
    setCloudTripId(tripId);
    setCloudMode('owner');
    previousModeRef.current = 'owner';
    setCloudReady(false);
    try {
      await performCloudSave(stateRef.current, tripId);
      await loadFamilyMembers(tripId);
    } finally {
      setCloudReady(true);
    }
  };

  const saveNow = async () => {
    await queueCloudSave(stateRef.current).catch(() => undefined);
  };

  const refreshCloud = async () => {
    if (session) await loadCloudTrip(session.user.id);
  };

  const addFamilyMember = async (email: string) => {
    if (!cloudTripId || cloudMode !== 'owner') return;
    setCloudError('');
    const { error } = await supabase.from('trip_members').insert({
      trip_id: cloudTripId,
      email,
      role: 'viewer',
    });
    if (error) {
      setCloudError(friendlyCloudError(error, '未能加入家庭成員，請檢查電郵後再試。'));
      return;
    }
    try {
      await loadFamilyMembers(cloudTripId);
    } catch {
      setCloudError('成員已加入，但暫時未能重新載入名單。');
    }
  };

  const removeFamilyMember = async (email: string) => {
    if (!cloudTripId || cloudMode !== 'owner') return;
    setCloudError('');
    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', cloudTripId)
      .eq('email', email);
    if (error) {
      setCloudError('未能移除家庭成員，請稍後再試。');
      return;
    }
    try {
      await loadFamilyMembers(cloudTripId);
    } catch {
      setCloudError('成員已移除，但暫時未能重新載入名單。');
    }
  };

  const cloudBadge = (() => {
    if (!authReady || cloudStatus === 'loading') return { icon: faRotate, label: '連線中' };
    if (!session) return { icon: faCloudArrowUp, label: '登入分享' };
    if (cloudMode === 'viewer') return { icon: faEye, label: '家庭只讀' };
    if (cloudStatus === 'saving') return { icon: faRotate, label: '同步中' };
    if (cloudStatus === 'error') return { icon: faCircleExclamation, label: '同步失敗' };
    if (cloudMode === 'owner') return { icon: faCloud, label: '已同步' };
    return { icon: faHardDrive, label: '待上傳' };
  })();

  return (
    <div className="min-h-screen pb-32">
      <main className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="island-brand" aria-label="旅伴島手帳">
            <span className="island-brand-mark" aria-hidden="true">
              <FontAwesomeIcon icon={faLeaf} />
            </span>
            <span>
              <span className="island-brand-title">旅伴島手帳</span>
              <span className="island-brand-subtitle">TRIP JOURNAL</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCloudPanelOpen(true)}
            className="local-badge tap-feedback min-h-11 min-w-11 justify-center"
            aria-label={`${cloudBadge.label}；開啟雲端分享設定`}
          >
            <FontAwesomeIcon
              icon={cloudBadge.icon}
              className={cloudStatus === 'saving' || cloudStatus === 'loading' ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span className="hidden min-[360px]:inline">{cloudBadge.label}</span>
          </button>
        </div>

        {readOnly && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-earth-50 p-4 text-sm font-bold leading-6 text-earth-700" role="status">
            <FontAwesomeIcon icon={faEye} className="mt-1" aria-hidden="true" />
            家庭只讀模式：你可以查看旅程內容，但唔可以修改。
          </div>
        )}

        {storageError && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-clay-100 p-4 text-sm font-bold leading-6 text-clay-700" role="alert">
            <FontAwesomeIcon icon={faCircleExclamation} className="mt-1" aria-hidden="true" />
            {storageError}
          </div>
        )}

        <div key={activeTab} className="animate-fade-up">
          {activeTab === 'schedule' && <SchedulePage state={state} onUpdate={updateSchedule} readOnly={readOnly} />}
          {activeTab === 'bookings' && <BookingsPage state={state} onUpdate={updateBookings} readOnly={readOnly} />}
          {activeTab === 'expense' && <ExpensePage state={state} onUpdate={updateExpenseData} readOnly={readOnly} />}
          {activeTab === 'photos' && (
            <PhotosPage
              state={state}
              readOnly={readOnly}
              onUpdate={(photos) => {
                if (!readOnly) setState((current) => ({ ...current, photos }));
              }}
            />
          )}
          {activeTab === 'planning' && (
            <PlanningPage
              checklists={state.checklists}
              readOnly={readOnly}
              onToggle={toggleChecklist}
              onAdd={addChecklist}
            />
          )}
        </div>
      </main>

      <BottomNavigation active={activeTab} onChange={setActiveTab} />
      <CloudPanel
        open={cloudPanelOpen}
        user={session?.user ?? null}
        mode={cloudMode}
        status={cloudStatus}
        error={cloudError}
        members={familyMembers}
        onClose={() => setCloudPanelOpen(false)}
        onSignIn={signIn}
        onSignUp={signUp}
        onSignOut={signOut}
        onCreateCloudTrip={createCloudTrip}
        onSaveNow={saveNow}
        onRefresh={refreshCloud}
        onAddMember={addFamilyMember}
        onRemoveMember={removeFamilyMember}
      />
    </div>
  );
}

export default App;
