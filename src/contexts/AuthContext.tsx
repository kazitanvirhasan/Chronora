import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name?: string) => Promise<User>;
  sendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  reloadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Check if user exists in Firestore, if not create them
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Scholar',
              email: firebaseUser.email || '',
              avatar: firebaseUser.photoURL || '',
              bio: '',
              xp: 0,
              level: 1,
              totalStudyTime: 0,
              currentStreak: 0,
              subjects: ['General'],
              classLevel: 'Class 1',
              statusMessage: 'Ready to study!',
              region: 'Bangladesh',
              createdAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error logging in with Google', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error('Error logging in with email', error);
      throw error;
    }
  };

  const signupWithEmail = async (email: string, password: string, name?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;
      
      if (name && name.trim()) {
        await updateProfile(newUser, { displayName: name.trim() });
      }

      // Automatically send email verification link upon sign-up
      try {
        await sendEmailVerification(newUser);
      } catch (verificationErr) {
        console.warn('Failed to send initial verification email:', verificationErr);
      }

      // Initialize Firestore document
      try {
        const userRef = doc(db, 'users', newUser.uid);
        await setDoc(userRef, {
          uid: newUser.uid,
          name: name?.trim() || newUser.displayName || email.split('@')[0] || 'Scholar',
          email: newUser.email || email,
          avatar: '',
          bio: '',
          xp: 0,
          level: 1,
          totalStudyTime: 0,
          currentStreak: 0,
          subjects: ['General'],
          classLevel: 'Class 1',
          statusMessage: 'Ready to study!',
          region: 'Bangladesh',
          createdAt: serverTimestamp(),
        });
      } catch (docErr) {
        console.error('Failed to create user doc:', docErr);
      }

      return newUser;
    } catch (error) {
      console.error('Error signing up with email', error);
      throw error;
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in');
    }
    await sendEmailVerification(auth.currentUser);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser } as User);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error logging out', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      loginWithGoogle, 
      loginWithEmail, 
      signupWithEmail, 
      sendVerificationEmail, 
      sendPasswordReset, 
      reloadUser, 
      logout 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
