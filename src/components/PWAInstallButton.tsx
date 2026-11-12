import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share, PlusSquare, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 3000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Browser fallback (e.g. desktop Chrome already showed or unsupported)
      setShowIOSGuide(true);
    }
  };

  if (compact) {
    return (
      <>
        <button
          onClick={handleInstallClick}
          title="Install Chronora on Phone or PC"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-all active:scale-95 shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Install App</span>
        </button>

        <AnimatePresence>
          {showIOSGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
              >
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Install Chronora</h3>
                    <p className="text-xs text-slate-400">Add to your Phone or PC</p>
                  </div>
                </div>

                <div className="space-y-3 my-4 text-sm text-slate-300 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1 rounded bg-slate-700 text-cyan-400 mt-0.5">
                      <Share className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-white">iPhone / iPad:</strong>
                      <p className="text-xs text-slate-400 mt-0.5">Safari toolbar theke <strong>Share</strong> icon tap korun, tarpor <strong>Add to Home Screen</strong> select korun.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 pt-2 border-t border-slate-700/50">
                    <div className="p-1 rounded bg-slate-700 text-cyan-400 mt-0.5">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="text-white">Android / Chrome:</strong>
                      <p className="text-xs text-slate-400 mt-0.5">Chrome menu (3-dots) theke <strong>Install App</strong> ba <strong>Add to Home Screen</strong> tap korun.</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Got It
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center gap-3 px-4 py-2.5 mb-2 rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all text-left group shadow-sm active:scale-98"
      >
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
          {installSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">Install App</p>
          <p className="text-[10px] text-cyan-400/80 truncate">Phone & PC Standalone</p>
        </div>
      </button>

      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Install Chronora</h3>
                  <p className="text-xs text-slate-400">Add to your Phone or PC</p>
                </div>
              </div>

              <div className="space-y-3 my-4 text-sm text-slate-300 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded bg-slate-700 text-cyan-400 mt-0.5">
                    <Share className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white">iPhone / iPad:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Safari toolbar theke <strong>Share</strong> icon tap korun, tarpor <strong>Add to Home Screen</strong> select korun.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-slate-700/50">
                  <div className="p-1 rounded bg-slate-700 text-cyan-400 mt-0.5">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white">Android / Chrome:</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Chrome menu (3-dots) theke <strong>Install App</strong> ba <strong>Add to Home Screen</strong> tap korun.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
