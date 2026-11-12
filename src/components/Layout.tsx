import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Timer, CheckSquare, BookOpen, Users, Trophy, LogOut, Book, GraduationCap, Crown, Edit2, X, Save, PieChart } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { EmailVerificationBanner } from './EmailVerificationBanner';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { path: '/notes', icon: BookOpen, label: 'Notes' },
  { path: '/groups', icon: Users, label: 'Groups' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
];

export const getStudyIcon = (totalStudyTimeSeconds: number) => {
  const hours = (totalStudyTimeSeconds || 0) / 3600;
  if (hours >= 10) return Crown;
  if (hours >= 7) return GraduationCap;
  if (hours >= 3) return BookOpen;
  return Book;
};

export default function Layout() {
  const { logout, user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  const StudyIcon = getStudyIcon(userData?.totalStudyTime);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-xl flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
            Chronora
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group',
                  isActive
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("w-5 h-5", isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200")} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 border border-cyan-500/30 rounded-xl"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <PWAInstallButton />
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 mb-2 hover:bg-slate-800/50 rounded-xl transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-cyan-400 group-hover:text-cyan-300 transition-colors">
              <StudyIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{userData?.name || user?.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{userData?.classLevel || 'Lvl 1 Scholar'}</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <EmailVerificationBanner />

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-3.5 px-4 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Chronora
          </h1>
          <div className="flex items-center gap-2">
            <PWAInstallButton compact={true} />
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/90 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer text-xs font-medium"
              title="View & Edit Profile"
            >
              <StudyIcon className="w-4 h-4 shrink-0" />
              <span className="max-w-[70px] truncate text-slate-200">{userData?.name || 'Profile'}</span>
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 transition-colors cursor-pointer active:scale-95"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <OfflineIndicator />

        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
          <Outlet />
        </div>

        {/* Mobile Nav Bar - Includes Leaderboard! */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-800/50 bg-slate-900/90 backdrop-blur-xl flex justify-around p-2 z-50">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition-all min-w-[56px]',
                  isActive ? 'text-cyan-400 font-semibold bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>

      {/* Profile Edit & Account Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <ProfileModal 
            user={user} 
            userData={userData} 
            onClose={() => setIsProfileModalOpen(false)} 
            logout={logout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileModal({ user, userData, onClose, logout }: { user: any, userData: any, onClose: () => void, logout: () => void }) {
  const [name, setName] = useState(userData?.name || user?.displayName || '');
  const [classLevel, setClassLevel] = useState(userData?.classLevel || 'Class 1');
  const [statusMessage, setStatusMessage] = useState(userData?.statusMessage || '');
  const [region, setRegion] = useState(userData?.region || 'Bangladesh');
  const [isSaving, setIsSaving] = useState(false);

  const StudyIcon = getStudyIcon(userData?.totalStudyTime);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        classLevel,
        statusMessage,
        region
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-cyan-400" />
            Scholar Profile
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Profile Card Summary */}
        <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 mb-4">
          <div className="w-11 h-11 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
            <StudyIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate text-sm">{userData?.name || user?.displayName || 'Scholar'}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <p className="text-[10px] text-cyan-400 font-medium mt-0.5">{userData?.classLevel || 'Class 1'}</p>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" 
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Class</label>
            <select 
              value={classLevel} 
              onChange={(e) => setClassLevel(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                <option key={num} value={`Class ${num}`}>Class {num}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Status Message</label>
            <input 
              type="text" 
              value={statusMessage} 
              onChange={(e) => setStatusMessage(e.target.value)} 
              placeholder="What's on your mind?"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Region</label>
            <select 
              value={region} 
              onChange={(e) => setRegion(e.target.value)} 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
            >
              <option value="Bangladesh">Bangladesh</option>
              <option value="India">India</option>
              <option value="Pakistan">Pakistan</option>
              <option value="Singapore">Singapore</option>
            </select>
          </div>
          
          <button 
            type="submit"
            disabled={isSaving}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl transition-colors mt-4 flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Logout Button inside Profile Modal */}
        <div className="pt-3 mt-4 border-t border-slate-800">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Account</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
