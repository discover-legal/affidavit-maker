import React from 'react';
import { Scale, Home, LogOut, CheckCircle } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';

const Header = ({ currentView, onBackToDashboard, onSave, sessionSaved }) => {
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
                    {/* This is now a clickable button */}
                    <button onClick={handleHomeClick} className="flex items-center gap-3 text-gray-800">
                        <Scale className="h-8 w-8 text-blue-600" />
                        <h1 className="text-xl font-semibold">Affidavit Pro</h1>
                    </button>

                    <div className="flex items-center space-x-4">
                        {/* Conditionally render buttons for the editor view */}
                        {currentView === 'editor' && (
                            <button
                                onClick={onSave}
                                disabled={sessionSaved}
                                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                            >
                                {sessionSaved ? (
                                    <>
                                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                                        Saved
                                    </>
                                ) : (
                                    'Save Progress'
                                )}
                            </button>
                        )}

                        {/* Conditionally render user info and logout */}
                        {isAuthenticated && (
                            <>
                                <span className="text-sm text-gray-700 hidden sm:block">Welcome, {user?.name}</span>
                                <button
                                    onClick={() => logout({ returnTo: window.location.origin })}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;