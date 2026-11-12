import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Trophy, Medal, Flame, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { getStudyIcon } from '../components/Layout';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('xp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaders(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, []);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (index === 1) return <Medal className="w-6 h-6 text-slate-300" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-slate-500 font-bold w-6 text-center">{index + 1}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-cyan-500/10 rounded-full mb-4">
          <Trophy className="w-12 h-12 text-cyan-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Global Leaderboard</h2>
        <p className="text-slate-400">Compete with students worldwide.</p>
      </header>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] gap-4 p-4 border-b border-slate-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="w-12 text-center">Rank</div>
          <div>Student</div>
          <div className="hidden sm:block text-right w-24">Streak</div>
          <div className="text-right w-16 sm:w-24">XP</div>
        </div>

        <div className="divide-y divide-slate-800/50">
          {leaders.map((user, index) => {
            const UserIcon = getStudyIcon(user.totalStudyTime);
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] gap-4 p-4 items-center hover:bg-slate-800/30 transition-colors"
              >
                <div className="w-12 flex justify-center">
                  {getRankIcon(index)}
                </div>
                
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <Star className="w-3 h-3 text-cyan-400 flex-shrink-0" /> 
                      <span className="truncate">{user.classLevel || `Lvl ${user.level || 1}`} • {user.region || 'Global'}</span>
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center justify-end gap-1 w-24 text-slate-300">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-medium">{user.currentStreak || 0}</span>
                </div>

                <div className="text-right w-16 sm:w-24">
                  <span className="font-bold text-cyan-400">{user.xp || 0}</span>
                  <span className="text-xs text-slate-500 ml-1">XP</span>
                </div>
              </motion.div>
            );
          })}

          {leaders.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No data available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
