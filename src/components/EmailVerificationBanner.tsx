import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, CheckCircle, RefreshCw, Send, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const EmailVerificationBanner: React.FC = () => {
  const { user, sendVerificationEmail, reloadUser } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // If no user, or user already verified, or user closed banner for session, don't show
  if (!user || user.emailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setIsSending(true);
    setStatusMsg(null);
    try {
      await sendVerificationEmail();
      setStatusMsg({ 
        type: 'success', 
        text: 'Verification email sent! Please check your inbox and spam folder.' 
      });
    } catch (err: any) {
      setStatusMsg({ 
        type: 'error', 
        text: err?.message || 'Failed to send verification email. Please try again later.' 
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setStatusMsg(null);
    try {
      await reloadUser();
      if (user.emailVerified) {
        setStatusMsg({ type: 'success', text: 'Email verified successfully!' });
      } else {
        setStatusMsg({ 
          type: 'error', 
          text: 'Email is not verified yet. Please click the link sent to your email.' 
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Error checking verification status.' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Your email <strong className="text-white underline">{user.email}</strong> is not verified yet.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResend}
            disabled={isSending}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            <span>Resend Link</span>
          </button>

          <button
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isChecking ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3 text-cyan-400" />
            )}
            <span>I Have Verified</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`max-w-7xl mx-auto mt-1.5 font-medium flex items-center gap-1.5 ${
              statusMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>{statusMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
