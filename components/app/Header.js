'use client';

// client/src/components/Header.js - Complete implementation

import React from 'react';
import { Scale, Home, LogOut, CheckCircle, Loader2, User } from 'lucide-react';
import { useAuth0 } from '@/lib/auth0-client';

const Header = ({ currentView, onBackToDashboard, onSave, sessionSaved, isSaving }) => {
    const { isAuthenticated, user, logout, loginWithRedirect, isLoading } = useAuth0();

    const handleHomeClick = () => {
        if (currentView !== 'landing') {
            onBackToDashboard();
        }
    };

    const handleLogin = () => {
        loginWithRedirect({
            appState: { returnTo: window.location.pathname }
        });
    };

    const handleLogout = () => {
        logout({ 
            logoutParams: { returnTo: window.location.origin }
        });
    };

    return (
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo and Title */}
                    <button
                        onClick={handleHomeClick}
                        aria-label="Go to discover.legal home"
                        className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-opacity"
                    >
                        <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                        <div className="text-left">
                            <span className="text-xl sm:text-2xl font-bold text-blue-600">discover.legal</span>
                            <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Legal Documents</p>
                        </div>
                    </button>

                    {/* Right side actions */}
                    <div className="flex items-center space-x-4">
                        {/* Save button (only on editor view) */}
                        {currentView === 'editor' && isAuthenticated && (
                            <button
                                onClick={onSave}
                                aria-label={isSaving ? 'Saving document' : sessionSaved ? 'Document saved' : 'Save document'}
                                disabled={sessionSaved || isSaving}
                                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 w-28 justify-center transition-colors"
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

                        {/* Navigation for authenticated users */}
                        {isAuthenticated && currentView !== 'dashboard' && (
                            <button
                                onClick={onBackToDashboard}
                                aria-label="Go to dashboard"
                                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
                            >
                                <Home className="h-4 w-4 mr-1" />
                                Dashboard
                            </button>
                        )}

                        {/* Authentication section */}
                        {isLoading ? (
                            <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                        ) : isAuthenticated ? (
                            <div className="flex items-center space-x-3">
                                {/* User info */}
                                <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-700">
                                    <User className="h-4 w-4" />
                                    <span>{user?.name || user?.email || 'User'}</span>
                                </div>
                                
                                {/* Logout button */}
                                <button
                                    onClick={handleLogout}
                                    aria-label="Sign out"
                                    className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-red-600 transition-colors"
                                >
                                    <LogOut className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Sign Out</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleLogin}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
