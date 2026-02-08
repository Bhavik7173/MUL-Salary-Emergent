import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarPlus, 
  Upload, 
  FileText, 
  Settings,
  X,
  Wallet
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily-entry', icon: CalendarPlus, label: 'Daily Entry' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/payslip', icon: FileText, label: 'Payslip' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <aside 
      className={`
        fixed top-0 left-0 z-50 h-full w-64 
        bg-slate-900 text-slate-300 
        border-r border-slate-800
        transition-transform duration-300
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      data-testid="sidebar"
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg text-white">
            MUL Salary
          </span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-1 hover:bg-slate-800 rounded"
          data-testid="sidebar-close-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1 sidebar-scroll overflow-y-auto h-[calc(100%-4rem)]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg
              transition-all duration-200
              ${isActive 
                ? 'bg-blue-600/20 text-white font-medium' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
            `}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Info Card */}
        <div className="mt-8 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400">
            Contract Hours
          </p>
          <p className="text-lg font-mono font-semibold text-white mt-1">
            151.67 hrs/month
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Tax Rate: 27.64%
          </p>
        </div>
      </nav>
    </aside>
  );
}
