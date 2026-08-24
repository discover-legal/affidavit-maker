'use client';

import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';
import StageBadge from '@/components/StageBadge';

type MarketingHeaderProps = {
  /** Show "Back" arrow on the left, linking to `/`. */
  showBack?: boolean;
};

export default function MarketingHeader({ showBack = true }: MarketingHeaderProps) {
  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {showBack && (
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-3 sm:mr-4"
                aria-label="Back to home"
              >
                <ArrowLeft className="h-5 w-5 mr-1 sm:mr-2" />
                <span className="text-sm font-medium hidden sm:inline">Back</span>
              </Link>
            )}
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <div className="text-left">
                <span className="text-xl sm:text-2xl font-bold text-blue-600">
                  discover.legal <StageBadge className="ml-1" />
                </span>
                <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Legal Documents</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
