import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from './Brand';

export default function PageShell({ title, accent = 'amber', children }: { title: string; accent?: string; children: ReactNode }) {
  return <main className={`page page--${accent}`}>
    <header className="page-header">
      <Link to="/DeveloperHub" className="icon-button" aria-label="Back to Developer Hub"><ArrowLeft size={18} /></Link>
      <Brand compact />
      <h1>{title}</h1>
    </header>
    <div className="page-content">{children}</div>
  </main>;
}
