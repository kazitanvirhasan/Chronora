import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  isSameDay, 
  isSameMonth,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isWithinInterval,
  getHours,
  isToday,
  startOfYear,
  subYears,
  addYears,
  isSameWeek
} from 'date-fns';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, Tooltip as RechartsTooltip, YAxis
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// YPT-style vibrant colors for subjects
const SUBJECT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', 
  '#F06292', '#AED581', '#FFD54F', '#4DB6AC', '#7986CB',
  '#BA68C8', '#FF8A65', '#4DD0E1', '#DCE775', '#A1887F'
];

export default function Insights() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');
  const [baseDate, setBaseDate] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'studySessions'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime ? data.startTime.toDate() : new Date(),
          endTime: data.endTime ? data.endTime.toDate() : new Date(),
          type: data.type || 'pomodoro'
        };
      });
      setSessions(sessionsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'studySessions'));

    return () => unsubscribe();
  }, [user]);

  // --- Navigation ---
  const handlePrev = () => {
    if (activeTab === 'day') setBaseDate(subDays(baseDate, 1));
    if (activeTab === 'week') setBaseDate(subWeeks(baseDate, 1));
    if (activeTab === 'month') setBaseDate(subMonths(baseDate, 1));
  };

  const handleNext = () => {
    if (activeTab === 'day') setBaseDate(addDays(baseDate, 1));
    if (activeTab === 'week') setBaseDate(addWeeks(baseDate, 1));
    if (activeTab === 'month') setBaseDate(addMonths(baseDate, 1));
  };

  const getDateLabel = () => {
    if (activeTab === 'day') {
      if (isToday(baseDate)) return 'Today';
      return format(baseDate, 'MMM d, yyyy');
    }
    if (activeTab === 'week') {
      const start = startOfWeek(baseDate, { weekStartsOn: 1 });
      const end = endOfWeek(baseDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
    }
    if (activeTab === 'month') {
      return format(baseDate, 'MMMM yyyy');
    }
  };

  // --- Data Processing ---
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.type !== 'pomodoro') return false; // Only count study time
      if (activeTab === 'day') return isSameDay(s.startTime, baseDate);
      if (activeTab === 'week') {
        const start = startOfWeek(baseDate, { weekStartsOn: 1 });
        const end = endOfWeek(baseDate, { weekStartsOn: 1 });
        return isWithinInterval(s.startTime, { start, end });
      }
      if (activeTab === 'month') return isSameMonth(s.startTime, baseDate);
      return false;
    });
  }, [sessions, activeTab, baseDate]);

  const totalSeconds = filteredSessions.reduce((acc, s) => acc + s.duration, 0);

  const subjectData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const sub = s.subject || 'General';
      map[sub] = (map[sub] || 0) + s.duration;
    });
    
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
        percentage: totalSeconds > 0 ? (item.value / totalSeconds) * 100 : 0
      }));
  }, [filteredSessions, totalSeconds]);

  // --- Formatting ---
  const formatExactTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatShortTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // --- Charts Data ---
  const timelineData = useMemo(() => {
    if (activeTab !== 'day') return [];
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, value: 0 }));
    filteredSessions.forEach(s => {
      const h = getHours(s.startTime);
      hours[h].value += s.duration;
    });
    return hours;
  }, [filteredSessions, activeTab]);

  const barChartData = useMemo(() => {
    if (activeTab === 'day') return [];
    
    let days: Date[] = [];
    if (activeTab === 'week') {
      days = eachDayOfInterval({
        start: startOfWeek(baseDate, { weekStartsOn: 1 }),
        end: endOfWeek(baseDate, { weekStartsOn: 1 })
      });
    } else if (activeTab === 'month') {
      days = eachDayOfInterval({
        start: startOfMonth(baseDate),
        end: endOfMonth(baseDate)
      });
    }

    return days.map(day => {
      const daySecs = filteredSessions
        .filter(s => isSameDay(s.startTime, day))
        .reduce((acc, s) => acc + s.duration, 0);
      
      return {
        date: day,
        name: activeTab === 'week' ? format(day, 'EEE') : format(day, 'd'),
        value: Number((daySecs / 3600).toFixed(2)), // in hours for chart
        rawSeconds: daySecs
      };
    });
  }, [filteredSessions, activeTab, baseDate]);


  // --- Interactive Calendar Navigator ---
  const renderCalendarNavigator = () => {
    const formatTinyTime = (seconds: number) => {
      if (seconds === 0) return '';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (h > 0 && m > 0) return `${h}h ${m}m`;
      if (h > 0) return `${h}h`;
      return `${m}m`;
    };

    if (activeTab === 'day') {
      const monthStart = startOfMonth(baseDate);
      const monthEnd = endOfMonth(monthStart);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-3 shadow-sm mb-6 max-w-sm mx-auto">
          <div className="flex justify-between items-center mb-3">
            <button onClick={() => setBaseDate(subMonths(baseDate, 1))} className="p-1 hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-400"/></button>
            <span className="font-bold text-white text-base">{format(baseDate, 'MMMM yyyy')}</span>
            <button onClick={() => setBaseDate(addMonths(baseDate, 1))} className="p-1 hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-400"/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
              <div key={i} className="text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = isSameDay(day, baseDate);
              const secs = sessions.filter(s => s.type === 'pomodoro' && isSameDay(s.startTime, day)).reduce((a, b) => a + b.duration, 0);
              
              let bgClass = 'bg-slate-800/30 text-slate-500 hover:bg-slate-700/50';
              if (secs > 0) bgClass = 'bg-cyan-900/60 text-cyan-300 hover:bg-cyan-800/60';
              if (secs > 3600 * 2) bgClass = 'bg-cyan-700/80 text-cyan-100 hover:bg-cyan-600/80';
              if (secs > 3600 * 4) bgClass = 'bg-cyan-500 text-slate-900 hover:bg-cyan-400';
              if (secs > 3600 * 6) bgClass = 'bg-cyan-300 text-slate-900 hover:bg-cyan-200';
              if (secs > 3600 * 8) bgClass = 'bg-cyan-100 text-slate-900 font-bold hover:bg-white';

              return (
                <button
                  key={i}
                  onClick={() => setBaseDate(day)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all p-0.5 ${
                    !isCurrentMonth ? 'opacity-40' : ''
                  } ${isSelected ? 'ring-1 ring-white ring-offset-1 ring-offset-slate-900 scale-105 z-10 shadow-lg' : ''} ${bgClass}`}
                >
                  <span className="font-semibold text-xs leading-none">{format(day, 'd')}</span>
                  {secs > 0 && <span className="text-[7.5px] sm:text-[9px] mt-0.5 sm:mt-1 leading-none opacity-90 tracking-tighter truncate w-full px-0.5 text-center">{formatTinyTime(secs)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'week') {
      const weeks = Array.from({ length: 12 }).map((_, i) => subWeeks(new Date(), 11 - i));
      
      return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-3 shadow-sm mb-6 max-w-sm mx-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-white text-base px-2">Recent Weeks</span>
          </div>
          <div className="flex overflow-x-auto gap-1.5 pb-2 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {weeks.map((week, i) => {
              const start = startOfWeek(week, { weekStartsOn: 1 });
              const end = endOfWeek(week, { weekStartsOn: 1 });
              const isSelected = isSameWeek(week, baseDate, { weekStartsOn: 1 });
              const secs = sessions.filter(s => s.type === 'pomodoro' && isWithinInterval(s.startTime, { start, end })).reduce((a, b) => a + b.duration, 0);
              
              let bgClass = 'bg-slate-800/30 text-slate-500 hover:bg-slate-700/50';
              if (secs > 0) bgClass = 'bg-cyan-900/60 text-cyan-300 hover:bg-cyan-800/60';
              if (secs > 3600 * 10) bgClass = 'bg-cyan-700/80 text-cyan-100 hover:bg-cyan-600/80';
              if (secs > 3600 * 20) bgClass = 'bg-cyan-500 text-slate-900 hover:bg-cyan-400';
              if (secs > 3600 * 30) bgClass = 'bg-cyan-300 text-slate-900 hover:bg-cyan-200';
              if (secs > 3600 * 40) bgClass = 'bg-cyan-100 text-slate-900 font-bold hover:bg-white';

              return (
                <button
                  key={i}
                  onClick={() => setBaseDate(week)}
                  className={`snap-end flex-shrink-0 w-20 py-2 rounded-lg flex flex-col items-center justify-center transition-all ${
                    isSelected ? 'ring-1 ring-white ring-offset-1 ring-offset-slate-900 scale-105 z-10 shadow-lg' : ''
                  } ${bgClass}`}
                >
                  <span className="text-[8.5px] uppercase mb-0.5 opacity-80">{format(start, 'MMM')}</span>
                  <span className="font-bold text-xs">{format(start, 'd')} - {format(end, 'd')}</span>
                  {secs > 0 && <span className="text-[7.5px] sm:text-[9px] mt-0.5 sm:mt-1 leading-none opacity-90 tracking-tighter truncate w-full px-0.5 text-center">{formatTinyTime(secs)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'month') {
      const yearStart = startOfYear(baseDate);
      const months = Array.from({ length: 12 }).map((_, i) => addMonths(yearStart, i));
      
      return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-3 shadow-sm mb-6 max-w-sm mx-auto">
          <div className="flex justify-between items-center mb-3">
            <button onClick={() => setBaseDate(subYears(baseDate, 1))} className="p-1 hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-400"/></button>
            <span className="font-bold text-white text-base">{format(baseDate, 'yyyy')}</span>
            <button onClick={() => setBaseDate(addYears(baseDate, 1))} className="p-1 hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-400"/></button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {months.map((month, i) => {
              const isSelected = isSameMonth(month, baseDate);
              const secs = sessions.filter(s => s.type === 'pomodoro' && isSameMonth(s.startTime, month)).reduce((a, b) => a + b.duration, 0);
              
              let bgClass = 'bg-slate-800/30 text-slate-500 hover:bg-slate-700/50';
              if (secs > 0) bgClass = 'bg-cyan-900/60 text-cyan-300 hover:bg-cyan-800/60';
              if (secs > 3600 * 20) bgClass = 'bg-cyan-700/80 text-cyan-100 hover:bg-cyan-600/80';
              if (secs > 3600 * 50) bgClass = 'bg-cyan-500 text-slate-900 hover:bg-cyan-400';
              if (secs > 3600 * 80) bgClass = 'bg-cyan-300 text-slate-900 hover:bg-cyan-200';
              if (secs > 3600 * 120) bgClass = 'bg-cyan-100 text-slate-900 font-bold hover:bg-white';

              return (
                <button
                  key={i}
                  onClick={() => setBaseDate(month)}
                  className={`py-3 rounded-lg flex flex-col items-center justify-center transition-all ${
                    isSelected ? 'ring-1 ring-white ring-offset-1 ring-offset-slate-900 scale-105 z-10 shadow-lg' : ''
                  } ${bgClass}`}
                >
                  <span className="font-bold text-xs">{format(month, 'MMM')}</span>
                  {secs > 0 && <span className="text-[7.5px] sm:text-[9px] mt-0.5 sm:mt-1 leading-none opacity-90 tracking-tighter truncate w-full px-0.5 text-center">{formatTinyTime(secs)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-20 md:pb-0">
      
      {/* YPT Style Tabs */}
      <div className="flex justify-center mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-full p-1 flex shadow-lg">
          {(['day', 'week', 'month'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-full text-sm font-bold capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-cyan-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Calendar Navigator */}
      {renderCalendarNavigator()}

      {/* Total Time Display */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8 text-center shadow-sm flex flex-col items-center justify-center">
        <p className="text-slate-400 font-medium mb-2 uppercase tracking-widest text-xs">Total Study Time</p>
        <h1 className="text-5xl md:text-6xl font-black text-white font-mono tracking-tight">
          {formatExactTime(totalSeconds)}
        </h1>
        {activeTab !== 'day' && (
          <p className="text-slate-400 mt-4 font-medium">
            Daily Average: <span className="text-cyan-400">{formatShortTime(totalSeconds / (activeTab === 'week' ? 7 : barChartData.length))}</span>
          </p>
        )}
      </div>

      {/* Timeline / Bar Chart */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 shadow-sm">
        <h3 className="text-slate-300 font-bold mb-6">
          {activeTab === 'day' ? 'Timeline' : 'Study Trend'}
        </h3>
        
        {activeTab === 'day' ? (
          <div className="space-y-2">
            <div className="flex h-12 items-end gap-1">
              {timelineData.map((hour, i) => {
                const height = hour.value > 0 ? Math.max((hour.value / 3600) * 100, 15) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end h-full group relative">
                    {hour.value > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-nowrap">
                        {formatShortTime(hour.value)}
                      </div>
                    )}
                    <div 
                      className={`w-full rounded-t-sm transition-all ${hour.value > 0 ? 'bg-cyan-400' : 'bg-slate-800/50'}`} 
                      style={{ height: hour.value > 0 ? `${height}%` : '4px' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-medium px-1">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#1e293b' }} 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#fff' }}
                  formatter={(value: number, name: string, props: any) => [formatShortTime(props.payload.rawSeconds), 'Study Time']}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Subject Breakdown (Donut + List) */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 shadow-sm">
        <h3 className="text-slate-300 font-bold mb-6">Subjects</h3>
        
        {subjectData.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Donut Chart */}
            <div className="w-48 h-48 flex-shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {subjectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => [formatShortTime(value), 'Time']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Total</span>
                <span className="text-white font-bold text-sm">{formatShortTime(totalSeconds)}</span>
              </div>
            </div>

            {/* Subject List */}
            <div className="flex-1 w-full space-y-4">
              {subjectData.map((sub) => (
                <div key={sub.name} className="w-full">
                  <div className="flex justify-between items-end mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }} />
                      <span className="text-slate-200 font-medium text-sm">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 font-bold text-sm">{formatExactTime(sub.value)}</span>
                      <span className="text-slate-500 text-xs w-8 text-right">{Math.round(sub.percentage)}%</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${sub.percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: sub.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No study data for this period.
          </div>
        )}
      </div>

    </div>
  );
}
