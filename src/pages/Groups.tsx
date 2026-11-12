import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  documentId,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  Send, 
  UserPlus, 
  Compass, 
  Copy, 
  Check, 
  Search, 
  LogOut, 
  Trash2,
  X, 
  Share2, 
  Hash, 
  AlertCircle,
  Sparkles,
  ArrowLeft,
  MoreVertical,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getStudyIcon } from '../components/Layout';
import { useSearchParams } from 'react-router-dom';

export default function Groups() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Groups state
  const [groups, setGroups] = useState<any[]>([]);
  const [allPublicGroups, setAllPublicGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<any>(null);

  // Three-dot menu and Group Info modal
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);

  // Messages & Members
  const [messages, setMessages] = useState<any[]>([]);
  const [membersData, setMembersData] = useState<Record<string, any>>({});
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Group Hub Modal (Consolidates Create, Join Code, Discover)
  const [showGroupHubModal, setShowGroupHubModal] = useState(false);
  const [hubTab, setHubTab] = useState<'create' | 'join' | 'discover'>('create');

  // Form states inside Hub
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);

  // Dismiss & Leave modal state
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissError, setDismissError] = useState('');

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // 1. Listen to all groups in real-time
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all: any[] = [];
      const my: any[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data: any = { id: docSnap.id, ...docSnap.data() };
        if (data.members && data.members.includes(user.uid)) {
          my.push(data);
        } else {
          all.push(data);
        }
      });

      setGroups(my);
      setAllPublicGroups(all);

      // Keep active group updated if members change
      setActiveGroup((prev: any) => {
        if (!prev) return null;
        const updated = my.find((g) => g.id === prev.id);
        return updated || null;
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'groups'));

    return () => unsubscribe();
  }, [user]);

  // 2. Handle URL invite link parameter (?join=groupIdOrCode)
  useEffect(() => {
    const joinId = searchParams.get('join');
    if (joinId && user) {
      handleJoinByCode(joinId);
      searchParams.delete('join');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, user]);

  // 3. Listen to messages for active group
  useEffect(() => {
    if (!activeGroup || !user) return;

    const q = query(
      collection(db, 'groupMessages'),
      where('groupId', '==', activeGroup.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'groupMessages'));

    return () => unsubscribe();
  }, [activeGroup, user]);

  // 4. Fetch member profiles for active group
  useEffect(() => {
    if (!activeGroup?.members?.length) return;

    const fetchMembers = async () => {
      try {
        const membersToFetch = activeGroup.members.slice(0, 20);
        if (membersToFetch.length === 0) return;

        const q = query(collection(db, 'users'), where(documentId(), 'in', membersToFetch));
        const snapshot = await getDocs(q);
        const membersMap: Record<string, any> = {};
        snapshot.docs.forEach((docSnap) => {
          membersMap[docSnap.id] = docSnap.data();
        });
        setMembersData(membersMap);
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    };

    fetchMembers();
  }, [activeGroup]);

  // Create new group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGroupName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        members: [user.uid],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setShowGroupHubModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setActiveGroup({ 
        id: docRef.id, 
        name: newGroupName.trim(), 
        description: newGroupDesc.trim(), 
        members: [user.uid],
        createdBy: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    }
  };

  // Join group directly by Group Object
  const handleJoinGroup = async (groupToJoin: any) => {
    if (!user) return;
    try {
      const groupRef = doc(db, 'groups', groupToJoin.id);
      await updateDoc(groupRef, {
        members: arrayUnion(user.uid),
      });

      // Post join greeting message
      await addDoc(collection(db, 'groupMessages'), {
        groupId: groupToJoin.id,
        userId: user.uid,
        text: `👋 ${user.displayName || 'A new member'} joined the group!`,
        timestamp: serverTimestamp(),
      });

      setShowGroupHubModal(false);
      setActiveGroup({
        ...groupToJoin,
        members: [...(groupToJoin.members || []), user.uid],
      });
    } catch (error) {
      console.error('Failed to join group:', error);
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupToJoin.id}`);
    }
  };

  // Join group by Code / ID
  const handleJoinByCode = async (rawCode?: string) => {
    const code = (rawCode || joinCodeInput).trim();
    if (!code || !user) return;

    setIsJoining(true);
    setJoinError('');

    try {
      // 1. Direct match with Document ID
      const groupDocRef = doc(db, 'groups', code);
      const groupSnap = await getDoc(groupDocRef);

      let targetGroup: any = null;

      if (groupSnap.exists()) {
        targetGroup = { id: groupSnap.id, ...groupSnap.data() };
      } else {
        // 2. Search all groups matching prefix or name
        const q = query(collection(db, 'groups'));
        const allSnaps = await getDocs(q);
        const match = allSnaps.docs.find(d => 
          d.id.toLowerCase() === code.toLowerCase() || 
          d.id.slice(0, 6).toLowerCase() === code.toLowerCase()
        );
        if (match) {
          targetGroup = { id: match.id, ...match.data() };
        }
      }

      if (!targetGroup) {
        setJoinError('Invalid Group Code. Please check the code and try again.');
        setIsJoining(false);
        return;
      }

      // Check if already in group
      if (targetGroup.members && targetGroup.members.includes(user.uid)) {
        setActiveGroup(targetGroup);
        setShowGroupHubModal(false);
        setJoinCodeInput('');
        setIsJoining(false);
        return;
      }

      // Add user to group
      await updateDoc(doc(db, 'groups', targetGroup.id), {
        members: arrayUnion(user.uid),
      });

      // Post welcome message
      await addDoc(collection(db, 'groupMessages'), {
        groupId: targetGroup.id,
        userId: user.uid,
        text: `👋 ${user.displayName || 'A new scholar'} joined with invite code!`,
        timestamp: serverTimestamp(),
      });

      setActiveGroup({
        ...targetGroup,
        members: [...(targetGroup.members || []), user.uid],
      });
      setShowGroupHubModal(false);
      setJoinCodeInput('');
    } catch (err: any) {
      setJoinError('Could not join group. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  // Confirm and execute leaving the group
  const handleConfirmLeave = async () => {
    if (!user || !activeGroup) return;
    setIsLeaving(true);

    try {
      const groupRef = doc(db, 'groups', activeGroup.id);
      await updateDoc(groupRef, {
        members: arrayRemove(user.uid),
      });
      setShowLeaveModal(false);
      setActiveGroup(null);
    } catch (error) {
      console.error('Failed to leave group:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  // Confirm and execute dismissing/deleting group
  const handleConfirmDismiss = async () => {
    if (!user || !activeGroup) return;
    setIsDismissing(true);
    setDismissError('');

    try {
      const groupIdToDelete = activeGroup.id;

      // 1. Cleanup messages first
      try {
        const q = query(collection(db, 'groupMessages'), where('groupId', '==', groupIdToDelete));
        const msgsSnap = await getDocs(q);
        const delPromises = msgsSnap.docs.map(mDoc => deleteDoc(doc(db, 'groupMessages', mDoc.id)));
        await Promise.all(delPromises);
      } catch (cleanErr) {
        console.warn('Message cleanup notice:', cleanErr);
      }

      // 2. Delete group document
      await deleteDoc(doc(db, 'groups', groupIdToDelete));

      setShowDismissModal(false);
      setActiveGroup(null);
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      setDismissError(error?.message || 'Could not delete group. Please check permissions.');
    } finally {
      setIsDismissing(false);
    }
  };

  // Search users to invite
  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSearchQuery.trim() || !user) return;

    setIsSearchingUsers(true);
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const queryLower = userSearchQuery.trim().toLowerCase();

      const matched: any[] = [];
      snap.docs.forEach((docSnap) => {
        const uData = docSnap.data();
        if (docSnap.id !== user.uid) {
          const name = (uData.name || '').toLowerCase();
          const email = (uData.email || '').toLowerCase();
          if (name.includes(queryLower) || email.includes(queryLower)) {
            matched.push({ id: docSnap.id, ...uData });
          }
        }
      });

      setSearchResults(matched);
    } catch (err) {
      console.error('User search failed:', err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Invite searched user into active group
  const handleInviteUserToGroup = async (targetUser: any) => {
    if (!activeGroup || !user) return;
    try {
      const groupRef = doc(db, 'groups', activeGroup.id);
      await updateDoc(groupRef, {
        members: arrayUnion(targetUser.id),
      });

      // Post invite notification to chat
      await addDoc(collection(db, 'groupMessages'), {
        groupId: activeGroup.id,
        userId: user.uid,
        text: `✨ ${user.displayName || 'A member'} added ${targetUser.name || 'a scholar'} to the study group!`,
        timestamp: serverTimestamp(),
      });

      setInvitedUserIds(prev => [...prev, targetUser.id]);
    } catch (err) {
      console.error('Failed to invite user:', err);
    }
  };

  // Send message in group
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeGroup || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'groupMessages'), {
        groupId: activeGroup.id,
        userId: user.uid,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groupMessages');
    }
  };

  // Copy code
  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Copy invite link
  const copyInviteLink = (groupId: string) => {
    const link = `${window.location.origin}/groups?join=${groupId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const isOwner = activeGroup && (activeGroup.createdBy === user?.uid || (!activeGroup.createdBy && activeGroup.members?.[0] === user?.uid));

  // ===============================================================
  // MODE 1: FULL SCREEN GROUP CHAT
  // ===============================================================
  if (activeGroup) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col h-[100dvh] w-screen overflow-hidden">
        {/* Full Screen Top Bar: Clean & Compact with Back Arrow + Three Dot Menu */}
        <header className="h-14 px-3 sm:px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 z-20 relative">
          {/* Left: Always visible Back Arrow button */}
          <button
            onClick={() => setActiveGroup(null)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer active:scale-95 shrink-0 shadow-sm"
            title="Back to group list"
          >
            <ArrowLeft className="w-5 h-5 font-bold" />
          </button>

          {/* Center: Group Name & Member Info */}
          <div className="min-w-0 flex-1 text-center sm:text-left px-2">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-base truncate">
                {activeGroup.name}
              </h3>
              {isOwner && (
                <span className="text-[9px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded shrink-0">
                  Owner
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {activeGroup.members?.length || 1} members • #{activeGroup.id.slice(0, 6).toUpperCase()}
            </p>
          </div>

          {/* Right: Three Dot Menu Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowGroupMenu(!showGroupMenu)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer active:scale-95 shadow-sm"
              title="Group Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Three Dot Dropdown Menu */}
            <AnimatePresence>
              {showGroupMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-[110]" 
                    onClick={() => setShowGroupMenu(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 top-12 z-[110] w-52 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 space-y-1"
                  >
                    {/* Option 1: Group Info */}
                    <button
                      onClick={() => {
                        setShowGroupMenu(false);
                        setShowGroupInfoModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-cyan-400 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Info className="w-4 h-4 text-cyan-400" />
                      <span>Group Info & Code</span>
                    </button>

                    {/* Option 2: Invite Members */}
                    <button
                      onClick={() => {
                        setShowGroupMenu(false);
                        setShowInviteModal(true);
                        setUserSearchQuery('');
                        setSearchResults([]);
                        setInvitedUserIds([]);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-cyan-400 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-cyan-400" />
                      <span>Invite Members</span>
                    </button>

                    <div className="border-t border-slate-800/80 my-1" />

                    {/* Option 3: Dismiss (Owner) or Leave (Member) */}
                    {isOwner ? (
                      <button
                        onClick={() => {
                          setShowGroupMenu(false);
                          setDismissError('');
                          setShowDismissModal(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                        <span>Dismiss Group</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowGroupMenu(false);
                          setShowLeaveModal(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        <span>Leave Group</span>
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Full Screen Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950">
          {messages.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Welcome to #{activeGroup.name}!</p>
              <p className="text-xs text-slate-500 mt-1">Start a study session, ask a question, or say hi to your group.</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isMe = msg.userId === user?.uid;
            const senderData = membersData[msg.userId];
            const SenderIcon = getStudyIcon(senderData?.totalStudyTime);

            return (
              <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] sm:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-auto mb-1 shadow-sm">
                      <SenderIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-md ${
                      isMe
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-medium rounded-br-sm'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-bl-sm'
                    }`}
                  >
                    {!isMe && (
                      <div className="flex items-baseline gap-2 mb-1">
                        <p className="text-[10px] font-bold text-cyan-300">
                          {senderData?.name || `Scholar ${msg.userId.slice(0, 4)}`}
                        </p>
                        {senderData?.classLevel && (
                          <span className="text-[8px] text-slate-400 bg-slate-900/60 px-1 py-0.2 rounded border border-white/5">
                            {senderData.classLevel}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="leading-relaxed break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex gap-2 shrink-0">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${activeGroup.name}...`}
            className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 px-4 rounded-xl transition-all flex items-center justify-center font-bold cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* MODAL 1: Group Info Modal */}
        <AnimatePresence>
          {showGroupInfoModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
              >
                <button
                  onClick={() => setShowGroupInfoModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{activeGroup.name}</h3>
                    <p className="text-xs text-slate-400">{activeGroup.members?.length || 1} Members</p>
                  </div>
                </div>

                {activeGroup.description && (
                  <p className="text-xs text-slate-300 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 mb-4">
                    {activeGroup.description}
                  </p>
                )}

                <div className="space-y-3 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 mb-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Group Invite Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={activeGroup.id}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                      <button
                        onClick={() => copyInviteCode(activeGroup.id)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center">
                    <span className="text-xs text-slate-300">Invite Link</span>
                    <button
                      onClick={() => copyInviteLink(activeGroup.id)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowGroupInfoModal(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: Invite Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
              >
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Invite to {activeGroup.name}</h3>
                    <p className="text-xs text-slate-400">Share your group code or search users</p>
                  </div>
                </div>

                <div className="space-y-3 my-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Group Invite Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={activeGroup.id}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                      <button
                        onClick={() => copyInviteCode(activeGroup.id)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-300">Share Instant Invite Link</span>
                      <button
                        onClick={() => copyInviteLink(activeGroup.id)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Direct Search & Invite User
                  </label>
                  <form onSubmit={handleSearchUsers} className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!userSearchQuery.trim() || isSearchingUsers}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Search
                    </button>
                  </form>

                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {searchResults.map((usr) => {
                      const alreadyInGroup = activeGroup.members?.includes(usr.id);
                      const wasInvited = invitedUserIds.includes(usr.id);

                      return (
                        <div
                          key={usr.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-white truncate">{usr.name || 'Scholar'}</p>
                            <p className="text-[10px] text-slate-500 truncate">{usr.email || 'No email'}</p>
                          </div>
                          {alreadyInGroup || wasInvited ? (
                            <span className="text-[10px] text-cyan-400 font-medium bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>{alreadyInGroup ? 'Member' : 'Added'}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInviteUserToGroup(usr)}
                              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer"
                            >
                              Add to Group
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 3: Dismiss Modal */}
        <AnimatePresence>
          {showDismissModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
              >
                <button
                  disabled={isDismissing}
                  onClick={() => setShowDismissModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 disabled:opacity-30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
                  <Trash2 className="w-6 h-6" />
                </div>

                <div className="text-center mb-5">
                  <h3 className="font-bold text-white text-lg">Dismiss Study Group?</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Are you sure you want to dismiss and delete <span className="font-bold text-white">"{activeGroup.name}"</span>? 
                    This will permanently remove the group and all its chat messages for all members.
                  </p>
                </div>

                {dismissError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="break-all">{dismissError}</span>
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    disabled={isDismissing}
                    onClick={() => setShowDismissModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-400 hover:bg-slate-800 text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDismissing}
                    onClick={handleConfirmDismiss}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDismissing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Dismissing...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Yes, Dismiss Group</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 4: Leave Modal */}
        <AnimatePresence>
          {showLeaveModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
              >
                <button
                  disabled={isLeaving}
                  onClick={() => setShowLeaveModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 disabled:opacity-30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4">
                  <LogOut className="w-6 h-6" />
                </div>

                <div className="text-center mb-5">
                  <h3 className="font-bold text-white text-base">Leave Study Group?</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Are you sure you want to leave <span className="font-bold text-white">"{activeGroup.name}"</span>?
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isLeaving}
                    onClick={() => setShowLeaveModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-400 hover:bg-slate-800 text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isLeaving}
                    onClick={handleConfirmLeave}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isLeaving ? 'Leaving...' : 'Leave Group'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===============================================================
  // MODE 2: MAIN GROUPS LIST PAGE (WHEN NO GROUP IS ACTIVE)
  // ===============================================================
  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-6rem)] flex flex-col max-w-4xl mx-auto w-full">
      {/* Top Header */}
      <header className="mb-4 flex items-center justify-between gap-3 flex-shrink-0 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Study Groups
          </h2>
        </div>

        {/* ONLY a single "+" icon button — NO text written! */}
        <button
          onClick={() => {
            setHubTab('create');
            setShowGroupHubModal(true);
          }}
          className="w-10 h-10 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 flex items-center justify-center transition-all shadow-lg shadow-cyan-500/25 active:scale-95 cursor-pointer"
          title="Group Hub (Create / Join / Discover)"
        >
          <Plus className="w-5 h-5 font-bold text-slate-950" />
        </button>
      </header>

      {/* Group List Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => setActiveGroup(group)}
            className="w-full p-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 hover:border-cyan-500/40 hover:bg-slate-800/40 text-left transition-all relative overflow-hidden group cursor-pointer shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-100 text-base truncate flex-1">{group.name}</h3>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                #{group.id.slice(0, 6).toUpperCase()}
              </span>
            </div>
            {group.description && (
              <p className="text-xs text-slate-400 truncate mt-1">{group.description}</p>
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-medium">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{group.members?.length || 1} members</span>
              </div>
            </div>
          </button>
        ))}

        {groups.length === 0 && (
          <div className="text-center py-16 px-4 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 max-w-md mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-cyan-400">
              <Users className="w-7 h-7 opacity-70" />
            </div>
            <p className="text-base font-bold text-slate-200">No Joined Groups</p>
            <p className="text-xs text-slate-400 mt-1 mb-5">Tap the "+" button to create a room, enter an invite code, or discover public groups.</p>
            <button
              onClick={() => {
                setHubTab('create');
                setShowGroupHubModal(true);
              }}
              className="w-10 h-10 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 inline-flex items-center justify-center transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-5 h-5 font-bold" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL: Group Hub (Create / Join Code / Discover) */}
      <AnimatePresence>
        {showGroupHubModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowGroupHubModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4">
                <h3 className="font-bold text-white text-lg">Group Options</h3>
              </div>

              {/* Hub Tabs */}
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 mb-4">
                <button
                  onClick={() => setHubTab('create')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    hubTab === 'create'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Group</span>
                </button>

                <button
                  onClick={() => setHubTab('join')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    hubTab === 'join'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Join Code</span>
                </button>

                <button
                  onClick={() => setHubTab('discover')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    hubTab === 'discover'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Discover ({allPublicGroups.length})</span>
                </button>
              </div>

              {/* Tab 1: Create Group */}
              {hubTab === 'create' && (
                <form onSubmit={handleCreateGroup} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Group Name</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      placeholder="e.g. Medical Aspirants / BCS Champions"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                    <textarea
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none h-20"
                      placeholder="What goals are we focusing on in this room?"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newGroupName.trim()}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                  >
                    Create Group
                  </button>
                </form>
              )}

              {/* Tab 2: Join by Code */}
              {hubTab === 'join' && (
                <form onSubmit={(e) => { e.preventDefault(); handleJoinByCode(); }} className="space-y-3.5">
                  {joinError && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{joinError}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Group Code or Link</label>
                    <input
                      type="text"
                      required
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      placeholder="e.g. 7kLm9P..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!joinCodeInput.trim() || isJoining}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {isJoining ? 'Joining...' : 'Join Group'}
                  </button>
                </form>
              )}

              {/* Tab 3: Discover Public Groups */}
              {hubTab === 'discover' && (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {allPublicGroups.map((group) => (
                    <div
                      key={group.id}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-slate-200 text-xs truncate">{group.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{group.description || 'Public study room'}</p>
                        <span className="text-[10px] text-cyan-400 font-mono mt-1 block">
                          {group.members?.length || 1} members
                        </span>
                      </div>
                      <button
                        onClick={() => handleJoinGroup(group)}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
                      >
                        Join
                      </button>
                    </div>
                  ))}

                  {allPublicGroups.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Compass className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">All existing groups have been joined!</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
