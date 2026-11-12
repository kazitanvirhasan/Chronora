import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Edit2, X, Save, Book } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', subject: '' });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotes(notesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notes'));

    return () => unsubscribe();
  }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'notes'), {
        userId: user.uid,
        title: 'New Note',
        content: '',
        subject: 'General',
        createdAt: serverTimestamp(),
      });
      setIsEditing(docRef.id);
      setEditForm({ title: 'New Note', content: '', subject: 'General' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    }
  };

  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notes', id), {
        title: editForm.title,
        content: editForm.content,
        subject: editForm.subject,
      });
      setIsEditing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
      if (isEditing === id) setIsEditing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  const startEdit = (note: any) => {
    setIsEditing(note.id);
    setEditForm({ title: note.title, content: note.content, subject: note.subject });
  };

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-6rem)] flex flex-col">
      <header className="mb-6 flex justify-between items-end flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Notes</h2>
          <p className="text-slate-400">Capture your thoughts and study materials.</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Note</span>
        </button>
      </header>

      <div className="flex-1 min-h-0 flex gap-6">
        {/* Notes List */}
        <div className={`w-full md:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 ${isEditing ? 'hidden md:flex' : 'flex'}`}>
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => startEdit(note)}
                className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${
                  isEditing === note.id
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-slate-200 truncate pr-4">{note.title}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(note.id);
                    }}
                    className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                    {note.subject}
                  </span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2">
                  {note.content || 'No content...'}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {notes.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Book className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No notes yet.</p>
            </div>
          )}
        </div>

        {/* Editor */}
        {isEditing && (
          <div className="flex-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-4 bg-slate-900/80">
              <button 
                onClick={() => setIsEditing(null)}
                className="md:hidden text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="flex-1 min-w-[150px] bg-transparent text-xl font-bold text-white focus:outline-none placeholder:text-slate-600"
                placeholder="Note Title"
              />
              <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                <input
                  type="text"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="flex-1 sm:w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50"
                  placeholder="Subject"
                />
                <button
                  onClick={() => handleSave(isEditing)}
                  className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-4 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
            <textarea
              value={editForm.content}
              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              className="flex-1 w-full bg-transparent p-6 text-slate-300 focus:outline-none resize-none placeholder:text-slate-700 leading-relaxed"
              placeholder="Start typing your notes here..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
