// Enhanced Resume Modal
import React from 'react';
import { Clock } from 'lucide-react';

const ResumeModal = ({ isOpen, onClose, onResume, onStartFresh }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center mb-4">
          <Clock className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold">Resume Previous Session?</h3>
        </div>
        <p className="text-gray-600 mb-6">
          We found a previous session from this browser. Would you like to continue where you left off or start fresh?
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onResume}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Resume Session
          </button>
          <button
            onClick={onStartFresh}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeModal;