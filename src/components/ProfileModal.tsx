import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, saveUserProfile } from '../lib/firebase';
import { Loader2, X } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  initialProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  isNewUser: boolean;
}

export default function ProfileModal({ isOpen, onClose, uid, initialProfile, onSave, isNewUser }: ProfileModalProps) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [age, setAge] = useState<number | ''>(initialProfile?.age || '');
  const [gender, setGender] = useState(initialProfile?.gender || 'Male');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialProfile?.name || '');
      setAge(initialProfile?.age || '');
      setGender(initialProfile?.gender || 'Male');
      setError(null);
    }
  }, [isOpen, initialProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!age || age <= 0 || age > 150) {
      setError("Please enter a valid age.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const profile: UserProfile = {
        uid,
        name: name.trim(),
        age: Number(age),
        gender,
      };
      await saveUserProfile(profile);
      onSave(profile);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
          >
            {!isNewUser && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                disabled={isSaving}
              >
                <X size={24} />
              </button>
            )}
            
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">
                {isNewUser ? "Welcome! Let's set up your profile" : "Edit Profile"}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                This helps the AI understand you better.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                  placeholder="Your name"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                  placeholder="Your age"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all appearance-none"
                  disabled={isSaving}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-pink-600 hover:bg-pink-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
