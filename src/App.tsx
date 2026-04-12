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
      {/* EXTREMELY LOW OPACITY FOR CLEAN LOOK */}
      <meshStandardMaterial color={color} wireframe transparent opacity={0.08} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={'fixed inset-0 z-[-1] pointer-events-none transition-colors duration-1000 ' + (isDarkMode ? 'bg-[#05070a]' : 'bg-slate-50')}>
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={isDarkMode ? 0.2 : 0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={isDarkMode ? 0.5 : 1} />
        {/* PUSHED FURTHER BACK IN Z-AXIS (-10 to -20) */}
        <FloatingShape position={[-6, 4, -10]} color={isDarkMode ? "#6366f1" : "#818cf8"} speed={0.1} scale={2} />
        <FloatingShape position={[8, -3, -15]} color={isDarkMode ? "#a855f7" : "#c084fc"} speed={0.08} scale={3} />
        <FloatingShape position={[0, -8, -12]} color={isDarkMode ? "#3b82f6" : "#60a5fa"} speed={0.05} scale={4} />
      </Canvas>
    </div>
  );
});

const MessageBubble = ({ msg, isUser, loading, dm, onReply }: { msg: ChatMsg; isUser: boolean; loading: boolean; dm: boolean; onReply: () => void }) => {
  const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text);
  const sections = msg.content.split(/\[(.*?)\]/g);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col max-w-[92%] sm:max-w-[80%] mb-4 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      
      <div className={`flex items-center gap-2 mb-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-1.5 rounded-lg ${isUser ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'} text-xs font-bold`}>
          {isUser ? <User size={12} className="text-white"/> : <Sparkles size={12} className="text-indigo-500"/>}
        </div>
        <span className="text-[10px] uppercase font-black opacity-50 tracking-tighter">{isUser ? 'You' : 'Esa AI'}</span>
      </div>

      <div className={`p-4 rounded-2xl shadow-sm text-[15px] leading-relaxed relative group transition-all
        ${isUser 
          ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/10' 
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-slate-200/10'}`}>
        
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
              if (i % 2 === 1) return <div key={i} className="text-[10px] font-black uppercase text-indigo-500 mt-4 tracking-widest">{part}</div>;
              const isRtl = isUrdu(part);
              return <div key={i} dir={isRtl ? 'rtl' : 'ltr'} className={`${isRtl ? 'urdu-text text-[19px] leading-[2]' : ''}`}>{part.trim()}</div>;
            })
          ) : (
            <div dir={isUrdu(msg.content) ? 'rtl' : 'ltr'} className={isUrdu(msg.content) ? 'urdu-text text-[19px] leading-[2]' : ''}>
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
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const { base64, file: resizedFile } = await resizeImage(file);
      setAttachedImage({ file: resizedFile, preview: URL.createObjectURL(resizedFile), base64 });
    }
  };

  const handleSubmit = async () => {
    const userQuestion = question || (attachedImage ? 'Read this image' : '');
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
      const prompt = `Student for ${book}. Answer as "Esa AI" (friendly teacher) in Urdu script. Format: [🌸 اردو تشریح], [📖 English], [🔤 Roman Urdu]. Help on: ${userQuestion}\nHistory:\n${historyText}\nReplying to: ${currentReplyContext || 'None'}`;

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
      setChatHistory(p => [...p.slice(0, -1), { role: 'model', content: '❌ Oops: ' + (e as any).message }]);
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
          className="pointer-events-auto absolute top-6 right-6 p-3 bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl text-indigo-400 hover:scale-110 active:scale-95 transition-all">
          {dm ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <AnimatePresence mode="wait">
          {screen === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center pointer-events-auto overflow-y-auto">
              <div className="mb-12">
                <div className="w-24 h-24 mx-auto mb-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex items-center justify-center border-b-4 border-indigo-500">
                  <BookOpen size={48} className="text-indigo-500" />
                </div>
                <h1 className="text-5xl sm:text-7xl font-black mb-4 tracking-tighter text-slate-900 dark:text-white">
                  Esa AI <span className="text-indigo-500">Hub</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">Select your subject and start learning.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
                {BOOKS.map((b) => (
                  <button key={b} onClick={() => { setBook(b); setScreen(2); }}
                    className="p-8 bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] text-left hover:border-indigo-500 transition-all shadow-xl group">
                    <Folder size={18} className="mb-4 text-indigo-500 opacity-40 group-hover:opacity-100 transition-all" />
                    <span className="text-lg font-bold text-slate-800 dark:text-white block">{b}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-6 pointer-events-auto">
              <div className="max-w-4xl w-full text-center">
                <button onClick={() => setScreen(1)} className="mb-12 text-indigo-500 font-black tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-70">
                  <ChevronLeft size={16} /> CHANGE SUBJECT
                </button>
                <h2 className="text-5xl font-black mb-16 text-slate-900 dark:text-white">{book}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'short', title: 'Summary', icon: AlignLeft },
                    { id: 'long', title: 'Detailed', icon: AlignJustify },
                    { id: 'in-depth', title: 'Mastery', icon: BookText },
                  ].map((o) => (
                    <button key={o.id} onClick={() => { setAnswerLength(o.id); setScreen(3); }}
                      className="p-10 bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-2xl flex flex-col items-center hover:border-indigo-500 transition-all">
                      <div className="p-5 bg-indigo-500 text-white rounded-3xl mb-6 shadow-indigo-500/20 shadow-lg">
                        <o.icon size={32} />
                      </div>
                      <span className="text-xl font-black dark:text-white">{o.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {screen === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col relative pointer-events-auto overflow-hidden">
              
              {/* STICKY HEADER */}
              <div className="flex-shrink-0 p-4 sm:p-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setScreen(2)} className="w-10 h-10 aspect-square flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"><ChevronLeft size={20}/></button>
                    <div>
                      <h2 className="font-black text-slate-900 dark:text-white leading-none">{book}</h2>
                      <p className="text-[10px] font-black uppercase text-indigo-500 mt-1 tracking-widest">{answerLength} Session</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                    <span className="text-[10px] font-black dark:text-white opacity-60">ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* CHAT SCROLL AREA */}
              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 space-y-2 relative scroll-smooth bg-slate-50/10 dark:bg-transparent">
                <div className="max-w-5xl mx-auto">
                  {chatHistory.length === 0 && (
                    <div className="h-40 flex flex-col items-center justify-center opacity-40 grayscale">
                      <Sparkles size={40} className="mb-4 text-indigo-500" />
                      <p className="text-sm font-bold">START A CONVERSATION</p>
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <MessageBubble key={i} msg={m} isUser={m.role === 'user'} loading={loading} dm={dm} onReply={() => setReplyingTo(i)} />
                  ))}
                </div>
              </div>

              {/* SCROLL TO BOTTOM BUTTON */}
              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-32 right-8 z-50 w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 active:scale-90 transition-all">
                    <ArrowDown size={24} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* FLOATING SLIM INPUT BAR */}
              <div className="flex-shrink-0 p-6 z-50 bg-gradient-to-t from-white dark:from-slate-950 via-white/80 dark:via-slate-950/80 to-transparent">
                <div className="max-w-5xl mx-auto">
                  
                  {attachedImage && (
                    <div className="mb-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-fit flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden relative">
                        <img src={attachedImage.preview} className="w-full h-full object-cover" />
                        <button onClick={() => setAttachedImage(null)} className="absolute top-0 right-0 p-0.5 bg-black/60 rounded-full text-white"><X size={10}/></button>
                      </div>
                      <span className="text-[10px] font-black text-indigo-500">IMAGE READY</span>
                    </div>
                  )}

                  {replyingTo !== null && (
                    <div className="mb-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                      <p className="text-[10px] font-bold truncate opacity-60 italic">Replying: {chatHistory[replyingTo].content}</p>
                      <button onClick={() => setReplyingTo(null)} className="text-indigo-500 transition-all"><X size={14}/></button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-2 shadow-2xl focus-within:border-indigo-500 transition-all">
                    <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all">
                      <ImagePlus size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                    <input value={question} onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                      placeholder="Ask anything..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white px-2 py-0 h-10 outline-none placeholder:opacity-50" />
                    <button onClick={handleSubmit} disabled={loading || (!question.trim() && !attachedImage)}
                      className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-20 transition-all">
                      {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={18} />}
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
