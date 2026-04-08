import { useState, useRef, useEffect, memo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BookOpen, MessageSquareText, Loader2, ChevronLeft, Folder, AlignLeft, AlignJustify, BookText, Send, Sparkles, User, Moon, Sun } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

const BOOKS = [
  "Tarjama-Tul-Quran",
  "Islamiat/Pak Studies",
  "Applied Mathematics-II",
  "Business Communication",
  "Data Communication & Computer Networks",
  "Digital Logic Design",
  "Operating System",
  "Database Management System",
  "Computer Graphics Designing",
  "Web Development"
];

const DYNAMIC_HEADINGS = [
  "What's on your mind today?",
  "Ready to learn something new?",
  "What will we explore today?",
  "Your question awaits...",
  "Let's dive into some knowledge!"
];

const FloatingShape = memo(function FloatingShape({ position, color, speed, scale = 1 }: { position: [number, number, number], color: string, speed: number, scale?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.8;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.5;
    }
  });

  return (
    <mesh position={position} ref={meshRef} scale={scale}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} wireframe={true} transparent opacity={0.6} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`fixed inset-0 z-0 pointer-events-none transition-colors duration-500 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={isDarkMode ? 0.5 : 0.8} />
        <directionalLight position={[10, 10, 5]} intensity={isDarkMode ? 1 : 1.5} />
        <FloatingShape position={[-4, 2, -2]} color={isDarkMode ? "#818cf8" : "#6366f1"} speed={0.2} scale={1.5} />
        <FloatingShape position={[5, -2, -5]} color={isDarkMode ? "#c084fc" : "#a855f7"} speed={0.15} scale={2} />
        <FloatingShape position={[0, 0, -8]} color={isDarkMode ? "#60a5fa" : "#3b82f6"} speed={0.1} scale={3} />
        <FloatingShape position={[-5, -4, -4]} color={isDarkMode ? "#f472b6" : "#ec4899"} speed={0.25} scale={1.2} />
        <FloatingShape position={[6, 4, -3]} color={isDarkMode ? "#2dd4bf" : "#14b8a6"} speed={0.18} scale={1.8} />
      </Canvas>
    </div>
  );
});

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [book, setBook] = useState('');
  const [answerLength, setAnswerLength] = useState('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', content: string, replyContext?: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [chatHeading, setChatHeading] = useState('');
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setChatHeading(DYNAMIC_HEADINGS[Math.floor(Math.random() * DYNAMIC_HEADINGS.length)]);
  }, [screen]);

  const handleSubmit = async (text?: string) => {
    const userQuestion = text || question;
    if (!userQuestion.trim()) return;
    
    const currentReplyContext = replyingTo !== null ? chatHistory[replyingTo].content : undefined;
    
    setQuestion('');
    setReplyingTo(null);
    setLoading(true);
    
    const userMsg = { role: 'user' as const, content: userQuestion, replyContext: currentReplyContext };
    const aiMsg = { role: 'model' as const, content: '' };
    const historyForPrompt = [...chatHistory, userMsg];
    
    setChatHistory(prev => {
      const newHistory = [...prev, userMsg, aiMsg];
      setTimeout(() => {
        const aiIndex = newHistory.length - 1;
        if (messageRefs.current[aiIndex]) {
          messageRefs.current[aiIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return newHistory;
    });

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      let formatInstructions = "";
      if (answerLength === 'short') {
        formatInstructions = `
        - Start with a warm greeting (1 line)
        - 🌸 Urdu Explanation: Exactly 5 lines
        - 📖 English Definition: Exactly 3 lines (simple words)
        - 💡 Example: Exactly 2 lines
        - 🔤 Roman Urdu: Translation of the above
        `;
      } else if (answerLength === 'long') {
        formatInstructions = `
        - Start with a warm greeting (1 line)
        - 🌸 Urdu Explanation: Exactly 10 lines
        - 📖 English Definition: Exactly 6 lines
        - 💡 Example: Exactly 3 lines
        - 🔤 Roman Urdu: Translation of the above
        `;
      } else {
        formatInstructions = `
        - Start with a warm greeting (1 line)
        - 🌸 Urdu Explanation: Exactly 19 lines
        - 📖 English Definition: Exactly 10 lines
        - 💡 Example: Exactly 6 lines
        - 🔤 Roman Urdu: Translation of the above
        `;
      }

      const prompt = `
        You are a warm, friendly, and caring teacher. Your goal is to help the student understand the topic thoroughly while being encouraging and supportive.
        
        Subject: ${book}
        Context of the entire conversation:
        ${historyForPrompt.map(h => `${h.role}: ${h.content}`).join('\n')}
        
        ${currentReplyContext ? `IMPORTANT CONTEXT FOR THIS QUESTION: The user is specifically replying to the following previous answer:\n"""\n${currentReplyContext}\n"""\n\nPlease address their question in direct relation to this specific answer.` : ''}
        
        Instructions for the answer format:
        ${formatInstructions}
        
        IMPORTANT: You MUST use these exact section labels with their emojis:
        🌸 Urdu Explanation
        📖 English Definition
        💡 Example
        🔤 Roman Urdu
        
        Format as plain paragraphs under each label, no bullet points. Keep your tone very friendly and teacher-like.
      `;
      
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      let fullText = '';
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], content: fullText };
          return newHistory;
        });
      }
    } catch (error: any) {
      console.error("Detailed API Error:", error);
      
      let cleanErrorMessage = "An unknown error occurred.";
      const rawError = error?.message || JSON.stringify(error) || "";
      
      if (rawError.includes("503") || rawError.includes("high demand") || rawError.includes("UNAVAILABLE")) {
        cleanErrorMessage = "The AI is currently experiencing high demand. Please wait a moment and try again.";
      } else if (rawError.includes("403") || rawError.includes("PERMISSION_DENIED")) {
        cleanErrorMessage = "API Key permission denied. Please check your API key.";
      } else {
        try {
           const parsed = JSON.parse(rawError);
           cleanErrorMessage = parsed?.error?.message || "Something went wrong with the AI provider.";
        } catch {
           cleanErrorMessage = rawError.length > 200 ? rawError.substring(0, 200) + "..." : rawError;
        }
      }

      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], content: `⚠️ ${cleanErrorMessage}` };
        return newHistory;
      });
    } finally {
      setLoading(false);
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Background3D isDarkMode={isDarkMode} />
      
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className={`fixed top-5 right-5 z-50 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg ${
          isDarkMode ? 'bg-white/10 text-yellow-300 hover:bg-white/20' : 'bg-slate-800/10 text-slate-700 hover:bg-slate-800/20'
        }`}
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="min-h-screen relative z-10 overflow-x-hidden">
        <AnimatePresence mode="wait">
          
          {/* SCREEN 1: BOOKS */}
          {screen === 1 && (
            <motion.div 
              key="screen1"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8"
            >
              <div className="text-center mb-12">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className={`inline-block p-4 rounded-full backdrop-blur-md mb-6 border ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/50 border-slate-200 shadow-sm'
                  }`}
                >
                  <BookOpen size={48} className="text-indigo-500" />
                </motion.div>
                <h1 className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-lg mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Esa's CIT <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Learning Hub</span>
                </h1>
                <p className={`text-lg sm:text-xl max-w-2xl mx-auto drop-shadow ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Select a subject to begin your personalized learning journey
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
                {BOOKS.map((b, i) => (
                  <motion.button
                    key={b}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }}
                    className={`flex items-center gap-4 p-6 backdrop-blur-md rounded-2xl shadow-lg border transition-colors text-left group will-change-transform ${
                      isDarkMode ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200'
                    }`}
                  >
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Folder size={24} />
                    </div>
                    <span className={`font-semibold text-lg leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{b}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 2: ANSWER LENGTH */}
          {screen === 2 && (
            <motion.div 
              key="screen2"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8"
            >
              <div className="w-full max-w-4xl">
                <button 
                  onClick={() => setScreen(1)}
                  className={`flex items-center gap-2 mb-8 transition-colors px-4 py-2 rounded-full backdrop-blur-sm w-fit ${
                    isDarkMode ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20' : 'text-slate-600 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200'
                  }`}
                >
                  <ChevronLeft size={20} /> Back to Subjects
                </button>
                
                <div className="text-center mb-12">
                  <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    {book}
                  </h2>
                  <p className={`text-lg sm:text-xl drop-shadow ${isDarkMode ? 'text-indigo-200' : 'text-indigo-600'}`}>
                    How detailed would you like your answers to be?
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'short', title: 'Short & Sweet', icon: AlignLeft, desc: 'Quick summaries and to-the-point answers.' },
                    { id: 'long', title: 'Detailed', icon: AlignJustify, desc: 'Comprehensive explanations covering all aspects.' },
                    { id: 'long with long explanation', title: 'In-Depth Masterclass', icon: BookText, desc: 'Extensive deep-dive with examples and full breakdowns.' }
                  ].map((option, i) => (
                    <motion.button
                      key={option.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setAnswerLength(option.id); setScreen(3); }}
                      className={`flex flex-col items-center text-center p-8 backdrop-blur-md rounded-3xl shadow-xl border transition-all group will-change-transform ${
                        isDarkMode ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200'
                      }`}
                    >
                      <div className="p-5 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <option.icon size={40} />
                      </div>
                      <h3 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{option.title}</h3>
                      <p className={`leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{option.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 3: CHAT */}
          {screen === 3 && (
            <motion.div 
              key="screen3"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="min-h-screen flex flex-col p-4 sm:p-6 md:p-8 max-w-5xl mx-auto"
            >
              <header className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 backdrop-blur-md p-4 sm:p-6 rounded-3xl border shadow-lg ${
                isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200'
              }`}>
                <div>
                  <button 
                    onClick={() => setScreen(2)}
                    className={`flex items-center gap-1 mb-2 transition-colors text-sm font-medium ${
                      isDarkMode ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-900'
                    }`}
                  >
                    <ChevronLeft size={16} /> Change Settings
                  </button>
                  <h2 className={`text-2xl sm:text-3xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    <Sparkles className="text-yellow-300" size={28} />
                    {chatHeading}
                  </h2>
                  <p className={`mt-1 font-medium flex items-center gap-2 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-600'}`}>
                    <Folder size={16} /> {book} <span className="opacity-50">•</span> {answerLength === 'short' ? 'Short' : answerLength === 'long' ? 'Detailed' : 'In-Depth'}
                  </p>
                </div>
              </header>

              <main className={`flex-1 backdrop-blur-xl rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${
                isDarkMode ? 'bg-slate-900/50 border-white/20' : 'bg-white/80 border-slate-200'
              }`}>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 pb-48 sm:pb-56">
                  {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                      <MessageSquareText size={64} className="text-indigo-400 mb-4" />
                      <p className={`text-xl font-medium max-w-md ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        I'm your CIT teacher. Ask me anything about {book}!
                      </p>
                    </div>
                  )}
                  
                  {chatHistory.map((msg, index) => (
                    <motion.div 
                      ref={(el) => { messageRefs.current[index] = el; }}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={index} 
                      className={`flex flex-col max-w-[85%] will-change-transform ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div className={`flex items-center gap-2 mb-2 px-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`p-1.5 rounded-full ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                          {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                        </div>
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {msg.role === 'user' ? 'You' : 'Teacher AI'}
                        </span>
                        {msg.role === 'model' && msg.content && (
                          <button 
                            onClick={() => setReplyingTo(index)} 
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-full transition-colors ml-2"
                          >
                            Reply
                          </button>
                        )}
                      </div>

                      <div className={`p-4 sm:p-5 rounded-3xl shadow-md relative group break-words overflow-hidden ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm' 
                          : isDarkMode 
                            ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                            : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                      }`}>
                        {msg.replyContext && (
                          <div className={`mb-4 p-3 rounded-xl text-sm italic border-l-4 ${
                            msg.role === 'user' ? 'bg-white/20 border-white/50 text-indigo-50' : isDarkMode ? 'bg-slate-700 border-indigo-400 text-slate-300' : 'bg-slate-50 border-indigo-300 text-slate-500'
                          }`}>
                            <span className="font-semibold not-italic block mb-1 text-xs uppercase tracking-wider opacity-80">Replying to:</span>
                            <div className="line-clamp-2">{msg.replyContext}</div>
                          </div>
                        )}
                        <div className="whitespace-pre-line leading-relaxed text-[15px] sm:text-base">
                          {msg.content || (loading && msg.role === 'model' ? <span className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Teacher is typing...</span> : '')}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-[max(env(safe-area-inset-bottom),16px)] ${
                  isDarkMode ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'
                }`}>
                  <div className="max-w-5xl mx-auto p-4 sm:p-6">
                    {replyingTo !== null && (
                      <div className={`mb-3 flex items-center justify-between p-3 rounded-xl border ${
                        isDarkMode ? 'bg-indigo-900/30 border-indigo-800' : 'bg-indigo-50 border-indigo-100'
                      }`}>
                        <div className={`flex-1 truncate text-sm ${isDarkMode ? 'text-indigo-200' : 'text-indigo-800'}`}>
                          <span className="font-bold mr-2">Replying to:</span>
                          <span className="italic opacity-80">{chatHistory[replyingTo].content.substring(0, 60)}...</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-indigo-400 hover:text-indigo-600 p-1">
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="relative flex items-end gap-2">
                      <textarea 
                        value={question} 
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        className={`w-full p-4 pr-14 rounded-2xl border focus:ring-4 outline-none resize-none shadow-sm transition-all ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20 text-white placeholder-slate-400' 
                            : 'bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 text-slate-700 placeholder-slate-400'
                        }`} 
                        rows={question.split('\n').length > 1 ? 3 : 1} 
                        placeholder="Ask your question here... (Press Enter to send)" 
                      />
                      <button 
                        onClick={() => handleSubmit()} 
                        disabled={loading || !question.trim()} 
                        className="absolute right-2 bottom-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md"
                      >
                        <Send size={20} className={loading ? "opacity-0" : "opacity-100"} />
                        {loading && <Loader2 size={20} className="animate-spin absolute top-3 left-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
