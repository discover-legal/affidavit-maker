// client/src/components/Header.js

import React from 'react';
import { Scale, Home, LogOut, CheckCircle, Loader2 } from 'lucide-react'; // Import Loader2
import { useAuth0 } from '@auth0/auth0-react';

const Header = ({ currentView, onBackToDashboard, onSave, sessionSaved, isSaving }) => {
    const { isAuthenticated, user, logout } = useAuth0();

    // The header title is now a button that takes you to the dashboard
    const handleHomeClick = () => {
        if (currentView !== 'landing') {
            onBackToDashboard();
        }
    };

    return (
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* ... (title button) */}
                    
                    <div className="flex items-center space-x-4">
                        {currentView === 'editor' && (
                            <button
                                onClick={onSave}
                                disabled={sessionSaved || isSaving} // Disable if already saved or currently saving
                                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 w-28 justify-center" // Fixed width
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        Saving...
                                    </>
                                ) : sessionSaved ? (
                                    <>
                                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                                        Saved
                                    </>
                                ) : (
                                    'Save Progress'
                                )}
                            </button>
                        )}
                        {/* ... (auth section) */}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;