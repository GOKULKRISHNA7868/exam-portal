import { useEffect, useState, useRef } from "react";
import { doc, getDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Play,
  Square,
  Volume2,
  VolumeX,
  Clock,
  User,
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Shield,
  Monitor,
  Trophy,
  FileText,
  Send,
  Loader,
} from "lucide-react";

interface CommunicationTest {
  title: string;
  description: string;
  instructions: string;
  questions: string[];
}

const TakeCommunicationRound: React.FC = () => {
  const [test, setTest] = useState<CommunicationTest | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [timerSec, setTimerSec] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [violations, setViolations] = useState(0);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const speechRef = useRef<any>(null);

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsub();
  }, []);

  // Fetch test data
  useEffect(() => {
    const fetchTest = async () => {
      try {
        // Try to fetch user-specific communication test first
        if (userId) {
          const userTestRef = doc(db, "communicationTests", userId);
          const userTestSnap = await getDoc(userTestRef);
          if (userTestSnap.exists()) {
            const testData = userTestSnap.data() as CommunicationTest;
            setTest(testData);
            setResponses(new Array(testData.questions.length).fill(""));
            return;
          }
        }
        
        // Fallback to default test
        const ref = doc(db, "COMMUNICATIONTEST", "5APVrNkKUb3qprzxehmz");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const testData = snap.data() as CommunicationTest;
          setTest(testData);
          setResponses(new Array(testData.questions.length).fill(""));
        }
      } catch (error) {
        console.error("Error fetching test:", error);
      }
    };
    fetchTest();
  }, [userId]);

  // Setup speech recognition
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    const recog = new SpeechRecognition();
    recog.lang = "en-US";
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onstart = () => {
      setIsRecording(true);
      if (soundEnabled) {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj");
        audio.play().catch(() => {});
      }
    };

    recog.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      setCurrentResponse(transcript);
      setIsRecording(false);

      if (!test || !userId) return;

      const question = test.questions[currentQ];
      const score = calculateScore(question, transcript, confidence);

      try {
        await addDoc(collection(db, "communicationResponse"), {
          userId,
          testId: "5APVrNkKUb3qprzxehmz",
          questionIndex: currentQ,
          question,
          responseText: transcript,
          confidence: Math.round(confidence * 100),
          score,
          createdAt: new Date(),
        });

        // Update local responses
        setResponses(prev => {
          const newResponses = [...prev];
          newResponses[currentQ] = transcript;
          return newResponses;
        });

        if (soundEnabled) {
          const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj");
          audio.play().catch(() => {});
        }

      } catch (error) {
        console.error("Error saving response:", error);
      }
    };

    recog.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      
      if (event.error === 'no-speech') {
        alert("No speech detected. Please try again.");
      } else if (event.error === 'network') {
        alert("Network error. Please check your connection.");
      }
    };

    recog.onend = () => {
      setIsRecording(false);
    };

    setRecognition(recog);
    speechRef.current = recog;

    return () => {
      if (speechRef.current) {
        speechRef.current.stop();
      }
    };
  }, [test, userId, currentQ, soundEnabled]);

  // Timer
  useEffect(() => {
    if (!started || completed) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimerSec((s) => s + 1);
    }, 1000) as unknown as number;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [started, completed]);

  // Anti-cheat monitoring
  useEffect(() => {
    if (!started || completed) return;

    const bumpViolation = (reason: string) => {
      setViolations((v) => v + 1);
      setWarningMsg(reason);
      if (soundEnabled) {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj");
        audio.play().catch(() => {});
      }
    };

    const onVisibility = () => {
      if (document.hidden) bumpViolation("Tab switch detected");
    };
    
    const onBlur = () => bumpViolation("Window lost focus");
    
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        bumpViolation("Exited full-screen mode");
        setShowFullscreen(false);
      } else {
        setShowFullscreen(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);

    const preventContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", preventContext);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", preventContext);
    };
  }, [started, completed, soundEnabled]);

  const calculateScore = (question: string, response: string, confidence: number) => {
    const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const rWords = response.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    let matches = 0;
    qWords.forEach((word) => {
      if (rWords.some(rWord => rWord.includes(word) || word.includes(rWord))) {
        matches++;
      }
    });

    const contentScore = qWords.length > 0 ? (matches / qWords.length) * 100 : 0;
    const confidenceScore = confidence * 100;
    const lengthScore = Math.min((response.length / 50) * 100, 100);

    return Math.round((contentScore * 0.5 + confidenceScore * 0.3 + lengthScore * 0.2));
  };

  const requestFullscreen = async () => {
    const el = document.documentElement as any;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" } as any);
        setShowFullscreen(true);
      }
    } catch {
      // ignore
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setShowFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  const startRecording = () => {
    if (recognition && !isRecording) {
      setCurrentResponse("");
      recognition.start();
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
    }
  };

  const nextQuestion = () => {
    if (currentQ < (test?.questions.length || 0) - 1) {
      setCurrentQ(currentQ + 1);
      setCurrentResponse("");
    }
  };

  const previousQuestion = () => {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      setCurrentResponse(responses[currentQ - 1] || "");
    }
  };

  const handleComplete = async () => {
    if (!userId || !test) return;
    
    setLoading(true);
    
    try {
      await setDoc(doc(db, "communicationCompletion", userId), {
        completed: true,
        completedAt: new Date(),
        totalQuestions: test.questions.length,
        answeredQuestions: responses.filter(r => r.trim()).length,
        duration: timerSec,
        violations: violations,
      });

      setCompleted(true);
      await exitFullscreen();
      
      if (soundEnabled) {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj");
        audio.play().catch(() => {});
      }
    } catch (error) {
      console.error("Error completing test:", error);
    } finally {
      setLoading(false);
    }
  };

  const readQuestion = (question: string) => {
    if ('speechSynthesis' in window) {
      setIsPlaying(true);
      const utterance = new SpeechSynthesisUtterance(question);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = soundEnabled ? 1 : 0;
      
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      speechSynthesis.speak(utterance);
    }
  };

  const stopReading = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  const fmtTime = (s: number) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  if (!test) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading communication test...</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">
            Test Completed!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
            Your communication assessment has been successfully submitted.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="font-semibold">{fmtTime(timerSec)}</span>
            </div>
            <div className="flex justify-between">
              <span>Questions:</span>
              <span className="font-semibold">{responses.filter(r => r.trim()).length} / {test.questions.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Violations:</span>
              <span className="font-semibold">{violations}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!acceptedRules) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-[#eff1f6] dark:bg-slate-800 rounded-2xl 
        shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] 
        dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] 
        p-8"
      >
        {/* Header */}
        <div className="text-center mb-8">
          
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Communication Assessment
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Voice-based Communication Test
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Test Instructions:
          </h3>
          <ul className="space-y-3 text-slate-700 dark:text-slate-300">
            <li className="flex items-start">
              <Mic className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <span>You will be asked to respond to questions using your voice</span>
            </li>
            <li className="flex items-start">
              <Shield className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <span>The test will run in full-screen mode for security</span>
            </li>
            <li className="flex items-start">
              <Monitor className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <span>Do not switch tabs or minimize the window</span>
            </li>
            <li className="flex items-start">
              <Clock className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <span>Speak clearly and at a moderate pace</span>
            </li>
            <li className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Violations will be recorded and may affect evaluation</span>
            </li>
          </ul>
        </div>

        {/* Test Details Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 shadow-inner">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Test Details:
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {test.questions.length} questions
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {test.description}
              </p>
            </div>
          </div>
        </div>

        {/* Rules Acceptance */}
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              onChange={(e) => setAcceptedRules(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              I have read and accept the test instructions
            </span>
          </label>
          <button
            onClick={() => setAcceptedRules(true)}
            disabled={!acceptedRules}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg 
            disabled:opacity-50 disabled:cursor-not-allowed 
            hover:bg-blue-700 transition-all duration-200 transform hover:scale-[1.02] 
            shadow-[6px_6px_12px_rgba(0,0,0,0.15),-6px_-6px_12px_#ffffff] 
            dark:shadow-[6px_6px_12px_rgba(0,0,0,0.4),-6px_-6px_12px_rgba(255,255,255,0.05)] 
            hover:shadow-[8px_8px_16px_rgba(0,0,0,0.2),-8px_-8px_16px_#ffffff]"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
};


  if (!started) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-[#eff1f6] dark:bg-slate-800 rounded-2xl shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] p-8 text-center"
        >
          
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Ready to Begin?</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            When you start, we will enable full-screen mode and begin recording your responses.
          </p>
          
          <div className="bg-white/60 dark:bg-slate-700/60 rounded-2xl p-6 mb-8 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05),inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.05)]">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">{test.questions.length}</div>
                <div className="text-slate-600 dark:text-slate-400 font-medium">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">Voice</div>
                <div className="text-slate-600 dark:text-slate-400 font-medium">Response</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={async () => {
                await requestFullscreen();
                setStarted(true);
              }}
              className="px-8 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 hover:scale-[1.02] shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)]"
            >
           
              Start Test
            </button>
            <button
              onClick={() => setAcceptedRules(false)}
              className="px-8 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 hover:scale-[1.02] shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)]"
            >
              Back
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const ExamHeader = (
    <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
                {fmtTime(timerSec)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {responses.filter(r => r.trim()).length} / {test.questions.length} answered
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Violations: <span className="font-semibold text-orange-600">{violations}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
              showFullscreen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <Monitor className="w-4 h-4" />
              <span>{showFullscreen ? 'Fullscreen ON' : 'Fullscreen OFF'}</span>
            </div>
          </div>
        </div>
      </div>

      {warningMsg && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-800 dark:text-yellow-200">{warningMsg}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={async () => {
                    setWarningMsg(null);
                    await requestFullscreen();
                  }}
                  className="px-3 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded text-sm hover:bg-yellow-300 dark:hover:bg-yellow-700"
                >
                  Resume Fullscreen
                </button>
                <button
                  onClick={() => setWarningMsg(null)}
                  className="px-3 py-1 bg-white dark:bg-gray-800 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {ExamHeader}

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-[#eff1f6] dark:bg-slate-800 rounded-2xl shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] overflow-hidden">
          {/* Question Header */}
          <div className="p-6 border-b border-transparent bg-[#eff1f6] dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  Question {currentQ + 1} of {test.questions.length}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">{test.title}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={isPlaying ? stopReading : () => readQuestion(test.questions[currentQ])}
                  className={`p-3 rounded-lg transition-colors ${
                    isPlaying 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  {isPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="p-8">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4 leading-relaxed">
                  {test.questions[currentQ]}
                </h3>
                
                {test.instructions && currentQ === 0 && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-slate-700 dark:text-slate-300 text-sm">
                      {test.instructions}
                    </p>
                  </div>
                )}
              </div>

              {/* Recording Section */}
              <div className="bg-[#f3f5fa] dark:bg-slate-700 rounded-2xl p-8 mb-6 shadow-[inset_6px_6px_12px_rgba(0,0,0,0.08),inset_-6px_-6px_12px_#ffffff] dark:shadow-none">
                <div className="flex flex-col items-center space-y-6">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording 
                      ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                  }`}>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={!recognition}
                      className="w-full h-full rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRecording ? (
                        <MicOff className="w-8 h-8" />
                      ) : (
                        <Mic className="w-8 h-8" />
                      )}
                    </button>
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {isRecording ? "Recording..." : "Click to Start Recording"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {isRecording 
                        ? "Speak clearly and click the microphone to stop" 
                        : "Click the microphone to begin your response"
                      }
                    </p>
                  </div>

                  {currentResponse && (
                    <div className="w-full max-w-md">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Your Response:</h4>
                        <p className="text-slate-900 dark:text-white text-sm leading-relaxed">
                          {currentResponse}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={previousQuestion}
                  disabled={currentQ === 0}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Question {currentQ + 1} of {test.questions.length}
                  </span>
                  
                  {responses[currentQ]?.trim() && (
                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Answered
                    </span>
                  )}
                </div>

                {currentQ < test.questions.length - 1 ? (
                  <button
                    onClick={nextQuestion}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mr-2" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Complete Test
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="mt-6 bg-[#eff1f6] dark:bg-slate-800 rounded-2xl shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Progress Overview</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-4">
            {test.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentQ(index);
                  setCurrentResponse(responses[index] || "");
                }}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                  index === currentQ
                    ? "bg-blue-600 text-white shadow-lg"
                    : responses[index]?.trim()
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Current</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Answered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Not Answered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeCommunicationRound;
