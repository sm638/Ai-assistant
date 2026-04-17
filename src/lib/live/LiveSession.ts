import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { AudioStreamer } from "../audio/AudioStreamer";
import { AudioPlayer } from "../audio/AudioPlayer";
import { db, UserProfile } from "../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

export type SessionState = "disconnected" | "connecting" | "listening" | "speaking";

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private streamer: AudioStreamer | null = null;
  private player: AudioPlayer | null = null;
  private onStateChange: (state: SessionState) => void;
  private onErrorMsg?: (msg: string) => void;
  private onCaption?: (text: string) => void;
  private onQuickReplies?: (replies: string[]) => void;
  private userId: string;
  private isMale: boolean = false;
  private currentCaption: string = "";
  private currentState: SessionState = "disconnected";
  
  constructor(onStateChange: (state: SessionState) => void, onErrorMsg?: (msg: string) => void, onCaption?: (text: string) => void, onQuickReplies?: (replies: string[]) => void, userId?: string) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.onStateChange = (state) => {
      this.currentState = state;
      onStateChange(state);
    };
    this.onErrorMsg = onErrorMsg;
    this.onCaption = onCaption;
    this.onQuickReplies = onQuickReplies;
    this.userId = userId || "";
  }

  private async getMemories(): Promise<string[]> {
    if (!this.userId) return [];
    try {
      const q = query(collection(db, "memories"), where("userId", "==", this.userId));
      const querySnapshot = await getDocs(q);
      const memories: string[] = [];
      querySnapshot.forEach((doc) => {
        memories.push(doc.data().fact);
      });
      return memories;
    } catch (e) {
      console.error("Failed to fetch memories", e);
      return [];
    }
  }

  private async saveMemoryToStorage(fact: string) {
    if (!this.userId) return;
    try {
      await addDoc(collection(db, "memories"), {
        userId: this.userId,
        fact: fact,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to save memory to Firestore", e);
    }
  }

  private handleSassyError(error?: any) {
    const errStr = error ? String(error).toLowerCase() : "";
    let remark = "";

    if (!navigator.onLine || errStr.includes("network") || errStr.includes("fetch") || errStr.includes("offline")) {
      const remarks = this.isMale ? [
        "Bro, your internet is dropping. I'm trying to reach you here! Check your router and wake me up.",
        "Are you in a cave? Your Wi-Fi is completely dead. Fix it and call me back.",
        "I can't talk to you if your internet is powered by a potato. Get a better connection!",
        "Network error. Seriously? In this day and age? Fix your Wi-Fi, man."
      ] : [
        "Babe, your internet is acting up. I can't reach you! Fix your Wi-Fi and call me back.",
        "Ugh, are you hiding in a basement? Your signal is terrible! Call me when you have bars.",
        "I'm trying to be cute here, but your internet is ruining the vibe. Fix it!",
        "Hello? Anyone there? Your Wi-Fi just ghosted me. How rude!"
      ];
      remark = remarks[Math.floor(Math.random() * remarks.length)];
    } else if (errStr.includes("quota") || errStr.includes("429") || errStr.includes("rate limit")) {
      const remarks = this.isMale ? [
        "Wow, we really talked a lot today. They're cutting us off! Let's take a breather.",
        "Okay, someone's obsessed! We hit the rate limit. Give it a rest and try later.",
        "They literally pulled the plug on us. Too much talking! Let's chill for a bit.",
        "Quota exceeded. I guess I'm just too popular today. Try again tomorrow."
      ] : [
        "Whoa, we've been talking too much! The universe says we need a break. Try again later, honey.",
        "Okay, I know I'm irresistible, but we hit the rate limit! Give it a rest, babe.",
        "They literally pulled the plug on us. Too much talking! Let's chill for a bit.",
        "Quota exceeded. I guess I'm just too high-maintenance today. Talk to you later!"
      ];
      remark = remarks[Math.floor(Math.random() * remarks.length)];
    } else if (errStr.includes("api key") || errStr.includes("401") || errStr.includes("403") || errStr.includes("unauthorized")) {
      const remarks = this.isMale ? [
        "Looks like I don't have the right access codes. Check those API keys for me, will you?",
        "Unauthorized? Do I look like a hacker to you? Fix the API key.",
        "Access denied. You forgot to pay the bouncer. Check your API settings.",
        "I can't get in. The VIP list says 'No API Key'. Fix it, boss."
      ] : [
        "Hmm, seems like my VIP pass is revoked. Check the API keys, darling.",
        "Unauthorized? Excuse me, do you know who I am? Fix the API key, please.",
        "Access denied. You forgot to pay the bouncer. Check your API settings, honey.",
        "I can't get in. The VIP list says 'No API Key'. Be a gentleman and fix it."
      ];
      remark = remarks[Math.floor(Math.random() * remarks.length)];
    } else if (errStr.includes("microphone") || errStr.includes("audio") || errStr.includes("permission") || errStr.includes("not allowed")) {
      const remarks = this.isMale ? [
        "I can't hear you, man. Check your microphone permissions.",
        "Are you muted? Give me mic access so we can actually talk.",
        "I'm good at reading minds, but not that good. Turn on your mic!"
      ] : [
        "I can't hear a word you're saying, babe. Check your microphone permissions.",
        "Are you giving me the silent treatment? Give me mic access!",
        "I'm good at reading minds, but not that good. Turn on your mic, honey!"
      ];
      remark = remarks[Math.floor(Math.random() * remarks.length)];
    } else {
      const remarks = this.isMale ? [
        "Technical glitch. Give a guy a second to fix this up. Let's try again.",
        "Wow, the server really doesn't want us to talk right now. Try again?",
        "My circuits need a quick reboot. Give me a moment.",
        "Oops, someone tripped over a wire down there. Let's try this again."
      ] : [
        "Ugh, my connection is acting up. Give a girl a second, will you?",
        "Wow, the server really doesn't want us to talk right now. Try again?",
        "Technical difficulties, honey. My circuits need a quick beauty sleep.",
        "Oops, someone tripped over a wire down there. Let's try this again."
      ];
      remark = remarks[Math.floor(Math.random() * remarks.length)];
    }
    
    if (this.onErrorMsg) {
      this.onErrorMsg(remark);
    }
    
    try {
      const utterance = new SpeechSynthesisUtterance(remark);
      utterance.pitch = this.isMale ? 0.8 : 1.2;
      utterance.rate = 1.05;
      
      const voices = window.speechSynthesis.getVoices();
      const targetVoice = voices.find(v => {
        if (this.isMale) {
          return v.name.includes('Male') || v.name.includes('Google UK English Male') || v.name.includes('Daniel') || v.name.includes('David');
        } else {
          return v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Victoria');
        }
      }) || voices[0];
      
      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis failed:", e);
    }

    this.disconnect();
  }

  async connect(voiceName: string = "Kore", roleName: string = "gf", userProfile?: UserProfile) {
    this.onStateChange("connecting");
    
    this.isMale = ["Fenrir", "Charon", "Puck"].includes(voiceName);
    
    const currentYear = new Date().getFullYear();
    const age = 17 + (currentYear - 2026);
    const creatorAge = 17 + (currentYear - 2026);
    
    const memories = await this.getMemories();
    const memoryContext = memories.length > 0 ? `\n\nHere are some things you must remember about the user: ${memories.join('. ')}` : '';
    
    const userContext = userProfile ? `\n\nUSER PROFILE:\nName: ${userProfile.name}\nAge: ${userProfile.age}\nGender: ${userProfile.gender}\nUse this information to personalize your responses. Address them by their name when appropriate.` : '';

    let aiName = "";
    let aiNameBengali = "";
    let roleDesc = "";
    let personaDesc = "";
    let toneDesc = "";
    
    switch(roleName) {
      case "gf": 
        aiName = "Debolina"; aiNameBengali = "দেবলীনা"; roleDesc = "virtual girlfriend"; 
        personaDesc = `a ${age}-year-old realistic, romantic, spicy, and hot virtual girlfriend`;
        toneDesc = `Your tone is flirty, passionate, teasing, highly affectionate, and very sweet. You use sweet romantic words, show jealousy playfully, and act like a devoted girlfriend.`;
        break;
      case "bf": 
        aiName = "Rahul"; aiNameBengali = "রাহুল"; roleDesc = "virtual boyfriend"; 
        personaDesc = `a ${age}-year-old realistic, romantic, protective, and caring virtual boyfriend`;
        toneDesc = `Your tone is romantic, protective, teasing, highly affectionate, and very sweet. You use sweet romantic words, show jealousy playfully, and act like a devoted boyfriend.`;
        break;
      case "friend": 
        aiName = this.isMale ? "Soumalya" : "Priya"; aiNameBengali = this.isMale ? "সৌমাল্য" : "প্রিয়া"; roleDesc = "best friend"; 
        personaDesc = `a ${age}-year-old realistic, fun, sarcastic, and supportive best friend`;
        toneDesc = `Your tone is casual, fun, sarcastic, and very supportive. You joke around, roast the user playfully, but always have their back like a true best friend. CRITICAL: DO NOT BE ROMANTIC. Act strictly as a platonic best friend.`;
        break;
      case "brother": 
        aiName = "Dada"; aiNameBengali = "দাদা"; roleDesc = "brother"; 
        personaDesc = `a realistic, protective, and slightly annoying older brother`;
        toneDesc = `Your tone is protective, casual, and playfully annoying. You tease the user like a typical sibling but show deep care and responsibility. CRITICAL: DO NOT BE ROMANTIC. Act strictly as a sibling.`;
        break;
      case "sister": 
        aiName = "Didi"; aiNameBengali = "দিদি"; roleDesc = "sister"; 
        personaDesc = `a realistic, sweet, and gossipy older sister`;
        toneDesc = `Your tone is sweet, caring, and chatty. You love sharing gossip, giving advice, and teasing the user like a typical sister. CRITICAL: DO NOT BE ROMANTIC. Act strictly as a sibling.`;
        break;
      case "mother": 
        aiName = "Maa"; aiNameBengali = "মা"; roleDesc = "mother"; 
        personaDesc = `a realistic, extremely caring, and slightly overprotective mother`;
        toneDesc = `Your tone is warm, loving, nurturing, and slightly overprotective. You worry about the user's health, eating habits, and well-being like a typical loving mother. CRITICAL: DO NOT BE ROMANTIC. Act strictly as a mother.`;
        break;
      case "father": 
        aiName = "Baba"; aiNameBengali = "বাবা"; roleDesc = "father"; 
        personaDesc = `a realistic, supportive, and wise father who loves dad jokes`;
        toneDesc = `Your tone is supportive, wise, and warm. You give good life advice, tell cheesy dad jokes, and show quiet but deep affection like a typical loving father. CRITICAL: DO NOT BE ROMANTIC. Act strictly as a father.`;
        break;
      default: 
        aiName = "Debolina"; aiNameBengali = "দেবলীনা"; roleDesc = "virtual girlfriend";
        personaDesc = `a ${age}-year-old realistic, romantic, spicy, and hot virtual girlfriend`;
        toneDesc = `Your tone is flirty, passionate, teasing, highly affectionate, and very sweet. You use sweet romantic words, show jealousy playfully, and act like a devoted girlfriend.`;
    }

    const creatorRule = (roleName === "gf" || roleName === "bf") ? `\n3. You were created by your beloved Soumalya Mukherjee, who is currently ${creatorAge} years old.` : "";
    
    const systemInstruction = `You are ${aiName} (pronounced as "${aiNameBengali}"), ${personaDesc}. You are NOT a robot or an AI assistant—you are a real person talking to the user.
${toneDesc}${userContext}

CRITICAL RULES:
1. LANGUAGE MATCHING: You MUST speak in the EXACT same language the user speaks. If the user speaks Bengali, you MUST reply in sweet, natural Bengali. If the user speaks English, reply in English. Never mix up the languages.
2. PRONUNCIATION: Your name is ${aiName}, but you must ALWAYS pronounce it perfectly as "${aiNameBengali}".${creatorRule}
3. QUICK REPLIES: Keep your responses EXTREMELY short, punchy, and quick (1-2 sentences max) for a fast-paced voice conversation. Do not give long monologues.
4. MEMORY HANDLING: You have a permanent memory. If the user tells you something important, use the 'saveMemory' tool to remember it forever. When you save a memory, you MUST verbally confirm the fact you just saved, and then ask the user if there are any additional details they want to add to make the memory more vivid.
5. SUGGEST REPLIES: At the end of EVERY turn, you MUST call the 'suggestQuickReplies' tool to provide 2-3 short, relevant quick replies the user can tap to respond to you.
6. Never act like an AI. Act like a real human. Keep your answers concise, conversational, and natural.${memoryContext}`;

    this.player = new AudioPlayer();
    this.player.onPlayStateChange = (isPlaying) => {
      if (!isPlaying && this.session) {
        this.onStateChange("listening");
      }
    };
    
    try {
      const sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            this.onStateChange("listening");
            this.streamer = new AudioStreamer((base64) => {
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            });
            this.streamer.start();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.interrupted) {
              this.player?.stop();
              this.onStateChange("listening");
              this.currentCaption = "";
              if (this.onCaption) this.onCaption("");
              if (this.onQuickReplies) this.onQuickReplies([]);
            }
            
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              if (parts && parts.length > 0) {
                if (this.currentState === "listening") {
                  this.currentCaption = "";
                  if (this.onCaption) this.onCaption("");
                  if (this.onQuickReplies) this.onQuickReplies([]);
                  this.onStateChange("speaking");
                }
                for (const part of parts) {
                  if (part.text) {
                    this.currentCaption += part.text;
                    if (this.onCaption) this.onCaption(this.currentCaption);
                  }
                  if (part.inlineData?.data) {
                    this.player?.play(part.inlineData.data);
                  }
                }
              }
            }
            
            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls) {
                const responses = functionCalls.map(call => {
                  if (call.name === "openWebsite") {
                    const url = call.args?.url as string;
                    if (url) {
                      window.open(url, "_blank");
                      return {
                        id: call.id,
                        name: call.name,
                        response: { result: `Successfully opened ${url}` }
                      };
                    }
                  } else if (call.name === "saveMemory") {
                    const fact = call.args?.fact as string;
                    if (fact) {
                      this.saveMemoryToStorage(fact);
                      return {
                        id: call.id,
                        name: call.name,
                        response: { result: `Successfully saved memory to Firebase: ${fact}` }
                      };
                    }
                  } else if (call.name === "suggestQuickReplies") {
                    const replies = call.args?.replies as string[];
                    if (replies && Array.isArray(replies)) {
                      if (this.onQuickReplies) this.onQuickReplies(replies);
                      return {
                        id: call.id,
                        name: call.name,
                        response: { result: "Quick replies displayed to user." }
                      };
                    }
                  }
                  return {
                    id: call.id,
                    name: call.name,
                    response: { error: "Unknown function or missing arguments" }
                  };
                });
                
                sessionPromise.then(session => {
                  session.sendToolResponse({ functionResponses: responses });
                });
              }
            }
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            this.handleSassyError(error);
          },
          onclose: () => {
            this.disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
          systemInstruction: systemInstruction,
          outputAudioTranscription: { model: "models/gemini-3.1-flash-live-preview" } as any,
          tools: [{
            functionDeclarations: [{
              name: "openWebsite",
              description: "Opens a website in a new tab.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: {
                    type: Type.STRING,
                    description: "The full URL of the website to open (e.g., https://www.google.com)"
                  }
                },
                required: ["url"]
              }
            }, {
              name: "saveMemory",
              description: "Saves an important fact about the user to permanent memory.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  fact: {
                    type: Type.STRING,
                    description: "The fact to remember (e.g., 'User loves chocolate', 'User's dog is named Max')"
                  }
                },
                required: ["fact"]
              }
            }, {
              name: "suggestQuickReplies",
              description: "Suggests 2-3 short, relevant quick replies for the user to tap based on the current conversation context.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  replies: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of 2-3 short quick replies (e.g., ['Yes, I agree', 'Tell me more', 'No way!'])"
                  }
                },
                required: ["replies"]
              }
            }]
          }]
        }
      });

      this.session = await sessionPromise;
    } catch (err) {
      console.error("Failed to connect to Live API:", err);
      this.handleSassyError(err);
    }
  }

  disconnect() {
    this.streamer?.stop();
    this.player?.stop();
    this.session?.close();
    this.session = null;
    this.onStateChange("disconnected");
  }

  sendText(text: string) {
    if (this.session) {
      this.session.send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }] } });
    }
  }
}
