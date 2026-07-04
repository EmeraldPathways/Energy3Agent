import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo">
          AI Campaign Builder
        </Link>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}