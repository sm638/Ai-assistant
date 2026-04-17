/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, Loader2, Power, LogIn, LogOut, Settings2, Users, UserCircle } from 'lucide-react';
import { LiveSession, SessionState } from './lib/live/LiveSession';
import { auth, loginWithGoogle, logout, getUserProfile, UserProfile } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import ProfileModal from './components/ProfileModal';

export default function App() {
  const [state, setState] = useState<SessionState>("disconnected");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedRole, setSelectedRole] = useState("gf");
  const [caption, setCaption] = useState<string>("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const sessionRef = useRef<LiveSession | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile) {
            setUserProfile(profile);
          } else {
            setIsNewUser(true);
            setIsProfileModalOpen(true);
          }
        } catch (err) {
          console.error("Failed to fetch profile", err);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => {
      unsubscribe();
      sessionRef.current?.disconnect();
    };
  }, []);

  const toggleSession = async () => {
    if (!user) {
      setErrorMsg("Please login first to talk to me!");
      return;
    }
    setErrorMsg(null);
    if (state === "disconnected") {
      if (!userProfile) {
        setErrorMsg("Please complete your profile first.");
        setIsNewUser(true);
        setIsProfileModalOpen(true);
        return;
      }
      setCaption("");
      setQuickReplies([]);
      sessionRef.current = new LiveSession(setState, setErrorMsg, setCaption, setQuickReplies, user.uid);
      await sessionRef.current.connect(selectedVoice, selectedRole, userProfile);
    } else {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setCaption("");
      setQuickReplies([]);
    }
  };

  const getOrbState = () => {
    switch (state) {
      case "disconnected":
        return {
          scale: [1, 1.05, 1],
          opacity: 0.5,
          boxShadow: "0px 0px 20px rgba(236, 72, 153, 0.2)",
          transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
        };
      case "connecting":
        return {
          scale: [1, 1.1, 1],
          opacity: 0.8,
          boxShadow: "0px 0px 30px rgba(236, 72, 153, 0.5)",
          transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
        };
      case "listening":
        return {
          scale: [1, 1.15, 1],
          opacity: 1,
          boxShadow: "0px 0px 50px rgba(236, 72, 153, 0.8)",
          transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        };
      case "speaking":
        return {
          scale: [1, 1.3, 1.1, 1.25, 1],
          opacity: 1,
          boxShadow: "0px 0px 80px rgba(236, 72, 153, 1)",
          transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
        };
    }
  };

  const handleQuickReplyClick = (reply: string) => {
    if (sessionRef.current) {
      sessionRef.current.sendText(reply);
      setQuickReplies([]);
    }
  };

  const isMale = ["Fenrir", "Charon", "Puck"].includes(selectedVoice);
  let displayName = "";
  let displayRole = "";
  switch(selectedRole) {
    case "gf": displayName = "Debolina"; displayRole = "Your Virtual Girlfriend"; break;
    case "bf": displayName = "Rahul"; displayRole = "Your Virtual Boyfriend"; break;
    case "friend": displayName = isMale ? "Soumalya" : "Priya"; displayRole = "Your Best Friend"; break;
    case "brother": displayName = "Dada"; displayRole = "Your Brother"; break;
    case "sister": displayName = "Didi"; displayRole = "Your Sister"; break;
    case "mother": displayName = "Maa"; displayRole = "Your Mother"; break;
    case "father": displayName = "Baba"; displayRole = "Your Father"; break;
    default: displayName = "Debolina"; displayRole = "Your Virtual Girlfriend";
  }

  const getStatusText = () => {
    if (!user) return `Login to meet ${displayName}`;
    switch (state) {
      case "disconnected": return `Tap to Wake ${displayName}`;
      case "connecting": return "Connecting...";
      case "listening": return "Listening...";
      case "speaking": return `${displayName} is speaking...`;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-pink-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden font-sans selection:bg-pink-500/30">
      {/* Top Left Bar for Voice & Role Selection */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
          <Settings2 className="text-pink-400" size={16} />
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={state !== "disconnected"}
            className="bg-transparent text-pink-200 text-sm outline-none cursor-pointer disabled:opacity-50 appearance-none pr-4"
          >
            <optgroup label="Female Voices" className="bg-gray-900 text-white">
              <option value="Kore">Kore (Sweet & Natural)</option>
              <option value="Zephyr">Zephyr (Mature & Confident)</option>
            </optgroup>
            <optgroup label="Male Voices" className="bg-gray-900 text-white">
              <option value="Fenrir">Fenrir (Deep & Strong)</option>
              <option value="Charon">Charon (Smooth & Calm)</option>
              <option value="Puck">Puck (Young & Energetic)</option>
            </optgroup>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
          <Users className="text-pink-400" size={16} />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={state !== "disconnected"}
            className="bg-transparent text-pink-200 text-sm outline-none cursor-pointer disabled:opacity-50 appearance-none pr-4"
          >
            <option value="gf">Girlfriend</option>
            <option value="bf">Boyfriend</option>
            <option value="friend">Best Friend</option>
            <option value="brother">Brother</option>
            <option value="sister">Sister</option>
            <option value="mother">Mother</option>
            <option value="father">Father</option>
          </select>
        </div>
      </div>

      {/* Top Right Bar for Auth & Profile */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        {user ? (
          <>
            <button
              onClick={() => {
                setIsNewUser(false);
                setIsProfileModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
            >
              <UserCircle size={16} />
              <span className="hidden sm:inline">{userProfile?.name || "Profile"}</span>
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </>
        ) : (
          <button 
            onClick={loginWithGoogle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors shadow-[0_0_15px_rgba(236,72,153,0.3)]"
          >
            <LogIn size={16} />
            Login with Google
          </button>
        )}
      </div>

      {/* Background ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          className="w-[600px] h-[600px] rounded-full bg-pink-600/10 blur-[100px]"
          animate={{
            scale: state === 'speaking' ? [1, 1.2, 1] : 1,
            opacity: state === 'disconnected' ? 0.3 : 0.8
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent">
            {displayName}
          </h1>
          <p className="text-pink-200/60 font-medium tracking-wide uppercase text-sm">
            {displayRole}
          </p>
        </div>

        <button 
          onClick={toggleSession}
          className="relative group outline-none"
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500"
            animate={getOrbState()}
          />
          
          {/* Main Button */}
          <motion.div 
            className="relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-b from-gray-900 to-black border border-pink-500/30 flex items-center justify-center shadow-2xl overflow-hidden"
            animate={getOrbState()}
          >
            {/* Inner dynamic background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-purple-500/10" />
            
            {/* Icon */}
            <div className="relative z-10 text-pink-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]">
              {state === "disconnected" && <Power size={48} strokeWidth={1.5} />}
              {state === "connecting" && <Loader2 size={48} strokeWidth={1.5} className="animate-spin" />}
              {state === "listening" && <Mic size={48} strokeWidth={1.5} />}
              {state === "speaking" && (
                <div className="flex gap-1.5 items-center justify-center h-12">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-pink-400 rounded-full"
                      animate={{
                        height: ["20%", "100%", "20%"]
                      }}
                      transition={{
                        duration: 0.5 + Math.random() * 0.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.1
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </button>

        <motion.div 
          className="h-8 flex flex-col items-center justify-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={state}
        >
          <p className="text-pink-200/80 font-medium tracking-wide">
            {getStatusText()}
          </p>
          {errorMsg && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-pink-400 font-medium text-center max-w-md px-4 mt-4 italic"
            >
              "{errorMsg}"
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Caption Overlay */}
      {caption && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-32 left-0 right-0 px-8 flex justify-center pointer-events-none z-40"
        >
          <p className="text-white/90 text-lg md:text-xl font-medium text-center max-w-4xl bg-black/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
            {caption}
          </p>
        </motion.div>
      )}

      {/* Quick Replies */}
      {quickReplies.length > 0 && state !== "disconnected" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-12 left-0 right-0 px-4 flex justify-center gap-3 flex-wrap z-50"
        >
          {quickReplies.map((reply, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickReplyClick(reply)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full text-sm md:text-base font-medium transition-all shadow-lg active:scale-95"
            >
              {reply}
            </button>
          ))}
        </motion.div>
      )}

      {user && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          uid={user.uid}
          initialProfile={userProfile}
          isNewUser={isNewUser}
          onSave={(profile) => {
            setUserProfile(profile);
            setIsNewUser(false);
          }}
        />
      )}
    </div>
  );
}
