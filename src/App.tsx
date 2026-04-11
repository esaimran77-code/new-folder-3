import { useState, useRef, useEffect, memo } from 'react';
import Groq from "groq-sdk";
import { BookOpen, MessageSquareText, Loader2, ChevronLeft, Folder, AlignLeft, AlignJustify, BookText, Send, Sparkles, User, Moon, Sun, ChevronDown } from 'lucide-react';
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

const FloatingShape = memo(function FloatingShape({ position, color, speed, scale = 1 }: {
  position: [number, number, number], color: string, speed: number, scale?: number
}) {
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
      <meshStandardMaterial color={color} wireframe transparent opacity={0.6} />
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
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', content: string, replyContext?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [chatHeading, setChatHeading] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatHeading(DYNAMIC_HEADINGS[Math.floor(Math.random() * DYNAMIC_HEADINGS.length)]);
  }, [screen]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
  };

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

    setChatHistory(prev => [...prev, userMsg, aiMsg]);
    setTimeout(() => scrollToBottom(), 100);

    try {
      const ai = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });

      let formatInstructions = '';
      if (answerLength === 'short') {
        formatInstructions = `
FORMAT (Short):
Line 1: وعلیکم السلام

🌸 Urdu Explanation
[Write exactly 5 lines in pure Urdu script ONLY - zero English or Roman words allowed here]

📖 English Definition
[Write exactly 3 lines in simple English]

💡 Example
[Write exactly 2 lines - a clear real example]

🔤 Roman Urdu
[Translate the Urdu Explanation + English Definition + Example all into Roman Urdu]`;
      } else if (answerLength === 'long') {
        formatInstructions = `
FORMAT (Detailed):
Line 1: وعلیکم السلام

🌸 Urdu Explanation
[Write exactly 10 lines in pure Urdu script ONLY - zero English or Roman words allowed here]

📖 English Definition
[Write exactly 5 lines in simple English]

💡 Example
[Write exactly 3 lines - a clear real example]

🔤 Roman Urdu
[Translate the Urdu Explanation + English Definition + Example all into Roman Urdu]`;
      } else {
        formatInstructions = `
FORMAT (In-Depth Masterclass):
Line 1: وعلیکم السلام

🌸 Urdu Explanation
[Write exactly 19 lines in pure Urdu script ONLY - zero English or Roman words allowed here]

📖 English Definition
[Write exactly 10 lines in simple English]

💡 Example
[Write exactly 6 lines - detailed real examples]

🔤 Roman Urdu
[Translate the Urdu Explanation + English Definition + Example all into Roman Urdu]`;
      }

      const prompt = `You are Esa AI, a knowledgeable and caring teacher for the subject: ${book}.

Conversation history:
${historyForPrompt.map(h => `${h.role}: ${h.content}`).join('\n')}

${currentReplyContext ? `Note: The user is replying to this answer: "${currentReplyContext}"` : ''}

Student's question: ${userQuestion}

${formatInstructions}

STRICT RULES:
1. Follow the format EXACTLY as shown above
2. The 🌸 Urdu Explanation section must be written in pure Urdu script only - NO Roman Urdu, NO English words at all in this section
3. The 🔤 Roman Urdu section MUST include translation of: Urdu Explanation + English Definition + Example
4. Write in plain paragraphs - no bullet points
5. Do NOT add any extra lines, greetings, or text outside the format`;

      const response = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        stream: true,
        max_tokens: 2048,
      });

      let fullText = '';
      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullText += text;
          setChatHistory(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
            return updated;
          });
        }
      }
      setTimeout(() => scrollToBottom(), 50);

    } catch (error: any) {
      const rawError = error?.message || JSON.stringify(error) || '';
      let msg = 'An unknown error occurred.';
      if (rawError.includes('503') || rawError.includes('high demand')) msg = 'AI is busy. Please try again in a moment.';
      else if (rawError.includes('403') || rawError.includes('PERMISSION_DENIED')) msg = 'API Key error. Please check your key.';
      else if (rawError.length > 0) msg = rawError.substring(0, 200);

      setChatHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `⚠️ ${msg}` };
        return updated;
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

      {/* Dark/Light Mode Button */}
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

          {/* ── SCREEN 1: BOOKS ── */}
          {screen === 1 && (
            <motion.div key="s1" variants={pageVariants} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="text-center mb-12">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className={`inline-block p-4 rounded-full backdrop-blur-md mb-6 border ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/50 border-slate-200 shadow-sm'}`}>
                  <BookOpen size={48} className="text-indigo-500" />
                </motion.div>
                <h1 className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-lg mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Esa's CIT{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Learning Hub</span>
                </h1>
                <p className={`text-lg sm:text-xl max-w-2xl mx-auto drop-shadow ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Select a subject to begin your personalized learning journey
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
                {BOOKS.map((b, i) => (
                  <motion.button key={b}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }}
                    className={`flex items-center gap-4 p-6 backdrop-blur-md rounded-2xl shadow-lg border transition-colors text-left group will-change-transform ${
                      isDarkMode ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200'}`}>
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Folder size={24} />
                    </div>
                    <span className={`font-semibold text-lg leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{b}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── SCREEN 2: ANSWER LENGTH ── */}
          {screen === 2 && (
            <motion.div key="s2" variants={pageVariants} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-4xl">
                <button onClick={() => setScreen(1)}
                  className={`flex items-center gap-2 mb-8 transition-colors px-4 py-2 rounded-full backdrop-blur-sm w-fit ${
                    isDarkMode ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20' : 'text-slate-600 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200'}`}>
                  <ChevronLeft size={20} /> Back to Subjects
                </button>
                <div className="text-center mb-12">
                  <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{book}</h2>
                  <p className={`text-lg sm:text-xl drop-shadow ${isDarkMode ? 'text-indigo-200' : 'text-indigo-600'}`}>
                    How detailed would you like your answers to be?
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'short', title: 'Short & Sweet', icon: AlignLeft, desc: 'Quick summaries and to-the-point answers.' },
                    { id: 'long', title: 'Detailed', icon: AlignJustify, desc: 'Comprehensive explanations covering all aspects.' },
                    { id: 'in-depth', title: 'In-Depth Masterclass', icon: BookText, desc: 'Extensive deep-dive with examples and full breakdowns.' }
                  ].map((opt, i) => (
                    <motion.button key={opt.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => { setAnswerLength(opt.id); setScreen(3); }}
                      className={`flex flex-col items-center text-center p-8 backdrop-blur-md rounded-3xl shadow-xl border transition-all group will-change-transform ${
                        isDarkMode ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200'}`}>
                      <div className="p-5 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <opt.icon size={40} />
                      </div>
                      <h3 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{opt.title}</h3>
                      <p className={`leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{opt.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SCREEN 3: CHAT ── */}
          {screen === 3 && (
            <motion.div key="s3" variants={pageVariants} initial="initial" animate="animate" exit="exit"
              className="flex flex-col" style={{ height: '100dvh' }}>

              {/* Header */}
              <div className="flex-shrink-0 p-4 sm:p-6 max-w-5xl w-full mx-auto">
                <div className={`backdrop-blur-md p-4 sm:p-5 rounded-3xl border shadow-lg ${
                  isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200'}`}>
                  <button onClick={() => setScreen(2)}
                    className={`flex items-center gap-1 mb-1 transition-colors text-sm font-medium ${
                      isDarkMode ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-900'}`}>
                    <ChevronLeft size={16} /> Change Settings
                  </button>
                  <h2 className={`text-xl sm:text-2xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    <Sparkles className="text-yellow-300" size={24} />
                    {chatHeading}
                  </h2>
                  <p className={`mt-1 text-sm font-medium flex items-center gap-2 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-600'}`}>
                    <Folder size={14} /> {book}
                    <span className="opacity-50">•</span>
                    {answerLength === 'short' ? 'Short' : answerLength === 'long' ? 'Detailed' : 'In-Depth'}
                  </p>
                </div>
              </div>

              {/* Chat messages - scrollable middle */}
              <div className="flex-1 overflow-hidden max-w-5xl w-full mx-auto px-4 sm:px-6 relative">
                <div className={`h-full rounded-3xl border backdrop-blur-xl shadow-2xl overflow-hidden ${
                  isDarkMode ? 'bg-slate-900/50 border-white/20' : 'bg-white/80 border-slate-200'}`}>
                  <div
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto p-4 sm:p-6 space-y-5"
                    style={{ paddingBottom: '16px' }}
                  >
                    {chatHistory.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-10">
                        <MessageSquareText size={56} className="text-indigo-400 mb-4" />
                        <p className={`text-lg font-medium max-w-md ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          I'm Esa AI. Ask me anything about {book}!
                        </p>
                      </div>
                    )}

                    {chatHistory.map((msg, index) => (
                      <motion.div key={index}
                        initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex flex-col max-w-[88%] will-change-transform ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>

                        {/* Name — NO reply button */}
                        <div className={`flex items-center gap-2 mb-1 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`p-1.5 rounded-full ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                          </div>
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {msg.role === 'user' ? 'You' : 'Esa AI'}
                          </span>
                        </div>

                        {/* Bubble */}
                        <div className={`p-4 rounded-3xl shadow-md break-words ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm'
                            : isDarkMode
                              ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
                          {msg.replyContext && (
                            <div className={`mb-3 p-2 rounded-xl text-xs italic border-l-4 ${
                              msg.role === 'user' ? 'bg-white/20 border-white/50 text-indigo-50' : isDarkMode ? 'bg-slate-700 border-indigo-400 text-slate-300' : 'bg-slate-50 border-indigo-300 text-slate-500'}`}>
                              <span className="font-semibold not-italic block mb-1 uppercase tracking-wider opacity-70">Replying to:</span>
                              <div className="line-clamp-2">{msg.replyContext}</div>
                            </div>
                          )}
                          <div className="whitespace-pre-line leading-relaxed text-[15px]">
                            {msg.content || (loading && msg.role === 'model'
                              ? <span className="flex items-center gap-2       const newHistory = [...prev, userMsg, aiMsg];
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      return newHistory;
    });

    try {
      const ai = new Groq({ 
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true 
      });
      
      let formatInstructions = "";
      if (answerLength === 'short') {
        formatInstructions = `
        - Start with "وعلیکم السلام" only, then immediately begin the answer
        - 🌸 اردو وضاحت: بالکل 5 لائنیں (صرف اردو رسم الخط میں)
        - 📖 English Definition: Exactly 3 lines (simple words)
        - 💡 Example: Exactly 2 lines
        - 🔤 Roman Urdu: Roman Urdu translation of the above sections
        `;
      } else if (answerLength === 'long') {
        formatInstructions = `
        - Start with "وعلیکم السلام" only, then immediately begin the answer
        - 🌸 اردو وضاحت: بالکل 10 لائنیں (صرف اردو رسم الخط میں)
        - 📖 English Definition: Exactly 6 lines (simple words)
        - 💡 Example: Exactly 3 lines
        - 🔤 Roman Urdu: Roman Urdu translation of the above sections
        `;
      } else {
        formatInstructions = `
        - Start with "وعلیکم السلام" only, then immediately begin the answer
        - 🌸 اردو وضاحت: بالکل 19 لائنیں (صرف اردو رسم الخط میں)
        - 📖 English Definition: Exactly 10 lines (simple words)
        - 💡 Example: Exactly 6 lines
        - 🔤 Roman Urdu: Roman Urdu translation of the above sections
        `;
      }

      const prompt = `
        You are Esa AI, a warm and knowledgeable teacher. Answer in the exact format below.
        
        Subject: ${book}
        Conversation so far:
        ${historyForPrompt.map(h => `${h.role}: ${h.content}`).join('\n')}
        
        ${currentReplyContext ? `IMPORTANT: User is replying to this previous answer:\n"""\n${currentReplyContext}\n"""\nAddress their question in relation to this.` : ''}
        
        STRICT FORMAT RULES:
        ${formatInstructions}
        
        CRITICAL RULES:
        - The 🌸 Urdu section MUST be written ONLY in Urdu script (اردو) - absolutely NO Roman Urdu or English in this section
        - Do NOT add any extra greeting or intro lines
        - Use exactly these emoji labels: 🌸 اردو وضاحت, 📖 English Definition, 💡 Example, 🔤 Roman Urdu
        - No bullet points, plain paragraphs only
      `;
      
      const response = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        stream: true,
        max_tokens: 1024,
      });

      let fullText = '';
      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullText += text;
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              ...newHistory[newHistory.length - 1],
              content: fullText
            };
            return newHistory;
          });
        }
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
                {/* Chat messages area */}
                <div 
                  ref={chatContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 pb-48 sm:pb-56"
                >
                  {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                      <MessageSquareText size={64} className="text-indigo-400 mb-4" />
                      <p className={`text-xl font-medium max-w-md ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        میں Esa AI ہوں۔ {book} کے بارے میں کچھ بھی پوچھیں!
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
                      {/* Name label — NO Reply button */}
                      <div className={`flex items-center gap-2 mb-2 px-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`p-1.5 rounded-full ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                          {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                        </div>
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {msg.role === 'user' ? 'You' : 'Esa AI'}
                        </span>
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
                          {msg.content || (loading && msg.role === 'model' ? <span className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Esa AI likh raha hai...</span> : '')}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Scroll to bottom button */}
                <AnimatePresence>
                  {showScrollBtn && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={scrollToBottom}
                      className={`fixed bottom-28 right-6 z-50 p-3 rounded-full shadow-xl border transition-all ${
                        isDarkMode 
                          ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700' 
                          : 'bg-white text-indigo-600 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      <ChevronDown size={22} />
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Fixed input box */}
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
                        rows={2}
                        placeholder="اپنا سوال یہاں لکھیں... (Enter دبائیں)"
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
