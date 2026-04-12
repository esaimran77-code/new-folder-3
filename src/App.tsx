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

// Image utility
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
      <meshStandardMaterial color={color} wireframe transparent opacity={0.12} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`fixed inset-0 z-[-1] pointer-events-none transition-colors duration-1000 ${isDarkMode ? 'bg-[#0b0f1a]' : 'bg-[#fffef2]'}`}>
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={isDarkMode ? 0.2 : 1} />
        <spotLight position={[10, 10, 10]} intensity={isDarkMode ? 0.5 : 2} />
        <FloatingShape position={[-6, 4, -12]} color={isDarkMode ? "#4f46e5" : "#6366f1"} speed={0.05} scale={2} />
        <FloatingShape position={[8, -3, -18]} color={isDarkMode ? "#9333ea" : "#a855f7"} speed={0.04} scale={3} />
        <FloatingShape position={[0, -8, -15]} color={isDarkMode ? "#2563eb" : "#3b82f6"} speed={0.03} scale={4} />
      </Canvas>
    </div>
  );
});

const MessageBubble = ({ msg, isUser }: { msg: any; isUser: boolean }) => {
  const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text);
  const sections = msg.content.split(/\[(.*?)\]/g);
  return (
    <div className={`flex flex-col max-w-[95%] sm:max-w-[85%] mb-6 ${isUser ? 'ml-auto items-end text-right' : 'mr-auto items-start text-left'}`}>
      <div className={`flex items-center gap-2 mb-2 p-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-2 rounded-xl ${isUser ? 'bg-indigo-600' : 'bg-white dark:bg-slate-800 shadow-lg'} text-xs`}>
          {isUser ? <User size={14} className="text-white"/> : <Sparkles size={14} className="text-indigo-500"/>}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest opacity-60">{isUser ? 'You' : 'Esa AI'}</span>
      </div>
      <div className={`p-5 rounded-3xl shadow-xl leading-relaxed relative border ${isUser 
        ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' 
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'}`}>
        {msg.imageUrl && <img src={msg.imageUrl} className="mb-4 rounded-2xl w-full h-auto max-h-60 object-cover border border-black/5" />}
        <div className="space-y-4">
          {sections.length > 1 ? sections.map((part, i) => {
            if (i % 2 === 1) return <div key={i} className="text-[11px] font-black uppercase text-indigo-500 mt-6 tracking-[0.2em] border-b-2 border-indigo-500/10 w-fit pb-1">{part}</div>;
            const isRtl = isUrdu(part);
            return <div key={i} dir={isRtl ? 'rtl' : 'ltr'} className={`${isRtl ? 'urdu-text text-[22px] leading-[2.1]' : 'font-semibold text-[16px]'}`}>{part.trim()}</div>;
          }) : <div dir={isUrdu(msg.content) ? 'rtl' : 'ltr'} className={isUrdu(msg.content) ? 'urdu-text text-[22px] leading-[2.1]' : 'font-semibold text-[16px]'}>{msg.content}</div>}
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
    const userMsg = { role: 'user', content: question || 'Analyzing this image...', imageUrl: imgData?.preview };
    setChatHistory(p => [...p, userMsg, { role: 'model', content: '' }]);
    scrollToBottom();
    try {
      const ai = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = `Student asking about: ${book}. Role: "Esa AI" teacher. MANDATORY: Start with "السلام علیکم". SUBJECT: ONLY ${book}. FORMAT: [🌸 اردو تشریح], [📖 English], [🔤 Roman Urdu]. Query: ${userMsg.content}`;
      const response = await ai.chat.completions.create({
        model: imgData ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
        messages: imgData ? [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imgData.base64 } }] }] : [{ role: 'user', content: prompt }],
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
    } catch (e) { setChatHistory(p => [...p.slice(0, -1), { role: 'model', content: '❌ Error: Unable to fetch ai response.' }]); }
    finally { setLoading(false); scrollToBottom('smooth'); }
  };

  const dm = isDarkMode;

  return (
    <div className={`h-[100dvh] flex flex-col font-sans transition-colors duration-700 ${dm ? 'dark text-white' : 'text-slate-900'}`}>
      <Background3D isDarkMode={dm} />

      {/* FIXED HEADER */}
      <header className="z-50 px-6 py-4 flex items-center justify-between bg-white/5 dark:bg-black/10 backdrop-blur-xl border-b border-indigo-500/10">
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-indigo-500" />
          <h1 className="text-2xl font-black tracking-tighter">Esa AI <span className="text-indigo-500">Hub</span></h1>
        </div>
        <button onClick={() => setIsDarkMode(!dm)} className="p-3 bg-white/10 dark:bg-black/20 rounded-2xl text-indigo-500 border border-white/10 shadow-xl hover:scale-105 transition-all">
          {dm ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-h-0 flex flex-col items-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center">
              <h2 className={`text-4xl sm:text-6xl font-black mb-12 tracking-tight ${dm ? 'text-white' : 'text-slate-900'}`}>Choose your <span className="text-indigo-500 italic">Subject</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl pb-24">
                {BOOKS.map((b) => (
                  <button key={b} onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }} className="p-10 bg-white dark:bg-slate-900/60 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] text-left hover:border-indigo-500/50 shadow-2xl transition-all group active:scale-95">
                    <Folder size={20} className="mb-4 text-indigo-500" />
                    <span className="text-xl font-bold block leading-snug">{b}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center">
              <button onClick={() => setScreen(1)} className="mb-12 flex items-center gap-2 text-indigo-500 font-bold uppercase tracking-widest text-xs hover:opacity-70"><ChevronLeft size={16}/> Back to Hub</button>
              <h2 className="text-4xl font-black mb-12">{book}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
                {[
                  { id: 'short', title: 'Summary', icon: AlignLeft },
                  { id: 'long', title: 'Detailed', icon: AlignJustify },
                  { id: 'in-depth', title: 'Mastery', icon: BookText },
                ].map((o) => (
                  <button key={o.id} onClick={() => { setAnswerLength(o.id); setChatHistory([]); setScreen(3); }} className="p-12 bg-white dark:bg-slate-900/60 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-2xl flex flex-col items-center hover:scale-[1.02] transition-all">
                    <div className="p-6 bg-indigo-600 text-white rounded-3xl mb-8 shadow-indigo-500/30 shadow-xl"><o.icon size={40} /></div>
                    <span className="text-2xl font-black">{o.title}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 w-full flex flex-col max-w-6xl mx-auto overflow-hidden">
              {/* CHAT HEADER */}
              <div className="p-4 bg-indigo-500/5 backdrop-blur-lg flex items-center justify-between">
                <button onClick={() => setScreen(2)} className="flex items-center gap-2 font-black text-indigo-500 hover:scale-105"><ChevronLeft size={20}/> Back</button>
                <div className="text-center">
                  <span className="text-xs uppercase font-black tracking-widest text-indigo-500">{answerLength} Active Session</span>
                </div>
                <div className="w-10" />
              </div>

              {/* CHAT MESSAGES */}
              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-10 space-y-6 scroll-smooth">
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 grayscale text-center p-6">
                    <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20"><Sparkles size={40} className="text-white"/></div>
                    <h3 className="text-2xl font-black uppercase mb-4 tracking-tighter">Ready to Teach you</h3>
                    <p className="max-w-md font-bold text-slate-500 tracking-tight">Post your question about {book} or upload a relevant image.</p>
                  </div>
                )}
                {chatHistory.map((m, i) => <MessageBubble key={i} msg={m} isUser={m.role === 'user'} />)}
              </div>

              {/* FLOATING ACTION BUTTON */}
              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => scrollToBottom()} className="absolute bottom-32 right-8 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl z-50 hover:bg-indigo-700 active:scale-95 transition-all"><ArrowDown size={32}/></motion.button>
                )}
              </AnimatePresence>

              {/* INPUT AREA */}
              <div className="p-6 bg-gradient-to-t from-white dark:from-[#0b0f1a] via-white/90 dark:via-[#0b0f1a]/90 to-transparent">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                  {attachedImage && (
                    <div className="flex items-center gap-4 bg-indigo-500/10 p-3 rounded-2xl w-fit animate-in slide-in-from-bottom-2">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-2xl border border-indigo-500/20"><img src={attachedImage.preview} className="w-full h-full object-cover" /><button onClick={() => setAttachedImage(null)} className="absolute top-0 right-0 p-1 bg-black/60 text-white"><X size={12}/></button></div>
                      <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase">Image Staged</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-3 shadow-2xl focus-within:border-indigo-500/50 transition-all">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-500 active:scale-90 transition-all"><ImagePlus size={24} /></button>
                    <input type="file" ref={fileInputRef} onChange={async (e) => { const f = e.target.files?.[0]; if(f){ const r = await resizeImage(f); setAttachedImage({ file: r.file, preview: URL.createObjectURL(r.file), base64: r.base64 }); } }} accept="image/*" className="hidden" />
                    <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} placeholder="Type your question..." className="flex-1 bg-transparent border-none focus:ring-0 text-[18px] font-bold text-slate-800 dark:text-white px-2 outline-none placeholder:opacity-40" />
                    <button onClick={handleSubmit} disabled={loading || (!question.trim() && !attachedImage)} className="p-4 bg-indigo-600 text-white rounded-[1.8rem] shadow-xl hover:bg-indigo-700 disabled:opacity-20 active:scale-90 transition-all">{loading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}</button>
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
