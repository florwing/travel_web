import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarDays,
  faImages,
  faListCheck,
  faSuitcaseRolling,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import type { AppTab } from '../types';

interface BottomNavigationProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const navItems = [
  { id: 'schedule' as const, label: '行程', icon: faCalendarDays },
  { id: 'bookings' as const, label: '預訂', icon: faSuitcaseRolling },
  { id: 'expense' as const, label: '記帳', icon: faWallet },
  { id: 'planning' as const, label: '準備', icon: faListCheck },
  { id: 'photos' as const, label: '相片', icon: faImages },
];

export function BottomNavigation({ active, onChange }: BottomNavigationProps) {
  return (
    <nav
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-[2.25rem] border-[3px] border-white/90 bg-paper/95 p-1.5 shadow-nav backdrop-blur"
      aria-label="主要功能"
    >
      <div className="grid grid-cols-5 gap-0.5">
        {navItems.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`tap-feedback flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-black ${
                selected ? '-translate-y-1 bg-earth-100 text-forest-800 shadow-soft-sm' : 'text-muted hover:bg-forest-50'
              }`}
              aria-current={selected ? 'page' : undefined}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-forest-700 text-white' : 'bg-canvas text-muted'}`}>
                <FontAwesomeIcon icon={item.icon} className="text-base" aria-hidden="true" />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
