import React from 'react';
import { Scale, Home } from 'lucide-react';

const Header = ({ currentView, onBackToDashboard, onBackToLanding }) => {
    const showHomeButton = currentView === 'editor';
    const homeAction = currentView === 'editor' ? onBackToDashboard : null;

    return (
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <Scale className="h-8 w-8 text-blue-600 mr-3" />
                        <h1 className="text-xl font-semibold text-gray-900">Affidavit Pro</h1>
                    </div>
                    {showHomeButton && (
                        <button
                            onClick={homeAction}
                            className="flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            <Home className="h-4 w-4 mr-2" />
                            Home
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
