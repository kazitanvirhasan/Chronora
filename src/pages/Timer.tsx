import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  BookOpen, 
  Plus, 
  X, 
  ChevronDown, 
  Trash2,
  Maximize2,
  Minimize2,
  Trophy,
  Users,
  Flame,
  Sparkles,
  Crown,
  GraduationCap,
  Book,
  Volume2,
  Calendar,
  BarChart2,
  Clock,
  Target,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  increment, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  limit,
  documentId,
  getDocs
} from 'firebase/firestore';

interface TimerSettings {
  pomodoro: number;
  shortBreak: number;
  longBreak: number;
}

const DEFAULT_SETTINGS: TimerSettings = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
};

const getSavedSettings = (): TimerSettings => {
  try {
    const saved = localStorage.getItem('timerSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        pomodoro: Number(parsed.pomodoro) > 0 ? Number(parsed.pomodoro) : DEFAULT_SETTINGS.pomodoro,
        shortBreak: Number(parsed.shortBreak) > 0 ? Number(parsed.shortBreak) : DEFAULT_SETTINGS.shortBreak,
        longBreak: Number(parsed.longBreak) > 0 ? Number(parsed.longBreak) : DEFAULT_SETTINGS.longBreak,
      };
    }
  } catch (err) {
    console.error('Failed to parse timerSettings from localStorage:', err);
  }
  return DEFAULT_SETTINGS;
};

export const getToday5AMCutoff = (): Date => {
  const now = new Date();
  const cutoff = new Date(now);
  if (now.getHours() < 5) {
    cutoff.setDate(cutoff.getDate() - 1);
  }
  cutoff.setHours(5, 0, 0, 0);
  return cutoff;
};

export default function Timer() {
  const { user } = useAuth();
  const [customModes, setCustomModes] = useState<TimerSettings>(getSavedSettings);
  const [mode, setMode] = useState<'pomodoro' | 'shortBreak' | 'longBreak'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(() => {
    const initial = getSavedSettings();
    return initial.pomodoro * 60;
  });
  const [todayStudySeconds, setTodayStudySeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Full Screen Focus Mode & Real-time Live Activity Modal State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLiveActivityModal, setShowLiveActivityModal] = useState(false);
  const [liveTab, setLiveTab] = useState<'global' | 'groups'>('global');
  
  // Real-time Leaderboard & Groups Data
  const [rawUsersList, setRawUsersList] = useState<any[]>([]);
  const [dailyStudyMap, setDailyStudyMap] = useState<Record<string, number>>({});
  const [myGroupsData, setMyGroupsData] = useState<any[]>([]);
  const [groupUsersMap, setGroupUsersMap] = useState<Record<string, any>>({});

  // Scholar Monthly Insights Modal State
  const [selectedScholar, setSelectedScholar] = useState<any | null>(null);
  const [scholarMonthSessions, setScholarMonthSessions] = useState<any[]>([]);
  const [isLoadingScholarData, setIsLoadingScholarData] = useState(false);

  const [subjects, setSubjects] = useState<string[]>(['General']);
  const [subject, setSubject] = useState('General');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [isClosing, setIsClosing] = useState(false);
  const [closeCountdown, setCloseCountdown] = useState(0);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<TimerSettings>(customModes);

  const isActiveRef = useRef(isActive);
  const isClosingRef = useRef(isClosing);
  const modeRef = useRef(mode);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isClosingRef.current = isClosing;
  }, [isClosing]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('timerSettings', JSON.stringify(customModes));
  }, [customModes]);

  const closeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionSubjectRef = useRef<string>('General');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initOrResumeAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (e) {
      console.error('Audio unlock error:', e);
    }
  };

  useEffect(() => {
    const unlock = () => {
      initOrResumeAudio();
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeIntervalRef.current) clearInterval(closeIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Listen to real-time studySessions starting from 5:00 AM reset cutoff
  useEffect(() => {
    const cutoff = getToday5AMCutoff();

    const qSessions = query(
      collection(db, 'studySessions'),
      where('startTime', '>=', cutoff)
    );

    const unsubscribe = onSnapshot(qSessions, (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.userId && typeof d.duration === 'number') {
          map[d.userId] = (map[d.userId] || 0) + d.duration;
        }
      });
      setDailyStudyMap(map);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'studySessions'));

    return () => unsubscribe();
  }, []);

  // 2. Listen to real-time users collection
  useEffect(() => {
    const qUsers = query(collection(db, 'users'));

    const unsubscribe = onSnapshot(qUsers, (snapshot) => {
      const usersList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setRawUsersList(usersList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, []);

  // 3. Listen to real-time Joined Groups & Members Activity
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const groupsList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setMyGroupsData(groupsList);

      // Collect all member UIDs
      const allMemberUids = new Set<string>();
      groupsList.forEach((g: any) => {
        (g.members || []).forEach((mUid: string) => allMemberUids.add(mUid));
      });

      if (allMemberUids.size > 0) {
        try {
          const uidsArray = Array.from(allMemberUids).slice(0, 30);
          const usersQ = query(collection(db, 'users'), where(documentId(), 'in', uidsArray));
          const usersSnap = await getDocs(usersQ);
          const uMap: Record<string, any> = {};
          usersSnap.docs.forEach(uDoc => {
            uMap[uDoc.id] = uDoc.data();
          });
          setGroupUsersMap(uMap);
        } catch (err) {
          console.error('Failed to fetch group members profile:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const modes = useMemo(() => ({
    pomodoro: customModes.pomodoro * 60,
    shortBreak: customModes.shortBreak * 60,
    longBreak: customModes.longBreak * 60,
  }), [customModes]);

  // 4. Combine raw users & dailyStudyMap into globalLeaderboard ranked by today's study time
  const globalLeaderboard = useMemo(() => {
    const elapsed = (isActive && mode === 'pomodoro') ? (modes[mode] - timeLeft) : 0;

    const combined = rawUsersList.map((usr) => {
      let todaySecs = dailyStudyMap[usr.id] || 0;
      if (usr.id === user?.uid) {
        todaySecs += elapsed;
      }
      return {
        ...usr,
        todayStudyTime: todaySecs
      };
    });

    combined.sort((a, b) => (b.todayStudyTime || 0) - (a.todayStudyTime || 0));
    return combined;
  }, [rawUsersList, dailyStudyMap, isActive, mode, timeLeft, modes, user]);

  // Fetch selected scholar's monthly study sessions
  useEffect(() => {
    if (!selectedScholar?.id) {
      setScholarMonthSessions([]);
      return;
    }
    setIsLoadingScholarData(true);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    const q = query(
      collection(db, 'studySessions'),
      where('userId', '==', selectedScholar.id),
      where('startTime', '>=', startOfMonth),
      orderBy('startTime', 'desc')
    );

    getDocs(q).then((snap) => {
      const msgs = snap.docs.map(docSnap => docSnap.data());
      setScholarMonthSessions(msgs);
      setIsLoadingScholarData(false);
    }).catch((err) => {
      console.error('Failed to load scholar monthly sessions:', err);
      setIsLoadingScholarData(false);
    });
  }, [selectedScholar]);

  // Compute scholar monthly statistics
  const scholarMonthStats = useMemo(() => {
    let totalSecs = 0;
    const subjectMap: Record<string, number> = {};

    scholarMonthSessions.forEach((s) => {
      const dur = s.duration || 0;
      totalSecs += dur;
      const sub = s.subject || 'General';
      subjectMap[sub] = (subjectMap[sub] || 0) + dur;
    });

    let topSub = 'None';
    let maxSubSecs = 0;
    Object.entries(subjectMap).forEach(([sub, sec]) => {
      if (sec > maxSubSecs) {
        maxSubSecs = sec;
        topSub = sub;
      }
    });

    const sessionCount = scholarMonthSessions.length;
    const avgMins = sessionCount > 0 ? Math.round((totalSecs / 60) / sessionCount) : 0;

    return {
      totalSecs,
      sessionCount,
      topSub,
      maxSubSecs,
      avgMins,
      subjectMap
    };
  }, [scholarMonthSessions]);

  // Compute monthly calendar data for selected scholar
  const currentMonthCalendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const dailyStudySeconds: Record<number, number> = {};

    scholarMonthSessions.forEach((s) => {
      if (s.startTime) {
        let dateObj: Date;
        if (typeof s.startTime.toDate === 'function') {
          dateObj = s.startTime.toDate();
        } else if (s.startTime.seconds) {
          dateObj = new Date(s.startTime.seconds * 1000);
        } else {
          dateObj = new Date(s.startTime);
        }
        
        if (dateObj.getFullYear() === year && dateObj.getMonth() === month) {
          const dayNum = dateObj.getDate();
          dailyStudySeconds[dayNum] = (dailyStudySeconds[dayNum] || 0) + (s.duration || 0);
        }
      }
    });

    return {
      year,
      month,
      monthName: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      daysInMonth,
      firstDayIndex,
      dailyStudySeconds
    };
  }, [scholarMonthSessions]);

  // Fetch initial user subjects & update current user's today study time
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
          setSubjects(data.subjects);
          if (!data.subjects.includes(subject)) {
            setSubject(data.subjects[0]);
          }
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setTodayStudySeconds(dailyStudyMap[user.uid] || 0);
  }, [dailyStudyMap, user]);

  // Main Timer Interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      playNotificationSound();

      if (mode === 'pomodoro') {
        saveSession(modes.pomodoro);
        // Automatically switch to short break mode
        setMode('shortBreak');
        setTimeLeft(modes.shortBreak);
      } else {
        // Automatically shift back to focus mode without auto-starting
        setMode('pomodoro');
        setTimeLeft(modes.pomodoro);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, mode, modes]);

  const playNotificationSound = () => {
    try {
      initOrResumeAudio();
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioCtx();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Catchy, energetic 8-note rising digital alarm chime
      const melody = [
        { time: 0.00, freq: 523.25 }, // C5
        { time: 0.12, freq: 659.25 }, // E5
        { time: 0.24, freq: 783.99 }, // G5
        { time: 0.36, freq: 1046.50 },// C6
        { time: 0.55, freq: 783.99 }, // G5
        { time: 0.67, freq: 1046.50 },// C6
        { time: 0.79, freq: 1318.51 },// E6
        { time: 0.95, freq: 1567.98 } // G6 (High Finish)
      ];

      melody.forEach(({ time, freq }) => {
        const startTime = now + time;
        const duration = 0.35;

        // Primary punchy triangle wave (warm acoustic bell body)
        const osc1 = ctx!.createOscillator();
        const gain1 = ctx!.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startTime);
        gain1.gain.setValueAtTime(0, startTime);
        gain1.gain.linearRampToValueAtTime(0.7, startTime + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc1.connect(gain1);
        gain1.connect(ctx!.destination);
        osc1.start(startTime);
        osc1.stop(startTime + duration + 0.05);

        // Secondary bright sine wave (pure bell harmonic)
        const osc2 = ctx!.createOscillator();
        const gain2 = ctx!.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq, startTime);
        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc2.connect(gain2);
        gain2.connect(ctx!.destination);
        osc2.start(startTime);
        osc2.stop(startTime + duration + 0.05);
      });
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  const saveSession = async (durationSeconds: number) => {
    if (!user || durationSeconds <= 0) return;

    const currentSub = sessionSubjectRef.current || subject;
    const now = new Date();
    const startTime = new Date(now.getTime() - durationSeconds * 1000);

    try {
      await addDoc(collection(db, 'studySessions'), {
        userId: user.uid,
        duration: durationSeconds,
        startTime: startTime,
        endTime: now,
        subject: currentSub,
      });

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        totalStudyTime: increment(durationSeconds),
        xp: increment(Math.floor(durationSeconds / 60) * 10),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'studySessions');
    }
  };

  const toggleTimer = () => {
    initOrResumeAudio();
    if (isClosing) return;
    if (!isActive) {
      sessionSubjectRef.current = subject;
    }
    setIsActive(!isActive);
  };

  const handleStop = () => {
    initOrResumeAudio();
    if (isClosing) {
      if (closeIntervalRef.current) {
        clearInterval(closeIntervalRef.current);
        closeIntervalRef.current = null;
      }
      setIsClosing(false);

      const elapsed = modes[mode] - timeLeft;
      if (mode === 'pomodoro' && elapsed > 0) {
        saveSession(elapsed);
      }
      setTimeLeft(modes[mode]);
      return;
    }

    if (isActive) {
      setIsActive(false);
      const elapsed = modes[mode] - timeLeft;
      
      if (elapsed < 60) {
        setTimeLeft(modes[mode]);
      } else {
        setIsClosing(true);
        setCloseCountdown(5);

        closeIntervalRef.current = setInterval(() => {
          setCloseCountdown((prev) => {
            if (prev <= 1) {
              if (closeIntervalRef.current) clearInterval(closeIntervalRef.current);
              closeIntervalRef.current = null;
              setIsClosing(false);
              
              if (modeRef.current === 'pomodoro') {
                saveSession(elapsed);
              }
              setTimeLeft(modes[modeRef.current]);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      setTimeLeft(modes[mode]);
    }
  };

  const changeMode = (newMode: 'pomodoro' | 'shortBreak' | 'longBreak') => {
    initOrResumeAudio();
    if (isActive) return;
    if (isClosing) {
      if (closeIntervalRef.current) clearInterval(closeIntervalRef.current);
      setIsClosing(false);
    }
    setIsActive(false);
    setMode(newMode);
    setTimeLeft(modes[newMode]);
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !user) return;

    const trimmed = newSubject.trim();
    if (subjects.includes(trimmed)) {
      setSubject(trimmed);
      setIsAddingSubject(false);
      setNewSubject('');
      return;
    }

    const updated = [...subjects, trimmed];
    setSubjects(updated);
    setSubject(trimmed);
    setIsAddingSubject(false);
    setNewSubject('');

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        subjects: updated
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleDeleteSubject = async (e: React.MouseEvent, subToDelete: string) => {
    e.stopPropagation();
    if (!user || subToDelete === 'General') return;

    const updated = subjects.filter(s => s !== subToDelete);
    setSubjects(updated);
    if (subject === subToDelete) {
      setSubject('General');
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        subjects: updated
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleSaveSettings = () => {
    setCustomModes(tempSettings);
    setIsSettingsOpen(false);
    
    const newModeSeconds = tempSettings[mode] * 60;
    if (!isActive && !isClosing) {
      setTimeLeft(newModeSeconds);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = ((modes[mode] - timeLeft) / modes[mode]) * 100;
  const elapsedSeconds = modes[mode] - timeLeft;
  const displayTotalSeconds = todayStudySeconds + (isActive && mode === 'pomodoro' ? elapsedSeconds : 0);

  // Helper for rank badges
  const getRankBadge = (totalSecs: number) => {
    const hours = (totalSecs || 0) / 3600;
    if (hours >= 10) return { label: 'Grandmaster', icon: Crown, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (hours >= 7) return { label: 'Master', icon: GraduationCap, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    if (hours >= 3) return { label: 'Scholar', icon: BookOpen, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
    return { label: 'Novice', icon: Book, color: 'text-slate-400 bg-slate-800 border-slate-700' };
  };

  // ===============================================================
  // FULL SCREEN FOCUS MODE VIEW
  // ===============================================================
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-between p-4 sm:p-8 h-[100dvh] w-screen overflow-hidden select-none">
        {/* Background mode glow */}
        <div className={`absolute inset-0 opacity-20 blur-[120px] transition-colors duration-1000 ${
          mode === 'pomodoro' ? 'bg-cyan-500' : mode === 'shortBreak' ? 'bg-emerald-500' : 'bg-blue-500'
        }`} />

        {/* Clean Top Header Bar inside Full Screen: No "Focus General" badge */}
        <header className="w-full max-w-5xl flex items-center justify-between gap-3 relative z-20">
          <div /> {/* Empty left space */}

          <div className="flex items-center gap-2">
            {/* Real-time Live Leaderboard & Groups Button (Compact) */}
            <button
              onClick={() => setShowLiveActivityModal(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              title="Real-time Live Activity & Leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Live Leaderboard</span>
            </button>

            {/* Minimize / Exit Full Screen */}
            <button
              onClick={() => setIsFullScreen(false)}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-md"
              title="Exit Full Screen"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Center Countdown Ring & Smaller Controls */}
        <div className="relative z-20 flex flex-col items-center justify-center my-auto">
          <div className="relative flex items-center justify-center my-2">
            <svg className="w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 transform -rotate-90 drop-shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-slate-900"
                strokeWidth="8"
                fill="none"
              />
              <motion.circle
                cx="50%"
                cy="50%"
                r="45%"
                className={`stroke-current ${
                  mode === 'pomodoro' ? 'text-cyan-400' : mode === 'shortBreak' ? 'text-emerald-400' : 'text-blue-400'
                }`}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: "283", strokeDashoffset: "283" }}
                animate={{ strokeDasharray: "283", strokeDashoffset: 283 - (283 * progress) / 100 }}
                transition={{ duration: 1, ease: "linear" }}
                style={{
                  pathLength: 1,
                  strokeDasharray: "1px 1px"
                }}
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tighter font-mono">
                {formatTime(timeLeft)}
              </div>
              
              <div className="text-xs text-cyan-300 font-mono mt-2 flex flex-col items-center bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-cyan-500/30 shadow-inner">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-sans mb-0.5">Today Total</span>
                {formatTotalTime(displayTotalSeconds)}
              </div>

              {isClosing && (
                <div className="text-xs text-red-400 font-sans tracking-normal mt-2 animate-pulse font-medium">
                  Closing in {closeCountdown}s
                </div>
              )}
            </div>
          </div>

          {/* Compact Action Control Buttons */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={handleStop}
              disabled={timeLeft === modes[mode] && !isActive && !isClosing}
              className="w-11 h-11 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-md"
              title={isClosing ? "End Session Now" : "Stop Session"}
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={toggleTimer}
              disabled={isActive}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl cursor-pointer ${
                isActive 
                  ? 'bg-slate-900/80 border border-slate-800 text-slate-600 cursor-not-allowed' 
                  : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-cyan-500/30 hover:scale-105 active:scale-95 font-bold'
              }`}
            >
              <Play className="w-7 h-7 fill-current ml-0.5" />
            </button>
            <button 
              onClick={() => {
                if (isActive) return;
                setTempSettings(customModes);
                setIsSettingsOpen(true);
              }}
              disabled={isActive}
              className={`w-11 h-11 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center transition-all shadow-md ${
                isActive 
                  ? 'text-slate-700 cursor-not-allowed opacity-40 border-slate-900' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 active:scale-95 cursor-pointer'
              }`}
              title={isActive ? "Settings locked while timer is running" : "Timer Settings"}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {renderLiveActivityModal()}
        {renderSettingsModal()}
        {renderScholarInsightModal()}
      </div>
    );
  }

  // ===============================================================
  // STANDARD IN-PAGE TIMER CARD VIEW (UNTOUCHED ORIGINAL DESIGN)
  // ===============================================================
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 md:p-8 w-full shadow-2xl relative overflow-hidden">
        {/* Background glow based on mode */}
        <div className={`absolute inset-0 opacity-20 blur-[100px] transition-colors duration-1000 ${
          mode === 'pomodoro' ? 'bg-cyan-500' : mode === 'shortBreak' ? 'bg-emerald-500' : 'bg-blue-500'
        }`} />

        {/* Small Discreet Full Screen Button (Renders ONLY after timer is active) */}
        {isActive && (
          <button
            onClick={() => setIsFullScreen(true)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer shadow-md active:scale-95 z-20"
            title="Expand Full Screen Focus"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center">
          {/* ORIGINAL Mode Pills Header (Untouched original design!) */}
          <div className="flex justify-center gap-2 mb-8 bg-slate-800/50 p-1.5 rounded-2xl w-full max-w-sm">
            {(['pomodoro', 'shortBreak', 'longBreak'] as const).map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                disabled={isActive}
                className={`flex-1 px-2 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  mode === m 
                    ? 'bg-slate-700 text-white shadow-lg' 
                    : isActive
                      ? 'text-slate-600 cursor-not-allowed opacity-40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 cursor-pointer'
                }`}
              >
                {m === 'pomodoro' ? 'Focus' : m === 'shortBreak' ? 'Short Break' : 'Long Break'}
              </button>
            ))}
          </div>

          {mode === 'pomodoro' && (
            <div className="w-full max-w-sm mb-8 relative flex flex-col gap-2">
              {!isAddingSubject ? (
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => !isActive && setIsDropdownOpen(!isDropdownOpen)}
                      disabled={isActive}
                      className="w-full bg-slate-800/80 backdrop-blur-md border border-slate-700 hover:border-slate-600 rounded-xl pl-11 pr-10 py-3 text-left text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all disabled:opacity-50 cursor-pointer flex items-center shadow-inner"
                    >
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <BookOpen className={`h-5 w-5 transition-colors ${isActive ? 'text-slate-600' : 'text-cyan-400'}`} />
                      </div>
                      <span className="block truncate font-medium">{subject}</span>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <motion.div animate={{ rotate: isDropdownOpen ? 180 : 0 }}>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute z-50 w-full mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden py-1"
                        >
                          <div className="max-h-48 overflow-y-auto">
                            {subjects.map((sub) => (
                              <div key={sub} className="flex items-center group relative">
                                <button
                                  onClick={() => {
                                    setSubject(sub);
                                    setIsDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors pr-10 ${
                                    subject === sub 
                                      ? 'bg-cyan-500/20 text-cyan-300 font-medium border-l-2 border-cyan-500' 
                                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white border-l-2 border-transparent'
                                  }`}
                                >
                                  {sub}
                                </button>
                                {sub !== 'General' && (
                                  <button
                                    onClick={(e) => handleDeleteSubject(e, sub)}
                                    className="absolute right-2 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete subject"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={() => setIsAddingSubject(true)}
                    disabled={isActive}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    title="Add new subject"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddSubject} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="New subject name..."
                    autoFocus
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newSubject.trim()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAddingSubject(false); setNewSubject(''); }}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="relative flex items-center justify-center mb-8">
            <svg className="w-44 h-44 sm:w-64 sm:h-64 transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-slate-800"
                strokeWidth="8"
                fill="none"
              />
              <motion.circle
                cx="50%"
                cy="50%"
                r="45%"
                className={`stroke-current ${
                  mode === 'pomodoro' ? 'text-cyan-400' : mode === 'shortBreak' ? 'text-emerald-400' : 'text-blue-400'
                }`}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: "283", strokeDashoffset: "283" }}
                animate={{ strokeDasharray: "283", strokeDashoffset: 283 - (283 * progress) / 100 }}
                transition={{ duration: 1, ease: "linear" }}
                style={{
                  pathLength: 1,
                  strokeDasharray: "1px 1px"
                }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <div className="text-4xl sm:text-6xl font-bold text-white tracking-tighter font-mono">
                {formatTime(timeLeft)}
              </div>
              
              {/* Today's total study time */}
              <div className="text-xs sm:text-sm text-cyan-400 font-medium font-mono mt-1 sm:mt-2 opacity-90 flex flex-col items-center bg-slate-900/40 backdrop-blur-sm px-3 py-1 rounded-full shadow-inner border border-white/5">
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest font-sans mb-0.5 leading-none">Today</span>
                {formatTotalTime(displayTotalSeconds)}
              </div>

              {isClosing && (
                <div className="text-xs sm:text-sm text-red-400 font-sans tracking-normal mt-2 animate-pulse font-medium">
                  Closing in {closeCountdown}s
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={handleStop}
              disabled={timeLeft === modes[mode] && !isActive && !isClosing}
              className="w-12 h-12 rounded-xl bg-slate-800/50 text-slate-400 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-95 disabled:opacity-50 disabled:hover:bg-slate-800/50 disabled:hover:text-slate-400 cursor-pointer"
              title={isClosing ? "End Session Now" : "Stop Session"}
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={toggleTimer}
              disabled={isActive}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                isActive 
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed' 
                  : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-cyan-500/25 hover:scale-105 active:scale-95'
              }`}
            >
              <Play className="w-8 h-8 fill-current ml-1" />
            </button>
            <button 
              onClick={() => {
                if (isActive) return;
                setTempSettings(customModes);
                setIsSettingsOpen(true);
              }}
              disabled={isActive}
              className={`w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center transition-all ${
                isActive 
                  ? 'text-slate-700 cursor-not-allowed opacity-40 border border-slate-800' 
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200 active:scale-95 cursor-pointer'
              }`}
              title={isActive ? "Settings locked while timer is running" : "Settings"}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {renderSettingsModal()}

      {/* Real-time Live Activity Modal */}
      {renderLiveActivityModal()}

      {/* Scholar Monthly Insights Modal */}
      {renderScholarInsightModal()}
    </div>
  );

  // Helper render method for Settings Modal
  function renderSettingsModal() {
    return (
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Timer Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Focus Duration (minutes)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="120" 
                    value={tempSettings.pomodoro} 
                    onChange={(e) => setTempSettings({...tempSettings, pomodoro: parseInt(e.target.value) || 1})} 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Short Break (minutes)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={tempSettings.shortBreak} 
                    onChange={(e) => setTempSettings({...tempSettings, shortBreak: parseInt(e.target.value) || 1})} 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Long Break (minutes)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={tempSettings.longBreak} 
                    onChange={(e) => setTempSettings({...tempSettings, longBreak: parseInt(e.target.value) || 1})} 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" 
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => playNotificationSound()}
                  className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95"
                >
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>Test Alarm Sound (সাউন্ড টেস্ট করুন)</span>
                </button>
              </div>

              <button 
                onClick={handleSaveSettings} 
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // Helper render method for Real-Time Live Activity & Leaderboard Modal
  function renderLiveActivityModal() {
    return (
      <AnimatePresence>
        {showLiveActivityModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span>Real-time Live Activity</span>
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        LIVE
                      </span>
                    </h3>
                    <p className="text-xs text-cyan-400 font-medium">Daily study time • Resets at 5:00 AM</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowLiveActivityModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs: Global Leaderboard / My Groups */}
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 mb-4 shrink-0">
                <button
                  onClick={() => setLiveTab('global')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    liveTab === 'global'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Global Scholars ({globalLeaderboard.length})</span>
                </button>

                <button
                  onClick={() => setLiveTab('groups')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    liveTab === 'groups'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>My Groups ({myGroupsData.length})</span>
                </button>
              </div>

              {/* Tab 1: Global Scholars Real-time Leaderboard */}
              {liveTab === 'global' && (
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {globalLeaderboard.map((usr, index) => {
                    const isMe = usr.id === user?.uid;
                    const badge = getRankBadge(usr.todayStudyTime || 0);
                    const BadgeIcon = badge.icon;

                    return (
                      <div
                        key={usr.id}
                        onClick={() => setSelectedScholar(usr)}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group hover:scale-[1.01] active:scale-[0.99] shadow-md ${
                          isMe 
                            ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500/50 hover:border-cyan-400' 
                            : 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800 hover:border-cyan-500/40'
                        }`}
                        title="Click to view monthly study insights"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rank badge */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-inner ${
                            index === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                            index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40' :
                            index === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-600/40' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`font-semibold text-xs sm:text-sm truncate group-hover:text-cyan-300 transition-colors ${isMe ? 'text-cyan-300' : 'text-white'}`}>
                                {usr.name || 'Scholar'}
                              </p>
                              {isMe && (
                                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.2 rounded">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                              <span>{usr.classLevel || 'Class 1'}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <BadgeIcon className="w-3 h-3 text-cyan-400" />
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Realtime Study Time */}
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <p className="font-mono text-xs sm:text-sm font-bold text-cyan-400">
                              {formatTotalTime(usr.todayStudyTime || 0)}
                            </p>
                            <p className="text-[9px] text-slate-500 font-sans uppercase tracking-wider">Today Time</p>
                          </div>
                          <div className="text-slate-500 group-hover:text-cyan-400 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {globalLeaderboard.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No study records yet today. Start focusing to rank up!</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: My Groups Real-time Member Activity */}
              {liveTab === 'groups' && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {myGroupsData.map((grp) => {
                    const elapsed = (isActive && mode === 'pomodoro') ? elapsedSeconds : 0;
                    const membersList = (grp.members || []).map((mUid: string) => {
                      const mProfile = groupUsersMap[mUid];
                      const isMe = mUid === user?.uid;
                      const mTime = (dailyStudyMap[mUid] || 0) + (isMe ? elapsed : 0);
                      return { mUid, mProfile, isMe, mTime };
                    });

                    // Sort members by today's study time descending
                    membersList.sort((a: any, b: any) => b.mTime - a.mTime);

                    return (
                      <div key={grp.id} className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3.5">
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700/50">
                          <h4 className="font-bold text-slate-200 text-xs sm:text-sm flex items-center gap-1.5">
                            <span>#{grp.name}</span>
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded font-mono">
                              {grp.members?.length || 1} members
                            </span>
                          </h4>
                          <span className="text-[9px] text-slate-400 font-mono">Resets at 5:00 AM</span>
                        </div>

                        {/* Group members list with live study time */}
                        <div className="space-y-2">
                          {membersList.map(({ mUid, mProfile, isMe, mTime }: any) => {
                            const scholarObj = mProfile ? { id: mUid, ...mProfile } : { id: mUid, name: `Scholar ${mUid.slice(0, 4)}` };
                            return (
                              <div 
                                key={mUid} 
                                onClick={() => setSelectedScholar(scholarObj)}
                                className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-cyan-500/40 hover:bg-slate-800 transition-all cursor-pointer group shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                                title="Click to view monthly study insights"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 text-xs font-bold shrink-0">
                                    {(scholarObj.name || 'S').slice(0, 1).toUpperCase()}
                                  </div>
                                  <span className={`truncate text-xs font-semibold group-hover:text-cyan-300 transition-colors ${isMe ? 'text-cyan-300' : 'text-slate-200'}`}>
                                    {scholarObj.name} {isMe && '(You)'}
                                  </span>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  <div>
                                    <span className="font-mono text-cyan-400 font-semibold text-[11px] block">
                                      {formatTotalTime(mTime)}
                                    </span>
                                    <span className="text-[8px] text-slate-500 uppercase tracking-wider block font-sans">Today</span>
                                  </div>
                                  <div className="text-slate-500 group-hover:text-cyan-400 transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {myGroupsData.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">You haven't joined any groups yet. Join a group to see live member activity!</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // Helper render method for Selected Scholar Monthly Insights Calendar Modal
  function renderScholarInsightModal() {
    if (!selectedScholar) return null;

    const badge = getRankBadge(selectedScholar.todayStudyTime || selectedScholar.totalStudyTime || 0);
    const BadgeIcon = badge.icon;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-inner shrink-0">
                  {(selectedScholar.name || 'S').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base flex items-center gap-2 truncate">
                    <span className="truncate">{selectedScholar.name || 'Scholar'}</span>
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono shrink-0">
                      {selectedScholar.classLevel || 'Class 1'}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <BadgeIcon className="w-3.5 h-3.5 text-cyan-400" />
                      {badge.label}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                      {selectedScholar.currentStreak || 0}d streak
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedScholar(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Monthly Title & Summary Badge */}
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 mb-4 shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Monthly Calendar ({currentMonthCalendar.monthName})</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-mono font-bold text-cyan-400 block">
                  {formatTotalTime(scholarMonthStats.totalSecs)}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-sans">Month Total</span>
              </div>
            </div>

            {isLoadingScholarData ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading monthly study calendar...</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1">
                {/* Calendar Days of Week Header */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-400 mb-2">
                  <span className="text-red-400/80">Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Monthly Calendar Grid */}
                <div className="grid grid-cols-7 gap-1.5 mb-4">
                  {/* Empty padding cells before first day of month */}
                  {Array.from({ length: currentMonthCalendar.firstDayIndex }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-14 sm:h-16 rounded-xl bg-slate-900/30 border border-transparent opacity-20" />
                  ))}

                  {/* Days of the Month */}
                  {Array.from({ length: currentMonthCalendar.daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const secs = currentMonthCalendar.dailyStudySeconds[dayNum] || 0;
                    const isToday = new Date().getDate() === dayNum;
                    const hasStudied = secs > 0;

                    const mins = Math.floor(secs / 60);
                    const hours = Math.floor(mins / 60);
                    const remMins = mins % 60;

                    let timeDisplay = '';
                    if (hours > 0) {
                      timeDisplay = `${hours}h ${remMins}m`;
                    } else if (mins > 0) {
                      timeDisplay = `${mins}m`;
                    }

                    return (
                      <div
                        key={`day-${dayNum}`}
                        className={`h-14 sm:h-16 p-1.5 rounded-xl border flex flex-col justify-between transition-all relative ${
                          hasStudied
                            ? 'bg-cyan-500/15 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                            : isToday
                              ? 'bg-slate-800/90 border-cyan-400/40 shadow-inner'
                              : 'bg-slate-800/30 border-slate-800/70'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-semibold ${isToday ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                            {dayNum}
                          </span>
                          {hasStudied && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          )}
                        </div>

                        {hasStudied ? (
                          <span className="text-[10px] font-mono font-bold text-cyan-300 leading-tight truncate">
                            {timeDisplay}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-600 font-mono">-</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Summary Bar */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Completed Sessions: <strong className="text-white">{scholarMonthStats.sessionCount}</strong></span>
                  </div>
                  {scholarMonthStats.topSub !== 'None' && (
                    <div className="text-right truncate max-w-[180px]">
                      <span className="text-slate-400 text-[10px] block">Top Subject</span>
                      <strong className="text-amber-300 text-xs truncate block">{scholarMonthStats.topSub}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }
}
