// Payment Modal Component
import React from 'react';
import { CreditCard, X } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, affidavitData, onPaymentSuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Download Affidavit</h3>
          <button onClick={onClose}>
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>
        <div className="mb-6">
          <div className="flex items-center justify-between py-2">
            <span>Professional Affidavit</span>
            <span className="font-semibold">$9.99</span>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>$9.99</span>
            </div>
          </div>
        </div>
        <button
          onClick={onPaymentSuccess}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Complete Payment
        </button>
      </div>
    </div>
  );
};

export default PaymentModal;