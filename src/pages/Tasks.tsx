import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle2, Circle, AlertCircle, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(tasksData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => unsubscribe();
  }, [user]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        userId: user.uid,
        title: newTaskTitle.trim(),
        completed: false,
        priority,
        createdAt: serverTimestamp(),
      });
      setNewTaskTitle('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const priorityColors = {
    low: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    medium: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Task Manager</h2>
        <p className="text-slate-400">Organize your study goals.</p>
      </header>

      <form onSubmit={addTask} className="mb-8 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
        />
        <div className="flex gap-3">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="flex-1 sm:flex-none bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500 text-slate-950 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <AnimatePresence>
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                task.completed 
                  ? 'bg-slate-900/30 border-slate-800/30 opacity-60' 
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <button onClick={() => toggleTask(task.id, task.completed)} className="flex-shrink-0 p-1">
                {task.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-cyan-500" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <p className={`text-sm sm:text-base truncate transition-all ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {task.title}
                </p>
              </div>

              <div className={`px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                <AlertCircle className="w-3 h-3" />
                <span className="hidden sm:inline capitalize">{task.priority}</span>
              </div>

              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {tasks.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No tasks yet. Add one above!</p>
          </div>
        )}
      </div>
    </div>
  );
}
