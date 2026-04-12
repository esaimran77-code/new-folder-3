import { useState, useRef, useEffect, memo } from 'react';
import Groq from "groq-sdk";
import {
  BookOpen, MessageSquareText, Loader2, ChevronLeft,
  Folder, AlignLeft, AlignJustify, BookText,
  Send, Sparkles, User, Moon, Sun, ChevronDown,
  Camera, X, Image as ImageIcon
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

// Helper: Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Helper: Resize image to fit within 33MP and 4MB base64 limit for Llama 4 Scout
const resizeImageForLlama4 = async (file: File): Promise<{ base64: string; file: File }> => {
  const MAX_PIXELS = 33177600; // 33 megapixels
  const MAX_BASE64_SIZE = 4 * 1024 * 1024; // 4MB for base64

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const originalPixels = img.width * img.height;

      // Step 1: Calculate target dimensions
      let targetWidth = img.width;
      let targetHeight = img.height;

      if (originalPixels > MAX_PIXELS) {
        const ratio = Math.sqrt(MAX_PIXELS / originalPixels);
        targetWidth = Math.floor(img.width * ratio);
        targetHeight = Math.floor(img.height * ratio);
      }

      // Step 2: Draw on canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Step 3: Try different quality levels to meet base64 size limit
      const tryQuality = (quality: number): Promise<string> => {
        return new Promise((res) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              res('');
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          }, 'image/jpeg', quality);
        });
      };

      const findOptimalQuality = async (): Promise<string> => {
        let quality = 0.9;
        let base64 = await tryQuality(quality);

        while (base64.length > MAX_BASE64_SIZE && quality > 0.3) {
          quality -= 0.1;
          base64 = await tryQuality(quality);
        }
        return base64;
      };

      findOptimalQuality().then((base64) => {
        // Convert base64 back to file for attachment display
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
      }).catch(reject);
    };

    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const FloatingShape = memo(function FloatingShape({
  position, color, speed, scale = 1
}: {
  position: [number, number, number];
  color: string;
  speed: number;
  scale?: number;
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
  const bg = isDarkMode ? 'bg-slate-900' : 'bg-slate-100';
  return (
    <div className={'fixed inset-0 z-0 pointer-events-none transition-colors duration-500 ' + bg}>
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

function buildPrompt(
  book: string,
  answerLength: string,
  userQuestion: string,
  history: { role: string; content: string }[],
  replyContext?: string,
  hasImage: boolean = false
): string {
  const historyText = history.map((h) => h.role + ': ' + h.content).join('\n');
  const replyNote = replyContext ? 'Note: User is replying to: "' + replyContext + '"' : '';
  const imageNote = hasImage ? 'The user has uploaded an image. Please analyze it and incorporate its content into your response.' : '';

  let lines: string[] = [];

  // Pakistani Urdu specific instruction
  const baseInstruction = `
    You are "Esa AI", a compassionate and knowledgeable Pakistani teacher.
    Your responses must be in **authentic Pakistani Urdu** (not Indian Urdu).
    Use respectful vocabulary like "آپ", "جناب", and avoid Indian phrases like "ज़रूर" (use "ضرور" instead).
    Provide **clear, friendly, and easy-to-understand** explanations suitable for students.
    Follow the exact structured format below.
  `;

  if (answerLength === 'short') {
    lines = [
      'Section 1 label (write exactly): 🌸 اردو تشریح',
      'Write exactly 5 lines in pure Pakistani Urdu script. No English, no Roman.',
      '',
      'Section 2 label (write exactly): 📖 English Definition',
      'Write exactly 3 lines in simple English.',
      '',
      'Section 3 label (write exactly): 💡 مثال',
      'Write exactly 2 lines with a real example.',
      '',
      'Section 4 label (write exactly): 🔤 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu.',
    ];
  } else if (answerLength === 'long') {
    lines = [
      'Section 1 label (write exactly): 🌸 اردو تشریح',
      'Write exactly 10 lines in pure Pakistani Urdu script. No English, no Roman.',
      '',
      'Section 2 label (write exactly): 📖 English Definition',
      'Write exactly 5 lines in simple English.',
      '',
      'Section 3 label (write exactly): 💡 مثال',
      'Write exactly 3 lines with a real example.',
      '',
      'Section 4 label (write exactly): 🔤 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu.',
    ];
  } else {
    lines = [
      'Section 1 label (write exactly): 🌸 اردو تشریح',
      'Write exactly 19 lines in pure Pakistani Urdu script. No English, no Roman.',
      '',
      'Section 2 label (write exactly): 📖 English Definition',
      'Write exactly 10 lines in simple English.',
      '',
      'Section 3 label (write exactly): 💡 مثال',
      'Write exactly 6 lines with detailed real examples.',
      '',
      'Section 4 label (write exactly): 🔤 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu.',
    ];
  }

  return [
    baseInstruction,
    'Subject: ' + book,
    '',
    'Conversation history:',
    historyText,
    '',
    replyNote,
    imageNote,
    '',
    'Student question: ' + userQuestion,
    '',
    'STRICT FORMAT:',
    'Line 1: وعلیکم السلام',
    ...lines,
    '',
    'RULES:',
    '1. Use Pakistani Urdu vocabulary and style.',
    '2. Provide easy-to-understand explanations.',
    '3. Urdu section must be in Urdu script only.',
    '4. Roman Urdu must cover all previous sections.',
    '5. No extra text outside the format.',
  ].join('\n');
}

type ChatMsg = {
  role: 'user' | 'model';
  content: string;
  replyContext?: string;
  imageAttachment?: { name: string; preview: string };
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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
  };

  const handleImageSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    try {
      // Resize and compress image
      const { base64, file: resizedFile } = await resizeImageForLlama4(file);
      const preview = URL.createObjectURL(resizedFile);
      setAttachedImage({ file: resizedFile, preview, base64 });
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Could not process image. Please try another one.');
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const removeAttachedImage = () => {
    if (attachedImage?.preview) {
      URL.revokeObjectURL(attachedImage.preview);
    }
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (text?: string) => {
    const userQuestion = text || question;
    if (!userQuestion.trim() && !attachedImage) return;

    const currentReplyContext = replyingTo !== null ? chatHistory[replyingTo].content : undefined;
    setQuestion('');
    setReplyingTo(null);
    setLoading(true);

    const imageAttachment = attachedImage ? {
      name: attachedImage.file.name,
      preview: attachedImage.preview
    } : undefined;

    const userMsg: ChatMsg = {
      role: 'user',
      content: userQuestion || 'Please analyze this image',
      replyContext: currentReplyContext,
      imageAttachment
    };

    const aiMsg: ChatMsg = { role: 'model', content: '' };
    const historyForPrompt = [...chatHistory, userMsg];

    setChatHistory((prev) => [...prev, userMsg, aiMsg]);
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setTimeout(() => scrollToBottom(), 100);

    try {
      const ai = new Groq({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const prompt = buildPrompt(
        book,
        answerLength,
        userMsg.content,
        historyForPrompt,
        currentReplyContext,
        !!attachedImage
      );

      // Prepare messages with vision support if image attached
      const messages: any[] = [];
      
      if (attachedImage) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: attachedImage.base64 } }
          ]
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const response = await ai.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages,
        stream: true,
        max_tokens: 2048,
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
      setTimeout(() => scrollToBottom(), 50);
    } catch (error: unknown) {
      const rawError = error instanceof Error ? error.message : JSON.stringify(error);
      let msg = 'An unknown error occurred.';
      if (rawError.includes('503') || rawError.includes('high demand')) {
        msg = 'AI is busy. Please try again.';
      } else if (rawError.includes('403') || rawError.includes('PERMISSION_DENIED')) {
        msg = 'API Key error.';
      } else if (rawError.includes('413') || rawError.includes('too large')) {
        msg = 'Image too large even after compression. Please try a smaller image.';
      } else if (rawError.length > 0) {
        msg = rawError.substring(0, 200);
      }
      setChatHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: '⚠️ ' + msg };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const pv = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  const dm = isDarkMode;

  return (
    <div className={dm ? 'dark' : ''}>
      <Background3D isDarkMode={dm} />

      <button
        onClick={() => setIsDarkMode(!dm)}
        className={
          'fixed top-5 right-5 z-50 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg ' +
          (dm ? 'bg-white/10 text-yellow-300 hover:bg-white/20' : 'bg-slate-800/10 text-slate-700 hover:bg-slate-800/20')
        }
      >
        {dm ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="min-h-screen relative z-10 overflow-x-hidden">
        <AnimatePresence mode="wait">

          {/* SCREEN 1 */}
          {screen === 1 && (
            <motion.div key="s1" variants={pv} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="text-center mb-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className={
                    'inline-block p-4 rounded-full backdrop-blur-md mb-6 border ' +
                    (dm ? 'bg-white/10 border-white/20' : 'bg-white/50 border-slate-200 shadow-sm')
                  }
                >
                  <BookOpen size={48} className="text-indigo-500" />
                </motion.div>
                <h1 className={'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-lg mb-4 ' + (dm ? 'text-white' : 'text-slate-800')}>
                  {"Esa's CIT "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                    Learning Hub
                  </span>
                </h1>
                <p className={'text-lg sm:text-xl max-w-2xl mx-auto drop-shadow ' + (dm ? 'text-slate-300' : 'text-slate-600')}>
                  Select a subject to begin your personalized learning journey
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
                {BOOKS.map((b, i) => (
                  <motion.button key={b}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }}
                    className={
                      'flex items-center gap-4 p-6 backdrop-blur-md rounded-2xl shadow-lg border transition-colors text-left group will-change-transform ' +
                      (dm ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200')
                    }
                  >
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Folder size={24} />
                    </div>
                    <span className={'font-semibold text-lg leading-tight ' + (dm ? 'text-white' : 'text-slate-800')}>{b}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 2 */}
          {screen === 2 && (
            <motion.div key="s2" variants={pv} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-4xl">
                <button onClick={() => setScreen(1)}
                  className={
                    'flex items-center gap-2 mb-8 transition-colors px-4 py-2 rounded-full backdrop-blur-sm w-fit ' +
                    (dm ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20' : 'text-slate-600 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200')
                  }
                >
                  <ChevronLeft size={20} /> Back to Subjects
                </button>
                <div className="text-center mb-12">
                  <h2 className={'text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md ' + (dm ? 'text-white' : 'text-slate-800')}>{book}</h2>
                  <p className={'text-lg sm:text-xl drop-shadow ' + (dm ? 'text-indigo-200' : 'text-indigo-600')}>
                    How detailed would you like your answers to be?
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'short', title: 'Short & Sweet', icon: AlignLeft, desc: 'Quick summaries and to-the-point answers.' },
                    { id:       'Write exactly 5 lines in simple English.',
      '',
      'Section 3 label (write exactly): \uD83D\uDCA1 Example',
      'Write exactly 3 lines with a real example.',
      '',
      'Section 4 label (write exactly): \uD83D\uDD24 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu.',
    ];
  } else {
    lines = [
      'Line 1: وعلیکم السلام',
      '',
      'Section 1 label (write exactly): \uD83C\uDF38 Urdu Explanation',
      'Write exactly 19 lines in pure Urdu script. No English, no Roman.',
      '',
      'Section 2 label (write exactly): \uD83D\uDCD6 English Definition',
      'Write exactly 10 lines in simple English.',
      '',
      'Section 3 label (write exactly): \uD83D\uDCA1 Example',
      'Write exactly 6 lines with detailed real examples.',
      '',
      'Section 4 label (write exactly): \uD83D\uDD24 Roman Urdu',
      'Translate sections 1+2+3 into Roman Urdu.',
    ];
  }

  return [
    'You are Esa AI, a caring teacher for: ' + book,
    '',
    'Conversation history:',
    historyText,
    '',
    replyNote,
    '',
    'Student question: ' + userQuestion,
    '',
    'STRICT FORMAT:',
    lines.join('\n'),
    '',
    'RULES:',
    '1. Follow format exactly.',
    '2. Urdu Explanation must be pure Urdu script only.',
    '3. Roman Urdu must cover all 3 previous sections.',
    '4. No bullet points. Plain paragraphs.',
    '5. No extra text outside the format.',
  ].join('\n');
}

type ChatMsg = { role: 'user' | 'model'; content: string; replyContext?: string };

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

    const userMsg: ChatMsg = { role: 'user', content: userQuestion, replyContext: currentReplyContext };
    const aiMsg: ChatMsg = { role: 'model', content: '' };
    const historyForPrompt = [...chatHistory, userMsg];

    setChatHistory((prev) => [...prev, userMsg, aiMsg]);
    setTimeout(() => scrollToBottom(), 100);

    try {
      const ai = new Groq({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const prompt = buildPrompt(book, answerLength, userQuestion, historyForPrompt, currentReplyContext);

      const response = await ai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 2048,
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
      setTimeout(() => scrollToBottom(), 50);
    } catch (error: unknown) {
      const rawError = error instanceof Error ? error.message : JSON.stringify(error);
      let msg = 'An unknown error occurred.';
      if (rawError.includes('503') || rawError.includes('high demand')) {
        msg = 'AI is busy. Please try again.';
      } else if (rawError.includes('403') || rawError.includes('PERMISSION_DENIED')) {
        msg = 'API Key error.';
      } else if (rawError.length > 0) {
        msg = rawError.substring(0, 200);
      }
      setChatHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: '\u26A0\uFE0F ' + msg };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const pv = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  const dm = isDarkMode;

  return (
    <div className={dm ? 'dark' : ''}>
      <Background3D isDarkMode={dm} />

      <button
        onClick={() => setIsDarkMode(!dm)}
        className={
          'fixed top-5 right-5 z-50 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg ' +
          (dm ? 'bg-white/10 text-yellow-300 hover:bg-white/20' : 'bg-slate-800/10 text-slate-700 hover:bg-slate-800/20')
        }
      >
        {dm ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="min-h-screen relative z-10 overflow-x-hidden">
        <AnimatePresence mode="wait">

          {/* SCREEN 1 */}
          {screen === 1 && (
            <motion.div key="s1" variants={pv} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="text-center mb-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className={
                    'inline-block p-4 rounded-full backdrop-blur-md mb-6 border ' +
                    (dm ? 'bg-white/10 border-white/20' : 'bg-white/50 border-slate-200 shadow-sm')
                  }
                >
                  <BookOpen size={48} className="text-indigo-500" />
                </motion.div>
                <h1 className={'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-lg mb-4 ' + (dm ? 'text-white' : 'text-slate-800')}>
  {"Esa "}
  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
    Learning Hub
  </span>
</h1>
                <p className={'text-lg sm:text-xl max-w-2xl mx-auto drop-shadow ' + (dm ? 'text-slate-300' : 'text-slate-600')}>
                  Select a subject to begin your personalized learning journey
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
                {BOOKS.map((b, i) => (
                  <motion.button key={b}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setBook(b); setChatHistory([]); setScreen(2); }}
                    className={
                      'flex items-center gap-4 p-6 backdrop-blur-md rounded-2xl shadow-lg border transition-colors text-left group will-change-transform ' +
                      (dm ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200')
                    }
                  >
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Folder size={24} />
                    </div>
                    <span className={'font-semibold text-lg leading-tight ' + (dm ? 'text-white' : 'text-slate-800')}>{b}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* SCREEN 2 */}
          {screen === 2 && (
            <motion.div key="s2" variants={pv} initial="initial" animate="animate" exit="exit"
              className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-4xl">
                <button onClick={() => setScreen(1)}
                  className={
                    'flex items-center gap-2 mb-8 transition-colors px-4 py-2 rounded-full backdrop-blur-sm w-fit ' +
                    (dm ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20' : 'text-slate-600 hover:text-slate-900 bg-slate-200/50 hover:bg-slate-200')
                  }
                >
                  <ChevronLeft size={20} /> Back to Subjects
                </button>
                <div className="text-center mb-12">
                  <h2 className={'text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md ' + (dm ? 'text-white' : 'text-slate-800')}>{book}</h2>
                  <p className={'text-lg sm:text-xl drop-shadow ' + (dm ? 'text-indigo-200' : 'text-indigo-600')}>
                    How detailed would you like your answers to be?
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'short', title: 'Short & Sweet', icon: AlignLeft, desc: 'Quick summaries and to-the-point answers.' },
                    { id: 'long', title: 'Detailed', icon: AlignJustify, desc: 'Comprehensive explanations covering all aspects.' },
                    { id: 'in-depth', title: 'In-Depth Masterclass', icon: BookText, desc: 'Extensive deep-dive with examples and full breakdowns.' },
                  ].map((opt, i) => (
                    <motion.button key={opt.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => { setAnswerLength(opt.id); setScreen(3); }}
                      className={
                        'flex flex-col items-center text-center p-8 backdrop-blur-md rounded-3xl shadow-xl border transition-all group will-change-transform ' +
                        (dm ? 'bg-white/10 hover:bg-white/20 border-white/20' : 'bg-white/80 hover:bg-white border-slate-200')
                      }
                    >
                      <div className="p-5 bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <opt.icon size={40} />
                      </div>
                      <h3 className={'text-2xl font-bold mb-3 ' + (dm ? 'text-white' : 'text-slate-800')}>{opt.title}</h3>
                      <p className={'leading-relaxed ' + (dm ? 'text-slate-300' : 'text-slate-600')}>{opt.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 3 */}
          {screen === 3 && (
            <motion.div key="s3" variants={pv} initial="initial" animate="animate" exit="exit"
              className="flex flex-col" style={{ height: '100dvh' }}>

              {/* Header */}
              <div className="flex-shrink-0 p-4 sm:p-6 max-w-5xl w-full mx-auto">
                <div className={
                  'backdrop-blur-md p-4 sm:p-5 rounded-3xl border shadow-lg ' +
                  (dm ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200')
                }>
                  <button onClick={() => setScreen(2)}
                    className={
                      'flex items-center gap-1 mb-1 transition-colors text-sm font-medium ' +
                      (dm ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-900')
                    }
                  >
                    <ChevronLeft size={16} /> Change Settings
                  </button>
                  <h2 className={'text-xl sm:text-2xl font-bold flex items-center gap-2 ' + (dm ? 'text-white' : 'text-slate-800')}>
                    <Sparkles className="text-yellow-300" size={24} />
                    {chatHeading}
                  </h2>
                  <p className={'mt-1 text-sm font-medium flex items-center gap-2 ' + (dm ? 'text-indigo-200' : 'text-indigo-600')}>
                    <Folder size={14} /> {book}
                    <span className="opacity-50">•</span>
                    {answerLength === 'short' ? 'Short' : answerLength === 'long' ? 'Detailed' : 'In-Depth'}
                  </p>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-hidden max-w-5xl w-full mx-auto px-4 sm:px-6 relative min-h-0">
                <div className={
                  'h-full rounded-3xl border backdrop-blur-xl shadow-2xl overflow-hidden ' +
                  (dm ? 'bg-slate-900/50 border-white/20' : 'bg-white/80 border-slate-200')
                }>
                  <div
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto p-4 sm:p-6 space-y-5"
                  >
                    {chatHistory.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-10">
                        <MessageSquareText size={56} className="text-indigo-400 mb-4" />
                        <p className={'text-lg font-medium max-w-md ' + (dm ? 'text-slate-300' : 'text-slate-600')}>
                          {"I'm Esa AI. Ask me anything about "}{book}{"!"}
                        </p>
                      </div>
                    )}

                    {chatHistory.map((msg, index) => {
                      const isUser = msg.role === 'user';
                      const bubbleCls = isUser
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm'
                        : dm
                          ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                          : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm';
                      const replyCls = isUser
                        ? 'bg-white/20 border-white/50 text-indigo-50'
                        : dm
                          ? 'bg-slate-700 border-indigo-400 text-slate-300'
                          : 'bg-slate-50 border-indigo-300 text-slate-500';

                      return (
                        <motion.div key={index}
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={'flex flex-col max-w-[88%] will-change-transform ' + (isUser ? 'ml-auto items-end' : 'mr-auto items-start')}
                        >
                          <div className={'flex items-center gap-2 mb-1 px-1 ' + (isUser ? 'flex-row-reverse' : 'flex-row')}>
                            <div className={'p-1.5 rounded-full ' + (isUser ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600')}>
                              {isUser ? <User size={14} /> : <Sparkles size={14} />}
                            </div>
                            <span className={'text-xs font-bold ' + (dm ? 'text-slate-400' : 'text-slate-500')}>
                              {isUser ? 'You' : 'Esa AI'}
                            </span>
                          </div>

                          <div className={'p-4 rounded-3xl shadow-md break-words ' + bubbleCls}>
                            {msg.replyContext && (
                              <div className={'mb-3 p-2 rounded-xl text-xs italic border-l-4 ' + replyCls}>
                                <span className="font-semibold not-italic block mb-1 uppercase tracking-wider opacity-70">
                                  Replying to:
                                </span>
                                <div className="line-clamp-2">{msg.replyContext}</div>
                              </div>
                            )}
                            <div className="whitespace-pre-line leading-relaxed text-[15px]">
                              {msg.content
                                ? msg.content
                                : (loading && !isUser)
                                  ? (
                                    <span className="flex items-center gap-2 opacity-60">
                                      <Loader2 className="animate-spin" size={15} />
                                      Esa AI typing...
                                    </span>
                                  )
                                  : ''}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence>
                  {showScrollBtn && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      onClick={scrollToBottom}
                      className={
                        'absolute bottom-4 right-8 z-30 p-2.5 rounded-full shadow-xl border ' +
                        (dm ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700' : 'bg-white text-indigo-600 border-slate-300 hover:bg-indigo-50')
                      }
                    >
                      <ChevronDown size={20} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Input — flex-shrink-0 so it NEVER moves */}
              <div
                className={
                  'flex-shrink-0 border-t backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] ' +
                  (dm ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200')
                }
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
              >
                <div className="max-w-5xl mx-auto px-4 pt-3 pb-1 sm:px-6">
                  {replyingTo !== null && (
                    <div className={
                      'mb-2 flex items-center justify-between p-2 rounded-xl border ' +
                      (dm ? 'bg-indigo-900/30 border-indigo-800' : 'bg-indigo-50 border-indigo-100')
                    }>
                      <div className={'flex-1 truncate text-xs ' + (dm ? 'text-indigo-200' : 'text-indigo-800')}>
                        <span className="font-bold mr-1">Replying to:</span>
                        <span className="italic opacity-80">{chatHistory[replyingTo].content.substring(0, 60)}...</span>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="text-indigo-400 hover:text-indigo-600 ml-2 text-sm">x</button>
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
                      rows={2}
                      placeholder="Ask your question here... (Press Enter to send)"
                      className={
                        'w-full p-3 pr-14 rounded-2xl border focus:ring-4 outline-none resize-none shadow-sm transition-all text-[15px] ' +
                        (dm
                          ? 'bg-slate-800 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 text-white placeholder-slate-400'
                          : 'bg-white border-slate-300 focus:border-indigo-400 focus:ring-indigo-100 text-slate-700 placeholder-slate-400')
                      }
                    />
                    <button
                      onClick={() => handleSubmit()}
                      disabled={loading || !question.trim()}
                      className="absolute right-2 bottom-2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-md"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
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
