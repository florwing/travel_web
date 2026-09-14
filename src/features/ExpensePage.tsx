import { useMemo, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBed,
  faBus,
  faCartShopping,
  faCoins,
  faPen,
  faPlus,
  faReceipt,
  faTicket,
  faTrashCan,
  faUtensils,
  faUserGroup,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import { Dialog } from '../components/Dialog';
import type { Currency, Expense, ExpenseCategory, TravelState } from '../types';

interface ExpensePageProps {
  state: TravelState;
  onUpdate: (patch: Partial<Pick<TravelState, 'trip' | 'expenses'>>) => void;
  readOnly?: boolean;
}

const categoryMeta: Record<ExpenseCategory, { label: string; icon: typeof faReceipt; color: string }> = {
  food: { label: '飲食', icon: faUtensils, color: 'bg-category-food' },
  transport: { label: '交通', icon: faBus, color: 'bg-category-transport' },
  hotel: { label: '住宿', icon: faBed, color: 'bg-category-hotel' },
  shopping: { label: '購物', icon: faCartShopping, color: 'bg-earth-500' },
  ticket: { label: '門票', icon: faTicket, color: 'bg-category-sight' },
};

const fieldClass = 'form-field';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00`));
}

export function ExpensePage({ state, onUpdate, readOnly = false }: ExpensePageProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [memberEditor, setMemberEditor] = useState<{ original: string; name: string } | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [memberError, setMemberError] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('JPY');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [payer, setPayer] = useState(state.trip.members[0] ?? '我');
  const [splitWith, setSplitWith] = useState<string[]>(state.trip.members);
  const [date, setDate] = useState(state.trip.startDate);
  const [formError, setFormError] = useState('');

  const hkdTotal = useMemo(
    () => state.expenses.reduce((sum, item) => sum + item.amount * item.rateToHkd, 0),
    [state.expenses],
  );

  const totalsByCurrency = useMemo(() => {
    return state.expenses.reduce<Partial<Record<Currency, number>>>((totals, item) => {
      totals[item.currency] = (totals[item.currency] ?? 0) + item.amount;
      return totals;
    }, {});
  }, [state.expenses]);

  const groupedExpenses = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    [...state.expenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((item) => groups.set(item.date, [...(groups.get(item.date) ?? []), item]));
    return [...groups.entries()];
  }, [state.expenses]);

  const estimatedHkd = Number(amount || 0) * state.exchangeRates[currency];

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCurrency('JPY');
    setCategory('food');
    setPayer(state.trip.members[0] ?? '我');
    setSplitWith(state.trip.members);
    setDate(state.trip.startDate);
    setFormError('');
    setEditingExpenseId(null);
    setFormMode('create');
  };

  const openNewExpense = () => {
    resetForm();
    setFormOpen(true);
  };

  const openExpenseEditor = (expense: Expense) => {
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setCategory(expense.category);
    setPayer(expense.payer);
    setSplitWith(expense.splitWith);
    setDate(expense.date);
    setEditingExpenseId(expense.id);
    setFormMode('edit');
    setFormError('');
    setFormOpen(true);
  };

  const submitExpense = (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!description.trim()) {
      setFormError('請輸入支出項目。');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('請輸入大於 0 的金額。');
      return;
    }
    if (!splitWith.length) {
      setFormError('請至少選擇一位分攤成員。');
      return;
    }

    const savedExpense: Expense = {
      id: editingExpenseId ?? crypto.randomUUID(),
      date,
      description: description.trim(),
      amount: numericAmount,
      currency,
      rateToHkd: state.exchangeRates[currency],
      category,
      payer,
      splitWith,
    };
    onUpdate({
      expenses: formMode === 'edit'
        ? state.expenses.map((item) => item.id === savedExpense.id ? savedExpense : item)
        : [...state.expenses, savedExpense],
    });
    setFormOpen(false);
    resetForm();
  };

  const deleteExpense = () => {
    if (!expenseToDelete) return;
    onUpdate({ expenses: state.expenses.filter((item) => item.id !== expenseToDelete.id) });
    setExpenseToDelete(null);
  };

  const saveMemberName = (event: FormEvent) => {
    event.preventDefault();
    if (!memberEditor) return;
    const nextName = memberEditor.name.trim();
    if (!nextName) {
      setMemberError('請輸入成員名稱。');
      return;
    }
    if (
      state.trip.members.some(
        (member) => member !== memberEditor.original && member.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      setMemberError('已有相同名稱嘅成員。');
      return;
    }

    const rename = (name: string) => name === memberEditor.original ? nextName : name;
    onUpdate({
      trip: {
        ...state.trip,
        members: state.trip.members.map(rename),
      },
      expenses: state.expenses.map((expense) => ({
        ...expense,
        payer: rename(expense.payer),
        splitWith: [...new Set(expense.splitWith.map(rename))],
      })),
    });
    setPayer((current) => rename(current));
    setSplitWith((current) => [...new Set(current.map(rename))]);
    setMemberEditor(null);
    setMemberError('');
  };

  const deleteMember = () => {
    if (!memberToDelete) return;
    const remainingMembers = state.trip.members.filter((member) => member !== memberToDelete);
    if (!remainingMembers.length) {
      setMemberError('最少要保留一位分攤成員。');
      setMemberToDelete(null);
      return;
    }

    const updateExpenseMembers = (expense: Expense): Expense => {
      const nextPayer = expense.payer === memberToDelete ? remainingMembers[0] : expense.payer;
      const nextSplitWith = expense.splitWith.filter((member) => member !== memberToDelete);
      return {
        ...expense,
        payer: nextPayer,
        splitWith: nextSplitWith.length ? nextSplitWith : [nextPayer],
      };
    };

    onUpdate({
      trip: { ...state.trip, members: remainingMembers },
      expenses: state.expenses.map(updateExpenseMembers),
    });
    const nextPayer = payer === memberToDelete ? remainingMembers[0] : payer;
    const nextSplitWith = splitWith.filter((member) => member !== memberToDelete);
    setPayer(nextPayer);
    setSplitWith(nextSplitWith.length ? nextSplitWith : [nextPayer]);
    setMemberToDelete(null);
    setMemberError('');
  };

  return (
    <>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="template-kicker mb-3">共同支出</p>
          <h1 className="display-heading">記帳</h1>
          <p className="mt-1 text-sm font-semibold text-muted">自動估算港幣及平均分攤</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openNewExpense}
            className="tap-feedback flex min-h-12 items-center gap-2 rounded-2xl bg-forest-700 px-4 text-sm font-black text-white shadow-soft-sm hover:bg-forest-800"
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            新增
          </button>
        )}
      </header>

      <section className="island-hero relative mb-5 overflow-hidden bg-forest-700 p-5 text-white" aria-labelledby="expense-total-heading">
        <span className="pointer-events-none absolute -right-8 -top-8 z-0 h-24 w-24 rounded-full border-[14px] border-earth-300/70" aria-hidden="true" />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p id="expense-total-heading" className="text-sm font-bold text-forest-100">總支出估算</p>
            <p className="mt-2 text-3xl font-black sm:text-4xl">HKD {hkdTotal.toLocaleString('zh-HK', { maximumFractionDigits: 0 })}</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-white/80 bg-earth-100 text-xl text-forest-800 shadow-soft-sm">
            <FontAwesomeIcon icon={faWallet} aria-hidden="true" />
          </span>
        </div>
        <div className="relative z-10 mt-5 flex flex-wrap gap-2 border-t border-forest-300/40 pt-4">
          {(Object.entries(totalsByCurrency) as [Currency, number][]).map(([code, total]) => (
            <span key={code} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold">
              {code} {total.toLocaleString('zh-HK')}
            </span>
          ))}
        </div>
        <p className="relative z-10 mt-3 text-xs font-semibold text-forest-100">
          離線示例匯率：JPY 1 ≈ HKD {state.exchangeRates.JPY} · USD 1 ≈ HKD {state.exchangeRates.USD}
        </p>
      </section>

      <section aria-labelledby="expense-list-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="expense-list-heading" className="text-lg font-black text-forest-800">每日明細</h2>
          <span className="rounded-full bg-earth-300 px-3 py-1 text-xs font-black text-forest-800">
            {state.expenses.length} 筆
          </span>
        </div>

        {groupedExpenses.length ? (
          <div className="space-y-4">
            {groupedExpenses.map(([groupDate, expenses]) => (
              <article key={groupDate} className="app-card">
                <div className="mb-3 flex items-center justify-between border-b border-dashed border-line pb-3">
                  <h3 className="font-black text-forest-800">{formatDate(groupDate)}</h3>
                  <p className="text-sm font-bold text-muted">
                    HKD {expenses.reduce((sum, item) => sum + item.amount * item.rateToHkd, 0).toFixed(0)}
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {expenses.map((expense) => {
                    const meta = categoryMeta[expense.category];
                    return (
                      <li key={expense.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${meta.color}`}>
                          <FontAwesomeIcon icon={meta.icon} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-ink">{expense.description}</p>
                          <p className="mt-0.5 truncate text-xs font-semibold text-muted">
                            {expense.payer} 付款 · {expense.splitWith.length} 人分攤
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-black text-forest-800">{expense.currency} {expense.amount.toLocaleString('zh-HK')}</p>
                          {expense.currency !== 'HKD' && (
                            <p className="text-xs font-semibold text-muted">≈ HKD {(expense.amount * expense.rateToHkd).toFixed(0)}</p>
                          )}
                          {!readOnly && (
                            <div className="mt-1 flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openExpenseEditor(expense)}
                                className="tap-feedback flex h-9 w-9 items-center justify-center rounded-xl text-forest-700 hover:bg-forest-100"
                                aria-label={`修改 ${expense.description}`}
                              >
                                <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpenseToDelete(expense)}
                                className="tap-feedback flex h-9 w-9 items-center justify-center rounded-xl text-clay-700 hover:bg-clay-100"
                                aria-label={`刪除 ${expense.description}`}
                              >
                                <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="app-card py-10 text-center">
            <FontAwesomeIcon icon={faReceipt} className="text-3xl text-earth-300" aria-hidden="true" />
            <p className="mt-3 font-black text-forest-800">尚未有支出紀錄</p>
          </div>
        )}
      </section>

      <Dialog
        open={formOpen}
        title={formMode === 'edit' ? '修改記帳' : '新增記帳'}
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submitExpense} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-forest-800">支出項目</span>
            <input
              autoFocus
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setFormError('');
              }}
              className={fieldClass}
              placeholder="例如：晚餐"
              required
            />
          </label>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">金額</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setFormError('');
                }}
                className={fieldClass}
                placeholder="0"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">幣別</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className={fieldClass}>
                <option value="JPY">JPY</option>
                <option value="HKD">HKD</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-forest-50 p-4">
            <span className="flex items-center gap-2 text-sm font-bold text-forest-700">
              <FontAwesomeIcon icon={faCoins} aria-hidden="true" />港幣估算
            </span>
            <strong className="text-lg text-forest-800">HKD {estimatedHkd.toFixed(0)}</strong>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">類別</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} className={fieldClass}>
                {Object.entries(categoryMeta).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">日期</span>
              <input type="date" value={date} min={state.trip.startDate} max={state.trip.endDate} onChange={(event) => setDate(event.target.value)} className={fieldClass} required />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-forest-800">付款人</span>
            <select value={payer} onChange={(event) => setPayer(event.target.value)} className={fieldClass}>
              {state.trip.members.map((member) => <option key={member}>{member}</option>)}
            </select>
          </label>

          <fieldset>
            <legend className="mb-2 flex items-center gap-2 text-sm font-bold text-forest-800">
              <FontAwesomeIcon icon={faUserGroup} aria-hidden="true" />分攤對象
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {state.trip.members.map((member) => {
                const checked = splitWith.includes(member);
                return (
                  <div key={member} className={`flex min-h-12 items-center gap-1 rounded-2xl border p-1.5 ${checked ? 'border-forest-500 bg-forest-50 text-forest-800' : 'border-line bg-canvas text-muted'}`}>
                    <label className="tap-feedback flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-1.5 font-bold">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSplitWith((current) => checked ? current.filter((item) => item !== member) : [...current, member]);
                          setFormError('');
                        }}
                        className="h-5 w-5 shrink-0 accent-forest-600"
                      />
                      <span className="truncate">{member}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberEditor({ original: member, name: member });
                        setMemberError('');
                      }}
                      className="tap-feedback flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-forest-700 hover:bg-forest-100"
                      aria-label={`修改分攤對象 ${member}`}
                    >
                      <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberToDelete(member);
                        setMemberError('');
                      }}
                      disabled={state.trip.members.length <= 1}
                      className="tap-feedback flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-clay-700 hover:bg-clay-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`刪除分攤對象 ${member}`}
                    >
                      <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
            {memberError && <p className="mt-2 text-sm font-bold text-clay-700" role="alert">{memberError}</p>}
          </fieldset>

          {formError && <p className="rounded-2xl bg-clay-100 p-3 text-sm font-bold text-clay-700" role="alert">{formError}</p>}

          <button type="submit" className="tap-feedback min-h-12 w-full rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800">
            {formMode === 'edit' ? '儲存修改' : '儲存支出'}
          </button>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(expenseToDelete)}
        title="刪除支出"
        onClose={() => setExpenseToDelete(null)}
      >
        {expenseToDelete && (
          <div className="space-y-4">
            <p className="rounded-2xl bg-clay-100 p-4 text-sm font-semibold leading-6 text-clay-700">
              確定刪除「{expenseToDelete.description}」？刪除後無法復原。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="tap-feedback min-h-12 flex-1 rounded-2xl border border-line bg-white px-4 font-black text-forest-800 hover:bg-forest-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={deleteExpense}
                className="tap-feedback min-h-12 flex-1 rounded-2xl bg-clay-700 px-4 font-black text-white hover:bg-clay-800"
              >
                刪除
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(memberEditor)}
        title="修改分攤對象"
        onClose={() => {
          setMemberEditor(null);
          setMemberError('');
        }}
      >
        {memberEditor && (
          <form onSubmit={saveMemberName} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-forest-800">成員名稱</span>
              <input
                autoFocus
                value={memberEditor.name}
                onChange={(event) => {
                  setMemberEditor({ ...memberEditor, name: event.target.value });
                  setMemberError('');
                }}
                className={fieldClass}
                maxLength={40}
                required
              />
            </label>
            {memberError && (
              <p className="rounded-2xl bg-clay-100 p-3 text-sm font-bold text-clay-700" role="alert">
                {memberError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMemberEditor(null);
                  setMemberError('');
                }}
                className="tap-feedback min-h-12 flex-1 rounded-2xl border border-line bg-white px-4 font-black text-forest-800 hover:bg-forest-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="tap-feedback min-h-12 flex-1 rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800"
              >
                儲存修改
              </button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={Boolean(memberToDelete)}
        title="刪除分攤對象"
        onClose={() => {
          setMemberToDelete(null);
          setMemberError('');
        }}
      >
        {memberToDelete && (
          <div className="space-y-4">
            <p className="rounded-2xl bg-clay-100 p-4 text-sm font-semibold leading-6 text-clay-700">
              確定刪除「{memberToDelete}」？現有記帳嘅付款人及分攤資料會自動更新。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMemberToDelete(null);
                  setMemberError('');
                }}
                className="tap-feedback min-h-12 flex-1 rounded-2xl border border-line bg-white px-4 font-black text-forest-800 hover:bg-forest-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={deleteMember}
                className="tap-feedback min-h-12 flex-1 rounded-2xl bg-clay-700 px-4 font-black text-white hover:bg-clay-800"
              >
                刪除
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
