import { useState, useRef, useEffect, memo } from 'react';
import Groq from "groq-sdk";
import {
  BookOpen, MessageSquareText, Loader2, ChevronLeft,
  Folder, AlignLeft, AlignJustify, BookText,
  Send, Sparkles, User, Moon, Sun, ChevronDown, ImagePlus, X
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

// Resize image to max 2 megapixels for Llama-4 or other vision models
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

        if (w > h) {
          if (w > MAX_W) {
            h *= MAX_W / w;
            w = MAX_W;
          }
        } else {
          if (h > MAX_H) {
            w *= MAX_H / h;
            h = MAX_H;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const resizedFile = new File([blob], file.name, {
          type: mimeString,
          lastModified: Date.now(),
        });

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
      <meshStandardMaterial color={color} wireframe transparent opacity={0.6} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={'fixed inset-0 z-0 pointer-events-none transition-colors duration-1000 ' + (isDarkMode ? 'bg-slate-950' : 'bg-slate-50')}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={isDarkMode ? 0.3 : 0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={isDarkMode ? 1 : 2} />
        <FloatingShape position={[-4, 2, -2]} color={isDarkMode ? "#6366f1" : "#4f46e5"} speed={0.15} scale={1.5} />
        <FloatingShape position={[5, -2, -5]} color={isDarkMode ? "#a855f7" : "#9333ea"} speed={0.12} scale={2} />
        <FloatingShape position={[0, 0, -8]} color={isDarkMode ? "#3b82f6" : "#2563eb"} speed={0.08} scale={3} />
        <FloatingShape position={[-5, -4, -4]} color={isDarkMode ? "#ec4899" : "#db2777"} speed={0.2} scale={1.2} />
        <FloatingShape position={[6, 4, -3]} color={isDarkMode ? "#14b8a6" : "#0d9488"} speed={0.15} scale={1.8} />
      </Canvas>
    </div>
  );
});

function buildPrompt(
  book: string,
  answerLength: string,
  userQuestion: string,
  history: { role: string; content: string }[],
  replyContext?: string,
  hasImage?: boolean
): string {
  const historyText = history.map((h) => h.role + ': ' + h.content).join('\n');
  const replyNote = replyContext ? 'Note: User is replying to: "' + replyContext + '"' : '';
  const imageNote = hasImage
    ? 'The student has shared an image. Please read and solve/explain everything visible in the image according to the format below.'
    : '';

  let lines: string[] = [];

  const baseInstruction = `
    You are "Esa AI", a compassionate and knowledgeable Pakistani teacher for: ${book}.
    Your responses must be in **authentic Pakistani Urdu** (not Indian Urdu).
    Use respectful vocabulary like "آپ", "جناب", and avoid Indian phrases like "ज़रूर" (use "ضرور" instead).
    Provide **clear, friendly, and easy-to-understand** explanations.
    
    STRICT FORMAT:
    1. Start with "وعلیکم السلام".
    2. Section: [🌸 اردو تشریح] - Exactly ${answerLength === 'short' ? '5' : answerLength === 'long' ? '10' : '19'} lines in pure Urdu script.
    3. Section: [📖 English Definition] - Exactly ${answerLength === 'short' ? '3' : answerLength === 'long' ? '5' : '10'} lines in simple English.
    4. Section: [💡 مثال] - Exactly ${answerLength === 'short' ? '2' : answerLength === 'long' ? '3' : '6'} lines with real examples.
    5. Section: [🔤 Roman Urdu] - Full translation of all above sections in Roman Urdu.
  `;

  return [
    baseInstruction,
    '',
    'Conversation history:',
    historyText,
    '',
    replyNote,
    imageNote,
    '',
    'Student question: ' + userQuestion,
    '',
    'Follow the format exactly. No extra text.',
  ].join('\n');
}

type ChatMsg = {
  role: 'user' | 'model';
  content: string;
  replyContext?: string;
  imageUrl?: string;
};

// UI Components
const MessageBubble = ({ msg, isUser, loading, dm, onReply }: { msg: ChatMsg, isUser: boolean, loading: boolean, dm: boolean, onReply: () => void }) => {
  const isUrdu = (text: string) => /[\u0600-\u06FF]/.test(text);

  const sections = msg.content.split(/\[(.*?)\]/g);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex flex-col max-w-[90%] sm:max-w-[85%] mb-6 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
    >
      <div className={`flex items-center gap-2 mb-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-2 rounded-xl shadow-sm ${isUser ? 'bg-indigo-600 text-white' : 'glass-morphism text-indigo-500'}`}>
          {isUser ? <User size={16} /> : <Sparkles size={16} />}
        </div>
        <span className={`text-xs font-bold tracking-wide uppercase opacity-70 ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
          {isUser ? 'You' : 'Esa AI'}
        </span>
      </div>

      <div className={`relative p-5 rounded-3xl shadow-xl transition-all duration-300 group overflow-hidden
        ${isUser 
          ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-tr-none' 
          : 'glass-morphism rounded-tl-none border-indigo-500/20'}`}
      >
        {msg.replyContext && (
          <div className={`mb-4 p-3 rounded-2xl text-xs italic border-l-4 shadow-inner
            ${isUser ? 'bg-white/10 border-white/50 text-indigo-50' : 'bg-indigo-500/10 border-indigo-500 text-slate-400'}`}>
            <span className="font-bold not-italic block mb-1 uppercase tracking-tighter opacity-60">Replying to:</span>
            <div className="line-clamp-2 opacity-80">{msg.replyContext}</div>
          </div>
        )}
        
        {msg.imageUrl && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img src={msg.imageUrl} alt="Attached" className="w-full h-auto object-cover max-h-60" />
          </div>
        )}

        <div className="space-y-4">
          {sections.length > 1 ? (
            sections.map((part, i) => {
              if (i % 2 === 1) { // This is a heading/label
                return <div key={i} className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mt-4 mb-1">{part}</div>;
              }
              const isRtl = isUrdu(part);
              return (
                <div key={i} 
                  dir={isRtl ? 'rtl' : 'ltr'} 
                  className={`whitespace-pre-line leading-relaxed text-[15.5px] ${isRtl ? 'urdu-text text-[18px]' : 'font-medium'}`}>
                  {part.trim()}
                </div>
              );
            })
          ) : (
            <div dir={isUrdu(msg.content) ? 'rtl' : 'ltr'} 
              className={`whitespace-pre-line leading-relaxed text-[15.5px] ${isUrdu(msg.content) ? 'urdu-text text-[18px]' : 'font-medium'}`}>
              {msg.content || (loading && !isUser ? <span className="flex items-center gap-2 opacity-60"><Loader2 className="animate-spin" size={16} /> Esa AI thinking...</span> : '')}
            </div>
          )}
        </div>

        {!isUser && !loading && (
          <button onClick={onReply} className="absolute bottom-2 right-2 p-2 rounded-xl bg-white/5 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10">
            <Send size={14} className="rotate-45" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [book, setBook] = useState('');
  const [answerLength, setAnswerLength] = useState('');
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [chatHeading, setChatHeading] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ file: File; preview: string; base64: string } | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChatHeading(DYNAMIC_HEADINGS[Math.floor(Math.random() * DYNAMIC_HEADINGS.length)]);
  }, [screen]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { base64, file: resizedFile } = await resizeImage(file);
      setAttachedImage({ file: resizedFile, preview: URL.createObjectURL(resizedFile), base64 });
    } catch {
      alert('Failed to process image.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (text?: string) => {
    const userQuestion = text || question || (attachedImage ? 'Please solve this image.' : '');
    if (!userQuestion.trim() && !attachedImage) return;

    const currentReplyContext = replyingTo !== null ? chatHistory[replyingTo].content : undefined;
    const imgData = attachedImage;

    setQuestion('');
    setAttachedImage(null);
    setReplyingTo(null);
    setLoading(true);

    const userMsg: ChatMsg = { role: 'user', content: userQuestion, replyContext: currentReplyContext, imageUrl: imgData?.preview };
    const aiMsg: ChatMsg = { role: 'model', content: '' };
    setChatHistory((p) => [...p, userMsg, aiMsg]);
    scrollToBottom();

    try {
      const ai = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = buildPrompt(book, answerLength, userQuestion, [...chatHistory, userMsg], currentReplyContext, !!imgData);

      const response = await ai.chat.completions.create({
        model: imgData ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile',
        messages: imgData ? [
          { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imgData.base64 } }] }
        ] : [{ role: 'user', content: prompt }],
        stream: true, max_tokens: 4096,
      });

      let fullText = '';
      for await (const chunk of response) {
        const part = chunk.choices[0]?.delta?.content || '';
        if (part) {
          fullText += part;
          setChatHistory((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
            return updated;
          });
        }
      }
    } catch (error) {
      setChatHistory(p => [...p.slice(0, -1), { role: 'model', content: '❌ Error: ' + (error as any).message }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const dm = isDarkMode;

  return (
    <div className={dm ? 'dark' : ''}>
      <Background3D isDarkMode={dm} />

      <button onClick={() => setIsDarkMode(!dm)}
        className="fixed top-6 right-6 z-50 p-4 rounded-2xl glass-morphism shadow-2xl hover:scale-110 transition-all active:scale-95 text-indigo-500">
        {dm ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="min-h-screen relative z-10 flex flex-col font-sans">
        <AnimatePresence mode="wait">

          {/* SCREEN 1 - SELECT BOOK */}
          {screen === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="mb-12">
                <div className="inline-block p-6 rounded-[2.5rem] glass-morphism mb-8 shadow-2xl border-indigo-500/20">
                  <BookOpen size={64} className="text-indigo-500" />
                </div>
                <h1 className={`text-5xl sm:text-7xl font-extrabold mb-4 tracking-tight ${dm ? 'text-white' : 'text-slate-900'}`}>
                  Esa Learning <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Hub</span>
                </h1>
                <p className={`text-xl max-w-xl mx-auto opacity-70 ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
                  Empowering CIT students with AI-driven personalized knowledge.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full max-w-7xl">
                {BOOKS.map((b, i) => (
                  <motion.button key={b} whileHover={{ y: -8, scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setBook(b); setScreen(2); }}
                    className="p-8 glass-morphism rounded-[2rem] text-left group shadow-lg border-indigo-500/10 hover:border-indigo-500/40 transition-all">
                    <div className="w-12 h-12 flex items-center justify-center bg-indigo-500/10 text-indigo-500 rounded-2xl mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <Folder size={24} />
                    </div>
                    <span className={`text-xl font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>{b}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 2 - LENGTH */}
          {screen === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="max-w-4xl w-full">
                <button onClick={() => setScreen(1)} className="flex items-center gap-2 mb-10 text-indigo-500 font-bold hover:underline">
                  <ChevronLeft size={20} /> Back to Hub
                </button>
                <div className="text-center mb-16">
                  <h2 className={`text-4xl sm:text-6xl font-black mb-4 ${dm ? 'text-white' : 'text-slate-900'}`}>{book}</h2>
                  <p className="text-xl font-medium text-indigo-500/80 uppercase tracking-widest">Select Depth of Knowledge</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { id: 'short', title: 'Summary', icon: AlignLeft, d: 'Core concepts in a nutshell.' },
                    { id: 'long', title: 'Detailed', icon: AlignJustify, d: 'Comprehensive academic breakdown.' },
                    { id: 'in-depth', title: 'Masterclass', icon: BookText, d: 'Exhaustive exploration with examples.' },
                  ].map((opt) => (
                    <motion.button key={opt.id} whileHover={{ scale: 1.05 }} onClick={() => { setAnswerLength(opt.id); setScreen(3); }}
                      className="p-10 glass-morphism rounded-[2.5rem] flex flex-col items-center text-center shadow-2xl border-indigo-500/5 hover:border-indigo-500/30">
                      <div className="p-6 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-[1.5rem] mb-8 shadow-xl">
                        <opt.icon size={44} />
                      </div>
                      <h3 className={`text-2xl font-black mb-3 ${dm ? 'text-white' : 'text-slate-800'}`}>{opt.title}</h3>
                      <p className="opacity-60 leading-relaxed">{opt.d}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 3 - CHAT INTERFACE */}
          {screen === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col pt-20">
              
              <div className="fixed top-0 inset-x-0 z-40 p-4 lg:p-6">
                <div className="max-w-5xl mx-auto glass-morphism rounded-3xl p-5 border-indigo-500/20 shadow-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setScreen(2)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-indigo-500"><ChevronLeft size={24}/></button>
                    <div>
                      <h2 className={`font-black text-lg sm:text-2xl flex items-center gap-2 ${dm ? 'text-white' : 'text-slate-800'}`}>
                        {book} <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                      </h2>
                      <p className="text-xs font-bold text-indigo-500/60 uppercase tracking-widest uppercase">{answerLength} Session</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 glass-morphism px-4 py-2 rounded-2xl opacity-80 border-white/5">
                    <Sparkles size={16} className="text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-tighter">Esa AI v4.0</span>
                  </div>
                </div>
              </div>

              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-10 py-10 space-y-2 mt-16 pb-40">
                <div className="max-w-5xl mx-auto">
                  {chatHistory.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} isUser={msg.role === 'user'} loading={loading} dm={dm} onReply={() => setReplyingTo(i)} />
                  ))}
                  {showScrollBtn && (
                    <button onClick={scrollToBottom} className="fixed bottom-32 right-10 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition-all z-50">
                      <ChevronDown size={28} />
                    </button>
                  )}
                </div>
              </div>

              <div className="fixed bottom-0 inset-x-0 z-40 p-6 lg:p-10 pointer-events-none">
                <div className="max-w-5xl mx-auto pointer-events-auto">
                  
                  {attachedImage && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      className="mb-4 glass-morphism p-3 rounded-[2rem] w-fit flex items-center gap-4 border-indigo-500/30">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-xl border border-white/20">
                        <img src={attachedImage.preview} alt="Attached" className="w-full h-full object-cover" />
                        <button onClick={() => setAttachedImage(null)} className="absolute top-1 right-1 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80"><X size={14} /></button>
                      </div>
                      <div className="pr-4"><p className="text-xs font-black uppercase tracking-widest opacity-60">Ready to Analyze</p></div>
                    </motion.div>
                  )}

                  {replyingTo !== null && (
                    <div className="mb-4 glass-morphism p-4 rounded-3xl border-l-4 border-indigo-500 flex items-center justify-between shadow-lg">
                      <div className="truncate text-xs"><span className="font-black mr-2 opacity-50">REPLYING TO</span> {chatHistory[replyingTo].content}</div>
                      <button onClick={() => setReplyingTo(null)} className="ml-4 text-indigo-500 hover:text-white transition-all"><X size={18} /></button>
                    </div>
                  )}

                  <div className="relative glass-morphism rounded-[2.5rem] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-indigo-500/20">
                    <textarea value={question} onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder="Ask Esa AI anything..." rows={2}
                      className="w-full bg-transparent border-none focus:ring-0 text-lg px-6 py-4 outline-none resize-none placeholder-slate-500 pr-32" />
                    
                    <div className="absolute right-4 bottom-4 flex items-center gap-3">
                      <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-[1.5rem] bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all">
                        <ImagePlus size={24} />
                      </button>
                      <button onClick={() => handleSubmit()} disabled={loading || (!question.trim() && !attachedImage)}
                        className="p-4 rounded-[1.5rem] bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 disabled:opacity-40 transition-all">
                        {loading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                      </button>
                    </div>
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
