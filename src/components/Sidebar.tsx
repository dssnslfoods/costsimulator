import { useAppState } from '@/store/AppContext';
import { AppView } from '@/types';
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  FlaskConical,
  GitCompareArrows,
  DollarSign,
  TrendingUp,
  FileText,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const navItems: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { view: 'scenario-creator', label: 'Scenario Creator', icon: <FlaskConical size={18} /> },
  { view: 'scenario-comparison', label: 'Compare Scenarios', icon: <GitCompareArrows size={18} /> },
  { view: 'cost-analysis', label: 'Cost Analysis', icon: <DollarSign size={18} /> },
  { view: 'price-sensitivity', label: 'Price Sensitivity', icon: <TrendingUp size={18} /> },
  { view: 'reports', label: 'Reports', icon: <FileText size={18} /> },
  { view: 'promotions', label: 'Promotion (จัดโปรโมชั่น)', icon: <FolderOpen size={18} /> },
  { view: 'products', label: 'Product Master', icon: <Package size={18} /> },
];

export default function Sidebar() {
  const { state, dispatch } = useAppState();

  return (
    <aside className="w-64 min-h-screen gradient-dark flex flex-col border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
          What-If Analysis
        </h1>
        <p className="text-xs text-sidebar-foreground mt-1 opacity-70">
          Sales & Production
        </p>
      </div>

      {state.availableDates.length > 0 && (
        <div className="p-4 border-b border-sidebar-border">
          <Select
            value={state.selectedDate || undefined}
            onValueChange={(val) => dispatch({ type: 'SET_SELECTED_DATE', payload: val })}
          >
            <SelectTrigger className="w-full bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {state.availableDates.map(date => {
                const dateObj = new Date(date);
                const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
                return (
                  <SelectItem key={date} value={date}>
                    {formatter.format(dateObj)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: view })}
            className={`nav-item w-full text-left ${state.currentView === view
              ? 'active'
              : 'text-sidebar-foreground'
              }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground opacity-50">
          {state.products.length} products · {state.scenarios.length} scenarios
        </div>
      </div>
    </aside>
  );
}
