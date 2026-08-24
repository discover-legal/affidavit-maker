import Link from 'next/link';
import { Scale } from 'lucide-react';
import StageBadge from '@/components/StageBadge';

export default function LandingFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg p-1.5">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                discover<span className="text-brand">.</span>legal <StageBadge className="ml-1" />
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Free, AI-assisted legal document preparation for everyday people &mdash; in English
              and Espa&ntilde;ol. Not a law firm; not a substitute for legal advice.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Documents
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#documents" className="hover:text-white transition-colors">
                  Divorce Package
                </a>
              </li>
              <li>
                <a href="#documents" className="hover:text-white transition-colors">
                  General Affidavit
                </a>
              </li>
              <li>
                <a href="#documents" className="hover:text-white transition-colors">
                  Supporting court documents
                </a>
              </li>
              <li>
                <Link href="/resources" className="hover:text-white transition-colors">
                  Resources
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Legal
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/tos" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} discover.legal. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 max-w-md text-center sm:text-right">
            We are not a law firm and do not provide legal advice. Use of this site does not create
            an attorney-client relationship.
          </p>
        </div>
      </div>
    </footer>
  );
}
