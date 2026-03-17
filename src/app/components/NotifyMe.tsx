import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Bell, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const NotifyMe: React.FC = () => {
  const navigate = useNavigate();

  const handleNotify = () => {
    toast.success('Alert set!', {
      description: 'We\'ll notify you when someone joins this journey.',
    });
    setTimeout(() => {
      navigate('/discovery');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E3F2FD] to-white flex flex-col">
      {/* Header */}
      <div className="bg-[var(--travel-blue)] text-white px-6 py-6">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Destiny</h1>
          <p className="text-blue-100 text-sm">Connect with travelers</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-md mx-auto text-center">
          {/* Illustration */}
          <div className="mb-8">
            <div className="relative mx-auto w-64 h-40 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Bus illustration */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-24 bg-gradient-to-r from-[var(--travel-blue-light)] to-[var(--travel-blue)] rounded-xl border-2 border-[var(--travel-blue)] relative">
                  {/* Windows */}
                  <div className="absolute top-3 left-4 right-4 flex gap-2">
                    <div className="flex-1 h-10 bg-white/40 rounded"></div>
                    <div className="flex-1 h-10 bg-white/40 rounded"></div>
                    <div className="flex-1 h-10 bg-white/40 rounded"></div>
                  </div>
                  {/* Wheels */}
                  <div className="absolute -bottom-2 left-6 w-6 h-6 bg-gray-800 rounded-full border-2 border-white"></div>
                  <div className="absolute -bottom-2 right-6 w-6 h-6 bg-gray-800 rounded-full border-2 border-white"></div>
                </div>
              </div>
              
              {/* Empty indicator */}
              <div className="absolute top-2 right-2">
                <div className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-600 font-medium">
                  0 travelers
                </div>
              </div>
            </div>
          </div>

          {/* Text */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            It's quiet here... for now
          </h2>
          <p className="text-gray-600 mb-2">
            No one has joined this journey yet.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Be the first to connect when fellow travelers hop on!
          </p>

          {/* Action Button */}
          <Button
            onClick={handleNotify}
            className="w-full bg-[var(--safety-orange)] hover:bg-[var(--safety-orange-dark)] text-white py-6 rounded-xl flex items-center justify-center gap-3 text-lg"
          >
            <Bell className="w-6 h-6" />
            Alert me when someone joins
          </Button>

          {/* Info card */}
          <div className="mt-6 bg-[var(--travel-blue-light)] border border-[var(--travel-blue)] rounded-xl p-4 text-left">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-[var(--travel-blue-dark)]">Tip:</span> Travelers often join closer to departure time. Check back soon!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
