import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Bottom tabs. Prefix matching keeps the parent tab active on sub-screens. */
export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav className="ui-tabbar">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `ui-tab${isActive ? ' is-active' : ''}`}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
