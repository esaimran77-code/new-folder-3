import { useState, useRef, useEffect, memo } from 'react';
import Groq from "groq-sdk";
import {
  BookOpen, MessageSquareText, Loader2, ChevronLeft,
  Folder, AlignLeft, AlignJustify, BookText,
  Send, Sparkles, User, Moon, Sun, ArrowDown, ImagePlus, X
} from 'lucide-react';
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

// Image resizing utility
async function resizeImage(file: File): Promise<{ base64: string; file: File }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1024;
        const MAX_H = 1024;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX_W) { h *= MAX_W / w; w = MAX_W; } }
        else { if (h > MAX_H) { w *= MAX_H / h; h = MAX_H; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
        const blob = new Blob([ab], { type: mimeString });
        const resizedFile = new File([blob], file.name, { type: mimeString, lastModified: Date.now() });
        resolve({ base64, file: resizedFile });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FloatingShape = memo(function FloatingShape({
  position, color, speed, scale = 1
}: {
  position: [number, number, number]; color: string; speed: number; scale?: number;
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
      {/* MISTAKE 3 FIX: Increased opacity to 0.15 for better visibility */}
      <meshStandardMaterial color={color} wireframe transparent opacity={0.15} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none transition-colors duration-1000 
      ${isDarkMode ? 'bg-[#0a1128]' : 'bg-[#fffdf5]'}`}> {/* Requested Theme Colors */}
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={isDarkMode ? 0.2 : 0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={isDarkMode ? 0.4 : 1} />
        <FloatingShape position={[-6, 4, -12]} color={isDarkMode ? "#6366f1" : "#4f46e5"} speed={0.1} scale={2} />
        <FloatingShape position={[8, -3, -18]} color={isDarkMode ? "#a855f7" : "#9333ea"} speed={0.08} scale={3} />
        <FloatingShape position={[0, -8, -15]} color={isDarkMode ? "#3b82f6" : "#2563eb"} speed={0.05} scale={4} />
      </Canvas>
    </div>
  );
});

const MessageBubble = ({ msg, isUser, loading, dm, onReply }: { msg: ChatMsg; isUser: boolean; loading: boolean; dm: boolean; onReply: () => void }) => {
  const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text);
  const sections = msg.content.split(/\[(.*?)\]/g);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col max-w-[95%] sm:max-w-[80%] mb-4 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      
      <div className={`flex items-center gap-2 mb-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-1.5 rounded-lg ${isUser ? 'bg-indigo-600' : 'bg-white dark:bg-slate-800 shadow-sm'} text-xs font-bold`}>
          {isUser ? <User size={12} className="text-white"/> : <Sparkles size={12} className="text-indigo-500"/>}
        </div>
        <span className="text-[10px] uppercase font-black opacity-50 tracking-tighter">{isUser ? 'You' : 'Esa AI'}</span>
      </div>

      <div className={`p-4 rounded-2xl shadow-lg text-[15.5px] leading-relaxed relative group transition-all
        ${isUser 
          ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/10' 
          : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-slate-200/5'}`}>
        
        {msg.replyContext && (
          <div className="mb-3 p-2 bg-black/5 dark:bg-white/5 border-l-2 border-indigo-500 rounded-lg text-xs italic opacity-70">
            <div className="line-clamp-1">{msg.replyContext}</div>
          </div>
        )}

        {msg.imageUrl && (
          <div className="mb-3 rounded-xl overflow-hidden border border-black/5">
            <img src={msg.imageUrl} alt="User upload" className="max-w-full h-auto max-h-48 object-cover" />
          </div>
        )}

        <div className="space-y-4">
          {sections.length > 1 ? (
            sections.map((part, i) => {
              if (i % 2 === 1) return <div key={i} className="text-[10px] font-black uppercase text-indigo-500 mt-4 tracking-widest leading-none border-b border-indigo-500/10 w-fit pb-1">{part}</div>;
              const isRtl = isUrdu(part);
              return <div key={i} dir={isRtl ? 'rtl' : 'ltr'} className={`${isRtl ? 'urdu-text text-[20px] leading-[2]' : 'font-medium'}`}>{part.trim()}</div>;
            })
          ) : (
            <div dir={isUrdu(msg.content) ? 'rtl' : 'ltr'} className={isUrdu(msg.content) ? 'urdu-text text-[20px] leading-[2]' : 'font-medium'}>
              {msg.content || (loading && !isUser ? <Loader2 className="animate-spin opacity-40" size={16}/> : '')}
            </div>
          )}
        </div>

        {!isUser && !loading && (
          <button onClick={onReply} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all text-indigo-500">
            <Send size={12} className="rotate-45" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

type ChatMsg = { role: 'user' | 'model'; content: string; replyContext?: string; imageUrl?: string; };

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [book, setBook] = useState('');
  const [answerLength, setAnswerLength] = useState('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ file: File; preview: string; base64: string } | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior });
    }, 50);
  };

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // MISTAKE 1 FIX: Only show scroll button if history exists AND user scrolled up
    setShowScrollBtn(chatHistory.length > 0 && el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const { base64, file: resizedFile } = await resizeImage(file);
      setAttachedImage({ file: resizedFile, preview: URL.createObjectURL(resizedFile), base64 });
    }
  };

  const handleSubmit = async () => {
    const userQuestion = question || (attachedImage ? 'Analyze this.' : '');
    if (!userQuestion.trim() && !attachedImage) return;

    const currentReplyContext = replyingTo !== null ? chatHistory[replyingTo].content : undefined;
    const imgData = attachedImage;
    setQuestion(''); setAttachedImage(null); setReplyingTo(null); setLoading(true);

    const userMsg: ChatMsg = { role: 'user', content: userQuestion, replyContext: currentReplyContext, imageUrl: imgData?.preview };
    setChatHistory(p => [...p, userMsg, { role: 'model', content: '' }]);
    scrollToBottom('smooth');

    try {
      const ai = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      const historyText = chatHistory.map(h => h.role + ': ' + h.content).join('\n');
      
      const prompt = `
        Context: The student is asking about the subject "${book}".
        Role: You are "Esa AI", a friendly and respectful Pakistani teacher.
        
        STRICT RULES:
        1. MANDATORY: Start EVERY response with exactly "السلام علیکم" (Assalam-o-Alaikum).
        2. SUBJECT ISOLATION: Focus strictly on "${book}".
        3. FORMAT:
           - [🌸 اردو تشریح]: Detailed explanation in pure Urdu.
           - [📖 English Summary]: Key points in English.
           - [🔤 Roman Urdu]: Translation in Roman Urdu.
        
        Question: ${userQuestion}
        History: ${historyText}
      `;

      const response = await ai.chat.completions.create({
        model: imgData ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
        messages: imgData ? [
          { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imgData.base64 } }] }
        ] : [{ role: 'user', content: prompt }],
        stream: true,
      });

      let fullText = '';
      for await (const chunk of response) {
        const part = chunk.choices[0]?.delta?.content || '';
        if (part) {
          fullText += part;
          setChatHistory(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
            return updated;
          });
        }
      }
    } catch (e) {
      setChatHistory(p => [...p.slice(0, -1), { role: 'model', content: '❌ Error: ' + (e as any).message }]);
    } finally {
      setLoading(false);
      scrollToBottom('smooth');
    }
  };

  const dm = isDarkMode;

  return (
    <div className={`min-h-screen ${dm ? 'dark' : ''}`}>
      <Background3D isDarkMode={dm} />

      <div className="fixed inset-0 flex flex-col pointer-events-none z-10 font-sans">
        
        {/* Toggle Dark Mode */}
        <button onClick={() => setIsDarkMode(!dm)} 
          className="pointer-events-auto absolute top-6 right-6 p-4 glass-morphism rounded-2xl text-indigo-500 hover:scale-110 active:scale-95 transition-all shadow-2xl">
          {dm ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <AnimatePresence mode="wait">
          {screen === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center pointer-events-auto overflow-y-auto pt-24 pb-12">
              <div className="mb-12">
                <div className="w-24 h-24 mx-auto mb-8 glass-morphism rounded-[2.5rem] shadow-2xl flex items-center justify-center border-b-4 border-indigo-500">
                  <BookOpen size={48} className="text-indigo-500" />
                </div>
                <h1 className={`text-5xl sm:text-7xl font-black mb-4 tracking-tighter ${dm ? 'text-indigo-50' : 'text-slate-900'}`}>
                  Esa AI <span className="text-indigo-500">Hub</span>
                </h1>
                <p className="text-slate-500 dark:text-indigo-300 font-bold tracking-[0.2em] uppercase text-xs">Your CIT Learning Assistant</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-6xl"> {/* MISTAKE 2 FIX: Better Mobile Grid */}
                {BOOKS.map((b) => (
                  <button key={b} onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }}
                    className="p-8 glass-morphism rounded-[2.5rem] text-left border-indigo-500/10 hover:border-indigo-500/50 transition-all shadow-2xl group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity"><Folder size={64}/></div>
                    <Folder size={20} className="mb-4 text-indigo-500" />
                    <span className={`text-xl font-bold block ${dm ? 'text-white' : 'text-slate-800'}`}>{b}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-6 pointer-events-auto">
              <div className="max-w-4xl w-full text-center">
                <button onClick={() => setScreen(1)} className="mb-12 text-indigo-500 font-black tracking-widest text-[10px] flex items-center justify-center gap-2 hover:opacity-70 glass-morphism px-4 py-2 rounded-full w-fit mx-auto">
                  <ChevronLeft size={14} /> BACK TO HUB
                </button>
                <h2 className={`text-4xl font-black mb-16 ${dm ? 'text-white' : 'text-slate-900'}`}>{book}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'short', title: 'Quick Summary', icon: AlignLeft },
                    { id: 'long', title: 'Detailed Study', icon: AlignJustify },
                    { id: 'in-depth', title: 'Expert Mastery', icon: BookText },
                  ].map((o) => (
                    <button key={o.id} onClick={() => { setAnswerLength(o.id); setChatHistory([]); setScreen(3); }}
                      className="p-10 glass-morphism rounded-[3rem] shadow-2xl flex flex-col items-center hover:border-indigo-500/50 transition-all">
                      <div className="p-6 bg-indigo-500 text-white rounded-[1.8rem] mb-6 shadow-indigo-500/20 shadow-lg">
                        <o.icon size={36} />
                      </div>
                      <span className={`text-2xl font-black ${dm ? 'text-white' : 'text-slate-800'}`}>{o.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {screen === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col relative pointer-events-auto overflow-hidden">
              
              <div className="flex-shrink-0 p-4 sm:p-6 bg-white/5 dark:bg-black/20 backdrop-blur-2xl border-b border-indigo-500/10 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setScreen(2)} className="w-11 h-11 flex items-center justify-center glass-morphism rounded-2xl text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"><ChevronLeft size={24}/></button>
                    <div>
                      <h2 className={`font-black text-lg sm:text-2xl leading-none ${dm ? 'text-white' : 'text-slate-900'}`}>{book}</h2>
                      <p className="text-[10px] font-black uppercase text-indigo-500 mt-1 tracking-widest">{answerLength.replace('-',' ')} Active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-1.5 glass-morphism rounded-full">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                    <span className="text-[10px] font-black dark:text-white dark:opacity-60">HUB V5.0</span>
                  </div>
                </div>
              </div>

              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-10 py-10 space-y-4 relative scroll-smooth bg-slate-50/5 dark:bg-transparent">
                <div className="max-w-5xl mx-auto">
                  {chatHistory.length === 0 && (
                    <div className="h-60 flex flex-col items-center justify-center opacity-30">
                      <Sparkles size={64} className="mb-6 text-indigo-500" />
                      <p className="text-xl font-bold tracking-widest text-center uppercase">Ask Anything About<br/>{book}</p>
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <MessageBubble key={i} msg={m} isUser={m.role === 'user'} loading={loading} dm={dm} onReply={() => setReplyingTo(i)} />
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-32 right-10 z-[60] w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-[0_15px_35px_rgba(79,70,229,0.4)] hover:bg-indigo-700 active:scale-95 transition-all">
                    <ArrowDown size={28} />
                  </motion.button>
                )}
              </AnimatePresence>

              <div className="flex-shrink-0 p-6 sm:p-10 z-50 bg-gradient-to-t from-white/95 dark:from-[#0a1128]/95 via-white/80 dark:via-[#0a1128]/80 to-transparent">
                <div className="max-w-5xl mx-auto">
                  
                  {attachedImage && (
                    <div className="mb-4 glass-morphism p-2 rounded-3xl w-fit flex items-center gap-3 border-indigo-500/20">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden relative shadow-lg">
                        <img src={attachedImage.preview} className="w-full h-full object-cover" />
                        <button onClick={() => setAttachedImage(null)} className="absolute top-0 right-0 p-1 bg-black/60 rounded-full text-white"><X size={10}/></button>
                      </div>
                      <span className="text-[10px] font-black text-indigo-500 uppercase pr-2">IMAGE STAGED</span>
                    </div>
                  )}

                  {replyingTo !== null && (
                    <div className="mb-3 glass-morphism p-3 rounded-2xl border-l-[6px] border-indigo-500 flex items-center justify-between shadow-xl">
                      <p className="text-[11px] font-bold truncate opacity-80 italic">Replying: {chatHistory[replyingTo].content}</p>
                      <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-lg text-indigo-500"><X size={16}/></button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 glass-morphism border-indigo-500/20 rounded-[2.5rem] p-2.5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] focus-within:border-indigo-500/50 transition-all">
                    <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all hover:bg-indigo-500/10 rounded-[1.5rem]">
                      <ImagePlus size={22} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                    <input value={question} onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                      placeholder={`Message ${book}...`}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white px-3 font-semibold text-[16px] outline-none placeholder:opacity-30" />
                    <button onClick={handleSubmit} disabled={loading || (!question.trim() && !attachedImage)}
                      className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-[1.5rem] shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:bg-indigo-800 disabled:opacity-30 transition-all">
                      {loading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20} className="ml-1"/>}
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
