import AppHeader from './AppHeader';
import MobileBottomNav from './MobileBottomNav';

export default function AppShell({ children, currentMonth }) {
  return (
    <div className="wrap">
      <AppHeader currentMonth={currentMonth} />
      <main className="app-main-content">{children}</main>
      <MobileBottomNav currentMonth={currentMonth} />
    </div>
  );
}
