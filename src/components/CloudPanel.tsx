import { useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRotateRight,
  faCloudArrowUp,
  faEnvelope,
  faEye,
  faFloppyDisk,
  faRightFromBracket,
  faShieldHeart,
  faTrashCan,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons';
import type { User } from '@supabase/supabase-js';
import { Dialog } from './Dialog';

export type CloudMode = 'local' | 'owner' | 'viewer';
export type CloudStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

interface CloudPanelProps {
  open: boolean;
  user: User | null;
  mode: CloudMode;
  status: CloudStatus;
  error: string;
  members: string[];
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<string>;
  onSignUp: (email: string, password: string) => Promise<string>;
  onSignOut: () => Promise<void>;
  onCreateCloudTrip: () => Promise<void>;
  onSaveNow: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onAddMember: (email: string) => Promise<void>;
  onRemoveMember: (email: string) => Promise<void>;
}

const fieldClass = 'form-field';

export function CloudPanel({
  open,
  user,
  mode,
  status,
  error,
  members,
  onClose,
  onSignIn,
  onSignUp,
  onSignOut,
  onCreateCloudTrip,
  onSaveNow,
  onRefresh,
  onAddMember,
  onRemoveMember,
}: CloudPanelProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setNotice('');
    try {
      const message = authMode === 'signin'
        ? await onSignIn(email.trim(), password)
        : await onSignUp(email.trim(), password);
      setNotice(message);
      if (authMode === 'signin') setPassword('');
    } catch {
      setNotice('暫時未能連線，請稍後再試。');
    } finally {
      setWorking(false);
    }
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = memberEmail.trim().toLowerCase();
    if (!normalized) return;
    setWorking(true);
    try {
      await onAddMember(normalized);
      setMemberEmail('');
    } catch {
      setNotice('未能更新家庭成員，請稍後再試。');
    } finally {
      setWorking(false);
    }
  };

  const run = async (action: () => Promise<void>) => {
    setWorking(true);
    try {
      await action();
    } catch {
      // Parent action displays the specific cloud error in this panel.
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} title="雲端分享" onClose={onClose} panelClassName="sm:max-w-xl">
      {!user ? (
        <div className="space-y-5">
          <div className="rounded-3xl bg-forest-50 p-4 text-sm font-semibold leading-6 text-forest-800">
            <FontAwesomeIcon icon={faShieldHeart} className="mr-2" aria-hidden="true" />
            登入後先由你確認上傳；現有本機資料唔會自動離開呢部裝置。
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-canvas p-1.5" role="tablist" aria-label="登入或註冊">
            {(['signin', 'signup'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={authMode === item}
                onClick={() => {
                  setAuthMode(item);
                  setNotice('');
                }}
                className={`tap-feedback min-h-11 rounded-xl text-sm font-black ${
                  authMode === item ? 'bg-forest-700 text-white shadow-soft-sm' : 'text-muted'
                }`}
              >
                {item === 'signin' ? '登入' : '建立帳戶'}
              </button>
            ))}
          </div>

          <form onSubmit={submitAuth} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">電郵</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClass}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">密碼</span>
              <input
                type="password"
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={fieldClass}
                required
              />
            </label>
            <button
              type="submit"
              disabled={working}
              className="tap-feedback min-h-12 w-full rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800 disabled:cursor-wait disabled:opacity-60"
            >
              {working ? '處理中…' : authMode === 'signin' ? '登入' : '建立帳戶'}
            </button>
          </form>

          {(notice || error) && (
            <p className={`rounded-2xl p-3 text-sm font-bold leading-6 ${
              error ? 'bg-clay-100 text-clay-700' : 'bg-earth-50 text-earth-700'
            }`} role="status">
              {error || notice}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-100 text-forest-700">
              <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">已登入</p>
              <p className="truncate font-black text-forest-800">{user.email}</p>
            </div>
          </div>

          {status === 'loading' ? (
            <p className="rounded-3xl bg-forest-50 p-5 text-center font-bold text-forest-800">載入雲端旅程中…</p>
          ) : mode === 'local' ? (
            <div className="space-y-4">
              <div className="rounded-3xl border-2 border-earth-300 bg-earth-50 p-4">
                <h3 className="font-black text-forest-800">首次上傳本機資料</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  按下面按鈕後，行程、預訂、記帳、清單、相片及憑證先會上傳。成功讀回確認前，本機後備會一直保留。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void run(onCreateCloudTrip)}
                disabled={working}
                className="tap-feedback flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800 disabled:cursor-wait disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden="true" />
                確認上傳並開始同步
              </button>
            </div>
          ) : mode === 'viewer' ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-earth-50 p-4 text-earth-700">
                <h3 className="font-black"><FontAwesomeIcon icon={faEye} className="mr-2" />家庭只讀模式</h3>
                <p className="mt-2 text-sm font-semibold leading-6">你可以查看所有旅程資料及相片，但唔可以修改。</p>
              </div>
              <button
                type="button"
                onClick={() => void run(onRefresh)}
                disabled={working}
                className="tap-feedback flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-4 font-black text-white disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faArrowRotateRight} aria-hidden="true" />重新載入最新資料
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl bg-forest-50 p-4 text-forest-800">
                <h3 className="font-black"><FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />你係旅程管理員</h3>
                <p className="mt-2 text-sm font-semibold leading-6">
                  修改會自動同步；家人重新載入後就會見到最新資料。
                </p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-black text-forest-800">
                    <FontAwesomeIcon icon={faUserGroup} className="mr-2" />家庭只讀成員
                  </h3>
                  <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-black text-earth-700">{members.length} 人</span>
                </div>
                <form onSubmit={addMember} className="flex gap-2">
                  <label className="sr-only" htmlFor="family-email">家庭成員電郵</label>
                  <input
                    id="family-email"
                    type="email"
                    inputMode="email"
                    value={memberEmail}
                    onChange={(event) => setMemberEmail(event.target.value)}
                    className="form-field min-w-0 flex-1"
                    placeholder="家庭成員電郵"
                    required
                  />
                  <button
                    type="submit"
                    disabled={working}
                    className="tap-feedback min-h-12 shrink-0 rounded-2xl bg-earth-300 px-4 text-sm font-black text-forest-800 disabled:opacity-60"
                  >
                    加入
                  </button>
                </form>
                {members.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {members.map((member) => (
                      <li key={member} className="flex items-center gap-2 rounded-2xl bg-canvas p-3">
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{member}</span>
                        <button
                          type="button"
                          onClick={() => void run(() => onRemoveMember(member))}
                          disabled={working}
                          className="tap-feedback flex h-10 w-10 items-center justify-center rounded-xl text-clay-700 hover:bg-clay-100 disabled:opacity-50"
                          aria-label={`移除 ${member}`}
                        >
                          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void run(onSaveNow)}
                  disabled={working || status === 'saving'}
                  className="tap-feedback min-h-12 rounded-2xl bg-forest-700 px-3 text-sm font-black text-white disabled:opacity-60"
                >
                  立即同步
                </button>
                <button
                  type="button"
                  onClick={() => void run(onRefresh)}
                  disabled={working}
                  className="tap-feedback min-h-12 rounded-2xl bg-earth-100 px-3 text-sm font-black text-earth-700 disabled:opacity-60"
                >
                  重新載入
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-clay-100 p-3 text-sm font-bold leading-6 text-clay-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void run(onSignOut)}
            disabled={working}
            className="tap-feedback flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-line bg-white px-4 text-sm font-black text-muted hover:text-clay-700 disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />登出
          </button>
        </div>
      )}
    </Dialog>
  );
}
