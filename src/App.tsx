import { useState, useRef, useEffect, memo } from 'react';
import Groq from 'groq-sdk';
import {
  BookOpen, MessageSquareText, Loader2, ChevronLeft,
  Folder, AlignLeft, AlignJustify, BookText,
  Send, Sparkles, User, Moon, Sun, ChevronDown, ImagePlus, X
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ── Google Nastaleeq font injected at runtime ── */
if (typeof document !== 'undefined') {
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap';
  document.head.appendChild(fontLink);
}

const BOOKS = [
  'Tarjama-Tul-Quran',
  'Islamiat/Pak Studies',
  'Applied Mathematics-II',
  'Business Communication',
  'Data Communication & Computer Networks',
  'Digital Logic Design',
  'Operating System',
  'Database Management System',
  'Computer Graphics Designing',
  'Web Development',
];

const HEADINGS = [
  "What's on your mind today?",
  'Ready to learn something new?',
  'What will we explore today?',
  'Your question awaits...',
  "Let's dive into some knowledge!",
];

/* ── Image resize to max 33 MP ── */
async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 33_000_000;
      const total = img.width * img.height;
      let w = img.width, h = img.height;
      if (total > MAX) {
        const r = Math.sqrt(MAX / total);
        w = Math.floor(w * r);
        h = Math.floor(h * r);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  });
}

/* ── Build AI prompt ── */
function buildPrompt(
  book: string, answerLength: string, question: string,
  history: { role: string; content: string }[],
  replyCtx?: string, hasImage?: boolean
): string {
  const hist = history.map(h => h.role + ': ' + h.content).join('\n');
  const replyNote = replyCtx ? 'User is replying to: "' + replyCtx + '"' : '';
  const imgNote = hasImage ? 'Student shared an image — read and solve everything in it.' : '';

  let fmt: string[];
  if (answerLength === 'short') {
    fmt = [
      'Line 1: وعلیکم السلام',
      '',
      'Label: \uD83C\uDF38 اردو وضاحت',
      'Exactly 5 lines — pure Pakistani Urdu script only, zero English or Roman.',
      '',
      'Label: \uD83D\uDCD6 English Definition',
      'Exactly 3 lines — simple English.',
      '',
      'Label: \uD83D\uDCA1 Example',
      'Exactly 2 lines — clear real example.',
      '',
      'Label: \uD83D\uDD24 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu (Pakistani style).',
    ];
  } else if (answerLength === 'long') {
    fmt = [
      'Line 1: وعلیکم السلام',
      '',
      'Label: \uD83C\uDF38 اردو وضاحت',
      'Exactly 10 lines — pure Pakistani Urdu script only, zero English or Roman.',
      '',
      'Label: \uD83D\uDCD6 English Definition',
      'Exactly 5 lines — simple English.',
      '',
      'Label: \uD83D\uDCA1 Example',
      'Exactly 3 lines — clear real example.',
      '',
      'Label: \uD83D\uDD24 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu (Pakistani style).',
    ];
  } else {
    fmt = [
      'Line 1: وعلیکم السلام',
      '',
      'Label: \uD83C\uDF38 اردو وضاحت',
      'Exactly 19 lines — pure Pakistani Urdu script only, zero English or Roman.',
      '',
      'Label: \uD83D\uDCD6 English Definition',
      'Exactly 10 lines — simple English.',
      '',
      'Label: \uD83D\uDCA1 Example',
      'Exactly 6 lines — detailed real examples.',
      '',
      'Label: \uD83D\uDD24 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu (Pakistani style).',
    ];
  }

  return [
    'You are Esa AI — an expert, accurate Pakistani teacher for: ' + book,
    'CRITICAL: Always give correct, factual answers. Never guess.',
    'Use Pakistani Urdu vocabulary and style (not Indian Urdu).',
    '',
    'Conversation history:',
    hist,
    '',
    replyNote,
    imgNote,
    '',
    'Student question: ' + question,
    '',
    'STRICT FORMAT:',
    fmt.join('\n'),
    '',
    'RULES:',
    '1. Follow format exactly.',
    '2. Urdu section = pure Urdu script only.',
    '3. Roman Urdu section = translate all 3 sections.',
    '4. Plain paragraphs, no bullet points.',
    '5. No extra text outside format.',
  ].join('\n');
}

type ChatMsg = { role: 'user' | 'model'; content: string; replyCtx?: string; imgUrl?: string };

/* ── 3D Background ── */
const FloatingShape = memo(function FloatingShape({
  position, color, speed, scale = 1,
}: { position: [number, number, number]; color: string; speed: number; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.x = s.clock.elapsedTime * speed;
      ref.current.rotation.y = s.clock.elapsedTime * speed * 0.8;
      ref.current.position.y = position[1] + Math.sin(s.clock.elapsedTime * speed) * 0.5;
    }
  });
  return (
    <mesh position={position} ref={ref} scale={scale}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} wireframe transparent opacity={0.6} />
    </mesh>
  );
});

const Background3D = memo(function Background3D({ dark }: { dark: boolean }) {
  return (
    <div className={'fixed inset-0 z-0 pointer-events-none ' + (dark ? 'bg-slate-900' : 'bg-slate-100')}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={dark ? 0.5 : 0.8} />
        <directionalLight position={[10, 10, 5]} intensity={dark ? 1 : 1.5} />
        <FloatingShape position={[-4, 2, -2]} color={dark ? '#818cf8' : '#6366f1'} speed={0.2} scale={1.5} />
        <FloatingShape position={[5, -2, -5]} color={dark ? '#c084fc' : '#a855f7'} speed={0.15} scale={2} />
        <FloatingShape position={[0, 0, -8]} color={dark ? '#60a5fa' : '#3b82f6'} speed={0.1} scale={3} />
        <FloatingShape position={[-5, -4, -4]} color={dark ? '#f472b6' : '#ec4899'} speed={0.25} scale={1.2} />
        <FloatingShape position={[6, 4, -3]} color={dark ? '#2dd4bf' : '#14b8a6'} speed={0.18} scale={1.8} />
      </Canvas>
    </div>
  );
});

/* ══════════════════ MAIN APP ══════════════════ */
export default function App() {
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [book, setBook] = useState('');
  const [answerLength, setAnswerLength] = useState('');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [heading, setHeading] = useState('');
  const [showScroll, setShowScroll] = useState(false);
  const [selImg, setSelImg] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHeading(HEADINGS[Math.floor(Math.random() * HEADINGS.length)]);
  }, [screen]);

  const scrollBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  const onScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    setShowScroll(chat.length > 0 && scrollHeight - scrollTop - clientHeight > 120);
  };

  const onImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoading(true);
    try {
      setSelImg(await resizeImage(file));
    } finally {
      setImgLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (txt?: string) => {
    const q = txt || question;
    if (!q.trim() && !selImg) return;
    const finalQ = q || 'Please solve this image.';
    const replyCtx = replyingTo !== null ? chat[replyingTo].content : undefined;
    const img = selImg;

    setQuestion('');
    setSelImg(null);
    setReplyingTo(null);
    setLoading(true);

    const userMsg: ChatMsg = { role: 'user', content: finalQ, replyCtx, imgUrl: img || undefined };
    const aiMsg: ChatMsg = { role: 'model', content: '' };
    const histForPrompt = [...chat, userMsg];

    setChat(prev => [...prev, userMsg, aiMsg]);
    setTimeout(scrollBottom, 100);

    try {
      const ai = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });
      const prompt = buildPrompt(book, answerLength, finalQ, histForPrompt, replyCtx, !!img);

      let res;
      if (img) {
        const b64 = img.split(',')[1];
        const mime = img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        res = await ai.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } },
              { type: 'text', text: prompt },
            ],
          }],
          stream: true, max_tokens: 2048,
        });
      } else {
        res = await ai.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          stream: true, max_tokens: 2048, temperature: 0.3,
        });
      }

      let full = '';
      for await (const chunk of res) {
        const part = chunk.choices[0]?.delta?.content || '';
        if (part) {
          full += part;
          setChat(prev => {
            const u = [...prev];
            u[u.length - 1] = { ...u[u.length - 1], content: full };
            return u;
          });
        }
      }
      setTimeout(scrollBottom, 50);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : JSON.stringify(err);
      let msg = 'Unknown error.';
      if (raw.includes('503') || raw.includes('high demand')) msg = 'AI is busy. Please try again.';
      else if (raw.includes('403')) msg = 'API Key error.';
      else msg = raw.substring(0, 200);
      setChat(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: '\u26A0\uFE0F ' + msg }; return u; });
    } finally {
      setLoading(false);
    }
  };

  const pv = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  /* colour helpers */
  const card = dark ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200';
  const txt = dark ? 'text-white' : 'text-slate-800';
  const sub = dark ? 'text-slate-300' : 'text-slate-600';
  const inp = dark
    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20'
    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:ring-indigo-100';

  return (
    <div>
      <Background3D dark={dark} />

      {/* Dark/Light toggle */}
      <button
        onClick={() => setDark(!dark)}
        className={'fixed top-5 right-5 z-50 p-3 rounded-full backdrop-blur-md shadow-lg transition-all ' +
          (dark ? 'bg-white/10 text-yellow-300 hover:bg-white/20' : 'bg-slate-800/10 text-slate-700 hover:bg-slate-800/20')}
      >
        {dark ? <Sun size={22} /> : <Moon size={22} />}
      </button>

      <div className="relative z-10" style={{ minHeight: '100dvh' }}>
        <AnimatePresence mode="wait">

          {/* ═══ SCREEN 1 — BOOKS ═══ */}
          {screen === 1 && (
            <motion.div key="s1" variants={pv} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="text-center mb-10">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className={'inline-block p-4 rounded-full backdrop-blur-md mb-5 border ' + card}>
                  <BookOpen size={44} className="text-indigo-400" />
                </motion.div>
                <h1 className={'text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 ' + txt}>
                  {"Esa's CIT "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Learning Hub</span>
                </h1>
                <p className={'text-base sm:text-lg max-w-xl mx-auto ' + sub}>
                  Select a subject to begin your learning journey
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 w-full max-w-5xl">
                {BOOKS.map((b, i) => (
                  <motion.button key={b}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -3 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setBook(b); setChat([]); setScreen(2); }}
                    className={'flex items-center gap-3 p-5 rounded-2xl shadow-lg border backdrop-blur-md text-left group transition-colors ' + card}
                  >
                    <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Folder size={22} />
                    </div>
                    <span className={'font-semibold text-base leading-snug ' + txt}>{b}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ SCREEN 2 — ANSWER LENGTH ═══ */}
          {screen === 2 && (
            <motion.div key="s2" variants={pv} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-3xl">
                <button onClick={() => setScreen(1)}
                  className={'flex items-center gap-1 mb-7 px-4 py-2 rounded-full backdrop-blur-sm text-sm font-medium transition-colors ' +
                    (dark ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20' : 'text-slate-600 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200')}>
                  <ChevronLeft size={18} /> Back to Subjects
                </button>
                <div className="text-center mb-10">
                  <h2 className={'text-3xl sm:text-4xl font-bold mb-2 ' + txt}>{book}</h2>
                  <p className={sub}>How detailed would you like your answers?</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    { id: 'short', title: 'Short & Sweet', icon: AlignLeft, desc: 'Quick, to-the-point answers.' },
                    { id: 'long', title: 'Detailed', icon: AlignJustify, desc: 'Comprehensive explanations.' },
                    { id: 'in-depth', title: 'In-Depth Masterclass', icon: BookText, desc: 'Deep-dive with full breakdowns.' },
                  ].map((opt, i) => (
                    <motion.button key={opt.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => { setAnswerLength(opt.id); setScreen(3); }}
                      className={'flex flex-col items-center text-center p-7 rounded-3xl shadow-xl border backdrop-blur-md transition-all group ' + card}
                    >
                      <div className="p-4 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 rounded-2xl mb-5 group-hover:scale-110 transition-transform">
                        <opt.icon size={36} />
                      </div>
                      <h3 className={'text-xl font-bold mb-2 ' + txt}>{opt.title}</h3>
                      <p className={'text-sm ' + sub}>{opt.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ SCREEN 3 — CHAT ═══ */}
          {screen === 3 && (
            <motion.div key="s3" variants={pv} initial="initial" animate="animate" exit="exit"
              className="flex flex-col" style={{ height: '100dvh' }}>

              {/* Header — never shrinks */}
              <div className="flex-shrink-0 px-3 pt-3 pb-2 sm:px-5 sm:pt-4 max-w-4xl w-full mx-auto">
                <div className={'rounded-2xl border backdrop-blur-md px-4 py-3 shadow-lg ' + card}>
                  <button onClick={() => setScreen(2)}
                    className={'flex items-center gap-1 mb-1 text-xs font-medium transition-colors ' +
                      (dark ? 'text-indigo-300 hover:text-white' : 'text-indigo-600 hover:text-indigo-900')}>
                    <ChevronLeft size={14} /> Change Settings
                  </button>
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-yellow-300 flex-shrink-0" size={20} />
                    <h2 className={'text-base sm:text-lg font-bold truncate ' + txt}>{heading}</h2>
                  </div>
                  <p className={'text-xs mt-0.5 flex items-center gap-1.5 ' + (dark ? 'text-indigo-300' : 'text-indigo-600')}>
                    <Folder size={12} /> {book}
                    <span className="opacity-40">•</span>
                    {answerLength === 'short' ? 'Short' : answerLength === 'long' ? 'Detailed' : 'In-Depth'}
                  </p>
                </div>
              </div>

              {/* Chat area — flex-1, scrollable */}
              <div className="flex-1 min-h-0 px-3 sm:px-5 max-w-4xl w-full mx-auto relative">
                <div className={'h-full rounded-2xl border backdrop-blur-xl shadow-xl overflow-hidden ' +
                  (dark ? 'bg-slate-900/60 border-white/15' : 'bg-white/85 border-slate-200')}>
                  <div
                    ref={chatRef}
                    onScroll={onScroll}
                    className="h-full overflow-y-auto p-3 sm:p-5 space-y-4"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {/* Empty state */}
                    {chat.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-60">
                        <MessageSquareText size={52} className="text-indigo-400 mb-3" />
                        <p className={'text-base font-medium max-w-xs ' + sub}>
                          {"I'm Esa AI. Ask me anything about "}{book}{"!"}
                        </p>
                        <p className={'text-xs mt-1 ' + sub}>You can also send an image 📷</p>
                      </div>
                    )}

                    {/* Messages */}
                    {chat.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      const bubbleCls = isUser
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm'
                        : dark
                          ? 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm';
                      const isUrdu = !isUser && msg.content.includes('\u0627\u0631\u062F\u0648');

                      return (
                        <motion.div key={idx}
                          initial={{ opacity: 0, y: 8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={'flex flex-col max-w-[90%] sm:max-w-[82%] ' + (isUser ? 'ml-auto items-end' : 'mr-auto items-start')}
                        >
                          {/* Label */}
                          <div className={'flex items-center gap-1.5 mb-1 px-1 ' + (isUser ? 'flex-row-reverse' : 'flex-row')}>
                            <div className={'p-1 rounded-full ' + (isUser ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600')}>
                              {isUser ? <User size={12} /> : <Sparkles size={12} />}
                            </div>
                            <span className={'text-xs font-semibold ' + (dark ? 'text-slate-400' : 'text-slate-500')}>
                              {isUser ? 'You' : 'Esa AI'}
                            </span>
                          </div>

                          {/* Bubble */}
                          <div className={'p-3 sm:p-4 rounded-3xl shadow-md break-words max-w-full ' + bubbleCls}>
                            {/* Reply context */}
                            {msg.replyCtx && (
                              <div className={'mb-2 p-2 rounded-lg text-xs italic border-l-4 ' +
                                (isUser ? 'bg-white/20 border-white/40 text-indigo-100' : dark ? 'bg-slate-700 border-indigo-400 text-slate-300' : 'bg-slate-50 border-indigo-300 text-slate-500')}>
                                <span className="font-semibold not-italic block mb-0.5 uppercase text-[10px] opacity-60">Replying to:</span>
                                <div className="line-clamp-2">{msg.replyCtx}</div>
                              </div>
                            )}
                            {/* Image preview in bubble */}
                            {msg.imgUrl && (
                              <img src={msg.imgUrl} alt="uploaded"
                                className="rounded-xl mb-2 max-h-44 object-contain border border-white/20" />
                            )}
                            {/* Text — Nastaleeq font for Urdu content */}
                            <div
                              className="whitespace-pre-line leading-relaxed text-[14px] sm:text-[15px]"
                              style={isUrdu ? { fontFamily: "'Noto Nastaliq Urdu', serif", lineHeight: '2.2', direction: 'rtl' } : {}}
                            >
                              {msg.content
                                ? msg.content
                                : (!isUser && loading)
                                  ? <span className="flex items-center gap-2 opacity-50"><Loader2 className="animate-spin" size={14} /> Esa AI typing...</span>
                                  : ''}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Scroll arrow — only when messages exist AND scrolled up */}
                <AnimatePresence>
                  {showScroll && chat.length > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                      onClick={scrollBottom}
                      className={'absolute bottom-3 right-6 z-20 p-2.5 rounded-full shadow-xl border ' +
                        (dark ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700' : 'bg-white text-indigo-600 border-slate-300 hover:bg-indigo-50')}>
                      <ChevronDown size={18} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Input box — flex-shrink-0, always at bottom */}
              <div
                className={'flex-shrink-0 border-t backdrop-blur-xl ' +
                  (dark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200')}
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
              >
                <div className="max-w-4xl mx-auto px-3 pt-2 pb-1 sm:px-5">
                  {/* Reply strip */}
                  {replyingTo !== null && (
                    <div className={'mb-2 flex items-center gap-2 p-2 rounded-xl border ' +
                      (dark ? 'bg-indigo-900/30 border-indigo-800' : 'bg-indigo-50 border-indigo-200')}>
                      <div className={'flex-1 truncate text-xs ' + (dark ? 'text-indigo-200' : 'text-indigo-700')}>
                        <span className="font-bold mr-1">Replying:</span>
                        <span className="italic opacity-75">{chat[replyingTo].content.substring(0, 55)}...</span>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="text-indigo-400 hover:text-red-400 text-sm">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {/* Image preview */}
                  {selImg && (
                    <div className="mb-2 relative inline-block">
                      <img src={selImg} alt="preview" className="h-16 rounded-xl border border-indigo-400 object-contain" />
                      <button onClick={() => setSelImg(null)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {/* Input row */}
                  <div className="flex items-end gap-2">
                    {/* Image button */}
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={imgLoading}
                      title="Upload image"
                      className={'flex-shrink-0 p-2.5 rounded-xl border transition-all ' +
                        (dark ? 'bg-slate-800 border-slate-600 text-indigo-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-indigo-500 hover:bg-indigo-50')}
                    >
                      {imgLoading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImagePick} />

                    {/* Textarea */}
                    <textarea
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                      rows={2}
                      placeholder="Ask your question here... (Press Enter to send)"
                      className={'flex-1 p-2.5 pr-12 rounded-2xl border focus:ring-4 outline-none resize-none text-sm transition-all ' + inp}
                    />
                    {/* Send button */}
                    <button
                      onClick={() => submit()}
                      disabled={loading || (!question.trim() && !selImg)}
                      className="flex-shrink-0 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-md"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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
