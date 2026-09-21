import Link from 'next/link';
import { Scale } from 'lucide-react';
import { BIGLAW_REPO, GITHUB_ORG } from './content';

const COLUMNS = [
  {
    title: 'Services',
    links: [
      { href: '/services#buy', label: 'Buy: selection' },
      { href: '/services#build', label: 'Build: custom development' },
      { href: '/services#msp', label: 'Run: managed services' },
      { href: '/services#advisory', label: 'Advise: fractional CTO' },
    ],
  },
  {
    title: 'Free solutions',
    links: [
      { href: '/tools/affidavits', label: 'discover.legal Documents' },
      { href: '/tools/biglaw', label: 'BigLaw' },
      { href: BIGLAW_REPO, label: 'BigLaw on GitHub', external: true },
      { href: '/resources', label: 'Resources' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/research', label: 'Research' },
      { href: GITHUB_ORG, label: 'GitHub', external: true },
      { href: '/brand', label: 'Brand assets' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/tos', label: 'Terms of Service' },
    ],
  },
] as const;

export default function ConsultancyFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg p-1.5">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                discover<span className="text-brand">.</span>legal
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Legal technology consultancy: selection, custom builds, managed services and
              advisory for law firms and legal teams. Two of our solutions are free. Not a law
              firm; not legal advice.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {'external' in l && l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="hover:text-white transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} discover.legal. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 max-w-md text-center sm:text-right">
            We are a technology consultancy, not a law firm, and do not provide legal advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
