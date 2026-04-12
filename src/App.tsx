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

// Image utility with resizing
async function resizeImage(file: File): Promise<{ base64: string; file: File }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let w = img.width; let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h);
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

const FloatingShape = memo(function FloatingShape({ position, color, speed, scale = 1 }: any) {
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
      <meshStandardMaterial color={color} wireframe transparent opacity={0.06} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none transition-colors duration-1000 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-[#fffefb]'}`}>
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={isDarkMode ? 0.3 : 1.2} />
        <spotLight position={[10, 10, 10]} intensity={isDarkMode ? 1 : 2} />
        <FloatingShape position={[-6, 4, -12]} color={isDarkMode ? "#6366f1" : "#4f46e5"} speed={0.05} scale={2} />
        <FloatingShape position={[8, -3, -18]} color={isDarkMode ? "#a855f7" : "#9333ea"} speed={0.04} scale={3} />
        <FloatingShape position={[0, -8, -15]} color={isDarkMode ? "#3b82f6" : "#2563eb"} speed={0.03} scale={4} />
      </Canvas>
    </div>
  );
});

const MessageBubble = ({ msg, isUser }: { msg: any; isUser: boolean }) => {
  const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text);
  const sections = msg.content.split(/\[(.*?)\]/g);
  return (
    <div className={`flex flex-col max-w-[95%] sm:max-w-[85%] mb-8 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div className={`flex items-center gap-2 mb-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-2 rounded-xl shadow-md ${isUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-indigo-500'}`}>
          {isUser ? <User size={14}/> : <Sparkles size={14}/>}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{isUser ? 'Student' : 'Esa AI Expert'}</span>
      </div>
      <div className={`p-5 rounded-3xl shadow-2xl leading-relaxed relative border transition-all ${isUser 
        ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' 
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'}`}>
        {msg.imageUrl && <img src={msg.imageUrl} className="mb-4 rounded-2xl w-full h-auto max-h-72 object-cover border-2 border-indigo-500/10 shadow-lg" />}
        <div className="space-y-4">
          {sections.length > 1 ? sections.map((part, i) => {
            if (i % 2 === 1) return <div key={i} className="text-[11px] font-black uppercase text-indigo-500 mt-6 tracking-[0.25em] border-b-2 border-indigo-500/20 w-fit pb-1">{part}</div>;
            const isRtl = isUrdu(part);
            return <div key={i} dir={isRtl ? 'rtl' : 'ltr'} className={`${isRtl ? 'urdu-text text-[24px] leading-[2.2]' : 'font-bold text-[17px] tracking-tight'}`}>{part.trim()}</div>;
          }) : <div dir={isUrdu(msg.content) ? 'rtl' : 'ltr'} className={isUrdu(msg.content) ? 'urdu-text text-[24px] leading-[2.2]' : 'font-bold text-[17px] tracking-tight'}>{msg.content}</div>}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [book, setBook] = useState('');
  const [answerLength, setAnswerLength] = useState('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachedImage, setAttachedImage] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: any = 'smooth') => {
    setTimeout(() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior }), 50);
  };

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    setShowScrollBtn(chatHistory.length > 0 && el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  };

  const handleSubmit = async () => {
    if (!question.trim() && !attachedImage) return;
    const imgData = attachedImage;
    setQuestion(''); setAttachedImage(null); setLoading(true);
    const userMsg = { role: 'user', content: question || 'Analyzing image...', imageUrl: imgData?.preview };
    setChatHistory(p => [...p, userMsg, { role: 'model', content: '' }]);
    scrollToBottom();
    try {
      const ai = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      // RESTORE TRUST: Stronger Expert Persona in Prompt
      const expertPrompt = `
        ROLE: You are "Esa AI Expert", a senior PhD-level CIT Professor.
        SUBJECT: Strictly ONLY ${book}.
        ACCURACY RULE: Provide technically 100% precise definitions. For Database: Correctly distinguish Super Key (any combination that uniquely identifies) vs Candidate Key (minimal super key) vs Primary Key (chosen candidate key). 
        GREETING: ALWAYS start with "السلام علیکم".
        FORMAT:
        [🌸 Expert Urdu Explanation]: Detailed analysis in high-quality Urdu.
        [📖 Professional English]: Academic summary in English.
        [🔤 Roman Urdu]: Precise translation.
        QUERY: ${userMsg.content}
      `;
      const response = await ai.chat.completions.create({
        model: imgData ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
        messages: imgData ? [{ role: 'user', content: [{ type: 'text', text: expertPrompt }, { type: 'image_url', image_url: { url: imgData.base64 } }] }] : [{ role: 'user', content: expertPrompt }],
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
    } catch (e) { setChatHistory(p => [...p.slice(0, -1), { role: 'model', content: '❌ Connecton Error. Please check your API key.' }]); }
    finally { setLoading(false); scrollToBottom('smooth'); }
  };

  const dm = isDarkMode;

  return (
    <div className={`h-[100dvh] flex flex-col font-sans transition-all duration-500 overflow-hidden ${dm ? 'dark bg-[#0f172a] text-white' : 'bg-[#fffefb] text-slate-900'}`}>
      <Background3D isDarkMode={dm} />

      {/* TOP HEADER */}
      <header className="z-50 px-8 py-5 flex items-center justify-between border-b border-indigo-500/15 bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <BookOpen size={32} className="text-indigo-600" />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">Esa AI <span className="text-indigo-600">Hub</span></h1>
        </div>
        <button onClick={() => setIsDarkMode(!dm)} className="p-3.5 bg-indigo-500/10 dark:bg-white/5 rounded-2xl text-indigo-600 hover:scale-105 active:scale-95 transition-all shadow-xl">
          {dm ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </header>

      {/* DYNAMIC SCREENS */}
      <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full flex-1 overflow-y-auto px-6 py-16 flex flex-col items-center">
              <h2 className={`text-4xl sm:text-7xl font-black mb-16 tracking-tight text-center ${dm ? 'text-white' : 'text-slate-900'}`}>Master your <br/> <span className="text-indigo-600 underline decoration-indigo-200">CIT Subjects</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl pb-32">
                {BOOKS.map((b) => (
                  <button key={b} onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }} className="p-10 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[3rem] text-left hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all group scale-100 active:scale-95 flex flex-col items-start gap-4">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Folder size={24} /></div>
                    <span className="text-2xl font-black leading-tight tracking-tight">{b}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 w-full flex flex-col items-center justify-center p-8 text-center bg-transparent">
              <button onClick={() => setScreen(1)} className="mb-16 flex items-center gap-3 text-indigo-600 font-black uppercase tracking-[0.2em] text-xs hover:opacity-60 bg-indigo-50 px-6 py-3 rounded-full"><ChevronLeft size={16}/> HUB HOME</button>
              <h2 className="text-5xl font-black mb-16 tracking-tighter">{book}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 w-full max-w-5xl">
                {[
                  { id: 'short', title: 'Essentials', icon: AlignLeft },
                  { id: 'long', title: 'Standard', icon: AlignJustify },
                  { id: 'in-depth', title: 'The Master', icon: BookText },
                ].map((o) => (
                  <button key={o.id} onClick={() => { setAnswerLength(o.id); setChatHistory([]); setScreen(3); }} className="p-14 bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-[3.5rem] shadow-2xl flex flex-col items-center hover:border-indigo-600 hover:scale-[1.03] transition-all">
                    <div className="p-7 bg-indigo-600 text-white rounded-[2rem] mb-10 shadow-2xl shadow-indigo-600/30"><o.icon size={44} /></div>
                    <span className="text-3xl font-black tracking-tight">{o.title}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 w-full flex flex-col max-w-6xl mx-auto overflow-hidden bg-transparent">
              {/* CHAT NAV */}
              <div className="px-8 py-5 border-b border-indigo-500/10 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm">
                <button onClick={() => setScreen(2)} className="flex items-center gap-3 font-black text-indigo-600 hover:opacity-70 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-2xl"><ChevronLeft size={22}/> BACK</button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 opacity-60">{book}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{answerLength} Session</span>
                </div>
                <div className="w-20" />
              </div>

              {/* MESSAGES LIST */}
              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-8 py-12 space-y-10 scroll-smooth">
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-8 animate-pulse">
                    <div className="w-28 h-28 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-3xl shadow-indigo-600/30"><Sparkles size={56} className="text-white"/></div>
                    <div>
                      <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 text-indigo-600 underline">Start Learning</h3>
                      <p className="max-w-md font-bold text-slate-500 text-lg leading-tight uppercase tracking-tight">Ask your first question about {book}.</p>
                    </div>
                  </div>
                )}
                {chatHistory.map((m, i) => <MessageBubble key={i} msg={m} isUser={m.role === 'user'} />)}
              </div>

              {/* FAB SCROLL */}
              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => scrollToBottom()} className="absolute bottom-40 right-10 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-3xl shadow-indigo-600/40 z-50 hover:bg-indigo-700 active:scale-90 transition-all"><ArrowDown size={36}/></motion.button>
                )}
              </AnimatePresence>

              {/* INPUT CONTAINER */}
              <div className="p-10 bg-gradient-to-t from-white dark:from-[#0f172a] via-white/95 dark:via-[#0f172a]/95 to-transparent">
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                  {attachedImage && (
                    <div className="flex items-center gap-5 bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-3xl w-fit border border-indigo-500/20">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500"><img src={attachedImage.preview} className="w-full h-full object-cover" /><button onClick={() => setAttachedImage(null)} className="absolute top-0 right-0 p-2 bg-black/70 text-white rounded-bl-xl"><X size={14}/></button></div>
                      <span className="text-xs font-black tracking-widest text-indigo-600 uppercase">Image Staged for Expert Analysis</span>
                    </div>
                  )}
                  <div className="flex items-center gap-5 bg-white dark:bg-slate-900 border-4 border-slate-100 dark:border-slate-800 rounded-[3rem] p-4 shadow-3xl shadow-black/10 focus-within:border-indigo-600 transition-all">
                    <button onClick={() => fileInputRef.current?.click()} className="p-4 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"><ImagePlus size={28} /></button>
                    <input type="file" ref={fileInputRef} onChange={async (e) => { const f = e.target.files?.[0]; if(f){ const r = await resizeImage(f); setAttachedImage({ file: r.file, preview: URL.createObjectURL(r.file), base64: r.base64 }); } }} accept="image/*" className="hidden" />
                    <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} placeholder={`Message ${book} Expert...`} className="flex-1 bg-transparent border-none focus:ring-0 text-[20px] font-bold text-slate-800 dark:text-white px-3 outline-none placeholder:opacity-40" />
                    <button onClick={handleSubmit} disabled={loading || (!question.trim() && !attachedImage)} className="p-5 bg-indigo-600 text-white rounded-[2rem] shadow-2xl hover:bg-indigo-700 disabled:opacity-20 active:scale-90 transition-all">{loading ? <Loader2 size={28} className="animate-spin" /> : <Send size={28} className="ml-1" />}</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
