import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BookOpen, MessageSquareText, Loader2 } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

function FloatingShape({ position, color, speed, scale = 1 }: { position: [number, number, number], color: string, speed: number, scale?: number }) {
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
}

function Background3D() {
  return (
    <div className="fixed inset-0 z-0 bg-slate-900 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <FloatingShape position={[-4, 2, -2]} color="#818cf8" speed={0.2} scale={1.5} />
        <FloatingShape position={[5, -2, -5]} color="#c084fc" speed={0.15} scale={2} />
        <FloatingShape position={[0, 0, -8]} color="#60a5fa" speed={0.1} scale={3} />
        <FloatingShape position={[-5, -4, -4]} color="#f472b6" speed={0.25} scale={1.2} />
        <FloatingShape position={[6, 4, -3]} color="#2dd4bf" speed={0.18} scale={1.8} />
      </Canvas>
    </div>
  );
}

export default function App() {
  const [book, setBook] = useState(BOOKS[0]);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', content: string, replyContext?: string}[]>([]);
  const [answerLength, setAnswerLength] = useState('short');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const handleSubmit = async (text?: string) => {
    const userQuestion = text || question;
    if (!userQuestion.trim()) return;
    
    const currentReplyContext = replyingTo !== null ? chatHistory[replyingTo].content : undefined;
    
    setQuestion('');
    setReplyingTo(null);
    setLoading(true);
    
    const newChatHistory = [...chatHistory, {role: 'user' as const, content: userQuestion, replyContext: currentReplyContext}];
    setChatHistory(newChatHistory);

    try {
      const ai = new GoogleGenAI({ apiKey: AIzaSyDyR5HvQhdeYQXjZFy0TjuBZrMlgVsBkpM });
      
      const prompt = `
        Subject: ${book}
        Context of the entire conversation:
        ${newChatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}
        
        ${currentReplyContext ? `IMPORTANT CONTEXT FOR THIS QUESTION: The user is specifically replying to the following previous answer:\n"""\n${currentReplyContext}\n"""\n\nPlease address their question in direct relation to this specific answer.` : ''}
        
        Instructions for the answer:
        1. Provide a comprehensive, hierarchical answer.
        2. If the topic is complex (like Memory Management), explain:
           - Definition, working mechanism in the system, practical steps/examples.
           - Hierarchical breakdown (tree structure) of sub-topics/branches.
           - For each branch: Definition, Characteristics, Advantages, Disadvantages.
        3. Multilingual Format:
           - Part 1: Pure Urdu explanation.
           - Part 2: English explanation (detailed).
           - Part 3: Roman Urdu translation.
        
        Format as plain paragraphs, no bullet points.
        Make the answer ${answerLength}.
      `;
      
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      setChatHistory([...newChatHistory, {role: 'model' as const, content: textResponse.text || "No answer generated."}]);
    } catch (error: any) {
      console.error("Detailed API Error:", error);
      const errorMessage = error?.message || JSON.stringify(error) || "An unknown error occurred.";
      setChatHistory([...newChatHistory, {role: 'model' as const, content: `⚠️ Error: ${errorMessage}\n\nPlease try asking again.`}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Background3D />
      <div className="min-h-screen relative z-10 p-4 sm:p-6 md:p-8 lg:p-12 overflow-y-auto">
        <header className="max-w-6xl mx-auto mb-8 md:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">Esa's CIT Learning Hub</h1>
          <p className="text-slate-200 mt-3 text-sm sm:text-base md:text-lg drop-shadow max-w-2xl mx-auto">Your personalized assistant for Computer Information Technology</p>
        </header>

        <main className="max-w-3xl mx-auto flex flex-col gap-8">
          <section className="bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-2xl shadow-xl border border-white/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800"><BookOpen size={20}/> Input</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input type="text" value="Computer Information Technology (CIT)" disabled className="w-full p-2 rounded-lg bg-slate-100/50 text-slate-600 border border-slate-200/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Book</label>
                <select value={book} onChange={(e) => setBook(e.target.value)} className="w-full p-2 rounded-lg bg-white/90 border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                  {BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Answer Length</label>
                <select value={answerLength} onChange={(e) => setAnswerLength(e.target.value)} className="w-full p-2 rounded-lg bg-white/90 border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                  <option value="long with long explanation">Long with Long Explanation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Question</label>
                <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full p-2 rounded-lg bg-white/90 border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" rows={4} placeholder="Ask anything about CIT..." />
              </div>
              <button onClick={() => handleSubmit()} disabled={loading} className="w-full p-3 bg-indigo-600/90 backdrop-blur-sm text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg">
                {loading ? <><Loader2 className="animate-spin" size={20}/> Generating...</> : 'Get Answer'}
              </button>
            </div>
          </section>

          <section className="space-y-6">
            {chatHistory.length === 0 && (
              <div className="bg-white/40 backdrop-blur-sm p-12 rounded-2xl border border-white/10 text-center text-white/80 italic">
                No conversation yet. Ask a question to get started!
              </div>
            )}
            {chatHistory.map((msg, index) => (
              <div key={index} className={`p-5 sm:p-8 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 ${msg.role === 'user' ? 'bg-indigo-50/80 border-indigo-200/50 ml-4 sm:ml-12' : 'bg-white/80 border-white/20 mr-4 sm:mr-12'}`}>
                <h2 className="text-lg font-semibold mb-4 flex items-center justify-between gap-2 text-slate-800">
                  <span className="flex items-center gap-2">
                    {msg.role === 'user' ? <BookOpen size={20}/> : <MessageSquareText size={20}/>}
                    {msg.role === 'user' ? 'Question' : 'Answer'}
                  </span>
                  {msg.role === 'model' && (
                    <button onClick={() => setReplyingTo(index)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-100/50 px-3 py-1 rounded-full transition-colors">Reply</button>
                  )}
                </h2>
                {msg.replyContext && (
                  <div className="mb-4 p-3 bg-white/60 rounded-lg border-l-4 border-indigo-400 text-sm text-slate-600 line-clamp-3 italic">
                    <span className="font-semibold not-italic block mb-1">Replying to:</span>
                    {msg.replyContext}
                  </div>
                )}
                <div className="whitespace-pre-line text-slate-800 leading-relaxed">{msg.content}</div>
                {replyingTo === index && (
                  <div className="mt-4 pt-4 border-t border-slate-200/50">
                    <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full p-2 rounded-lg bg-white/90 border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} placeholder="Reply to this answer..." />
                    <button onClick={() => handleSubmit()} className="mt-3 px-4 py-2 bg-indigo-600/90 backdrop-blur-sm text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md">Send Reply</button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
