import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface StatusBarProps {
  from: string;
  to: string;
  timeRemaining: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ from, to, timeRemaining }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Journey:</span>
          <span className="font-medium">{from} → {to}</span>
          <span className="text-gray-400">|</span>
          <span className="font-bold text-[var(--safety-orange)]">{timeRemaining} left</span>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <Info className="w-3 h-3" />
        </button>
      </div>

      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--safety-orange-light)] flex items-center justify-center">
                <Info className="w-4 h-4 text-[var(--safety-orange)]" />
              </div>
              Privacy Notice
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                This journey is <span className="font-semibold text-[var(--safety-orange)]">temporary</span>.
              </p>
              <p>
                All chats and connections will be <span className="font-semibold">automatically wiped in 4 hours</span> for your privacy and security.
              </p>
              <p className="text-sm text-gray-500">
                Destiny keeps your travel networking safe and ephemeral. Enjoy connecting without long-term data storage!
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
