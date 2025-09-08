import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Shield,
  Monitor,
  Play,
  Send,
  ChevronLeft,
  ChevronRight,
  Trophy,
  FileText,
  User,
  Volume2,
  VolumeX,
  Maximize,
  BookOpen,
  Target,
} from "lucide-react";

const MCQRoundPage = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [warningGiven, setWarningGiven] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const [violations, setViolations] = useState(0);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);

  const timerRef = React.useRef<number | null>(null);

  useEffect(() => {
    const checkAlreadySubmitted = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "responses", user.uid));
      if (snap.exists() && snap.data()?.round1Submitted) {
        setSubmitted(true);
      }
    };
    checkAlreadySubmitted();
  }, [user]);

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!user) return;
      const qSnap = await getDocs(
        query(
          collection(db, "questions"),
          where("type", "==", "mcq"),
          where("assignedTo", "array-contains", user.uid)
        )
      );
      const list = qSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setQuestions(list);
    };
    fetchQuestions();
  }, [user]);

  // Timer
  useEffect(() => {
    if (!started || submitted) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimerSec((s) => s + 1);
    }, 1000) as unknown as number;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [started, submitted]);

  // Anti-cheat monitoring
  useEffect(() => {
    const handleViolation = async () => {
      if (!started || submitted) return;
      
      setViolations(v => v + 1);
      
      if (!warningGiven) {
        setWarningMsg("Warning: Do not exit fullscreen or switch tabs. Next violation will reject your exam.");
        setWarningGiven(true);
        if (soundEnabled) {
          const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj");
          audio.play().catch(() => {});
        }
        reEnterFullscreen();
      } else {
        setWarningMsg("Exam rejected due to repeated violations.");
        await handleReject();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) handleViolation();
    };

    const handleFullscreenExit = () => {
      if (!document.fullscreenElement) {
        setShowFullscreen(false);
        handleViolation();
      } else {
        setShowFullscreen(true);
      }
    };

    const handleESCKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleViolation();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable refresh
      if ((e.ctrlKey || e.metaKey) && e.key === "r") e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") e.preventDefault();
      if (e.key === "F5") e.preventDefault();
    };

    if (started && !submitted) {
      document.addEventListener("visibilitychange", handleVisibility);
      document.addEventListener("fullscreenchange", handleFullscreenExit);
      window.addEventListener("keydown", handleESCKey);
      window.addEventListener("keydown", handleKeyDown);

      const preventContext = (e: MouseEvent) => e.preventDefault();
      document.addEventListener("contextmenu", preventContext);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        document.removeEventListener("fullscreenchange", handleFullscreenExit);
        window.removeEventListener("keydown", handleESCKey);
        window.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("contextmenu", preventContext);
      };
    }
  }, [started, submitted, warningGiven, soundEnabled]);

  const reEnterFullscreen = async () => {
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

  const handleStart = async () => {
    setStarted(true);
    await reEnterFullscreen();
  };

  const handleSelect = (qid: string, opt: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qid]: opt }));
  };

  const handleSubmit = async () => {
    if (!user || loading) return;
    
    setLoading(true);

    let correctCount = 0;
    let wrongCount = 0;
    const answerDetails: { [key: string]: any } = {};

    for (const q of questions) {
      const selectedAnswer = answers[q.id] || "";
      const isCorrect = selectedAnswer === q.answer;

      if (isCorrect) correctCount++;
      else wrongCount++;

      answerDetails[q.id] = {
        question: q.title,
        selected: selectedAnswer,
        correct: q.answer,
        isCorrect,
      };
    }

    const totalScore = correctCount;

    try {
      await setDoc(
        doc(db, "responses", user.uid),
        {
          round1: {
            submittedAt: new Date(),
            score: totalScore,
            correct: correctCount,
            wrong: wrongCount,
            answers: answerDetails,
            examDuration: timerSec,
            violations: violations,
          },
          round1Submitted: true,
        },
        { merge: true }
      );

      setSubmitted(true);
      await exitFullscreen();
      
      if (soundEnabled) {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj");
        audio.play().catch(() => {});
      }

      // Show success message
      setTimeout(() => {
        navigate("/thank-you");
      }, 2000);
    } catch (error) {
      console.error("Submission failed:", error);
      setWarningMsg("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;
    setSubmitted(true);

    await setDoc(
      doc(db, "responses", user.uid),
      {
        round1Submitted: true,
        round1Rejected: true,
        rejectedAt: new Date(),
        violations: violations,
      },
      { merge: true }
    );

    await exitFullscreen();
    navigate("/rejected");
  };

  const fmtTime = (s: number) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-slate-700/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] p-8 border border-white/20 dark:border-slate-700/50"
        >
    
          <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-4">
            Successfully Submitted!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Your MCQ round has been completed and submitted.
          </p>
        </motion.div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex items-center justify-center min-h-96 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl p-8 border border-white/20 dark:border-slate-700/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No MCQ questions assigned</h3>
          <p className="text-gray-600 dark:text-gray-400">Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  if (!acceptedRules) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] p-8"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Round 1 — MCQ Test</h1>
            <p className="text-slate-600 dark:text-slate-400">Multiple Choice Question Assessment</p>
          </div>
          
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Examination Rules:</h3>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start p-3 bg-white/50 dark:bg-slate-700/50 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] border border-white/30 dark:border-slate-600/30">
                <Shield className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <span>The test will run in full-screen mode for security</span>
              </li>
              <li className="flex items-start p-3 bg-white/50 dark:bg-slate-700/50 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] border border-white/30 dark:border-slate-600/30">
                <Monitor className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <span>Do not switch tabs, minimize, or change windows</span>
              </li>
              <li className="flex items-start p-3 bg-white/50 dark:bg-slate-700/50 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] border border-white/30 dark:border-slate-600/30">
                <Clock className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <span>Answer all questions within the time limit</span>
              </li>
              <li className="flex items-start p-3 bg-white/50 dark:bg-slate-700/50 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] border border-white/30 dark:border-slate-600/30">
                <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 mt-0.5 flex-shrink-0" />
                <span>Violations will be recorded and may result in exam rejection</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 mb-6 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] border border-blue-200/30 dark:border-blue-800/30">
            <div className="flex items-center space-x-3">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Questions: {questions.length}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Complete all questions to finish</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                onChange={(e) => setAcceptedRules(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                I have read and accept the examination rules
              </span>
            </label>
            <button
              onClick={() => setAcceptedRules(true)}
              disabled={!acceptedRules}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-[0_4px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.3)] transform hover:scale-105"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] p-8 text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Play className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Ready to Begin?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            When you click "Start Exam", we will enable full-screen mode and begin the timer.
          </p>
          
          <div className="bg-gradient-to-r from-gray-50/80 to-blue-50/60 dark:from-gray-700/80 dark:to-blue-900/20 rounded-2xl p-4 mb-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] border border-gray-200/30 dark:border-gray-600/30">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{questions.length}</div>
                <div className="text-gray-600 dark:text-gray-400">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">MCQ</div>
                <div className="text-gray-600 dark:text-gray-400">Format</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-[0_4px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.3)] transform hover:scale-105 flex items-center"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Exam
            </button>
            <button
              onClick={() => setAcceptedRules(false)}
              className="px-8 py-3 bg-white/70 dark:bg-slate-700/70 border border-slate-300/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-white/90 dark:hover:bg-slate-600/90 transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
            >
              Back
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const ExamHeader = (
    <div className="sticky top-0 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-white/20 dark:border-gray-700/50 shadow-[0_4px_6px_rgba(0,0,0,0.1)]">
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
                {answeredCount} / {questions.length} answered
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
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-white/70 dark:hover:bg-gray-700/70 transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-xl text-xs font-medium transition-all duration-300 ${
              showFullscreen ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-800 dark:text-green-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]' : 'bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/50 dark:to-pink-900/50 text-red-800 dark:text-red-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]'
            }`}>
              <Monitor className="w-4 h-4" />
              <span>{showFullscreen ? 'Fullscreen ON' : 'Fullscreen OFF'}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-white/50 dark:bg-gray-700/50 rounded-full h-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-white/30 dark:border-gray-600/30">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {warningMsg && (
        <div className="bg-gradient-to-r from-yellow-50/90 to-orange-50/90 dark:from-yellow-900/20 dark:to-orange-900/20 border-b border-yellow-200/50 dark:border-yellow-800/50 backdrop-blur-sm">
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
                    await reEnterFullscreen();
                  }}
                  className="px-3 py-1 bg-gradient-to-r from-yellow-200 to-orange-200 dark:from-yellow-800 dark:to-orange-800 text-yellow-800 dark:text-yellow-200 rounded-xl text-sm hover:from-yellow-300 hover:to-orange-300 dark:hover:from-yellow-700 dark:hover:to-orange-700 transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
                >
                  Resume Fullscreen
                </button>
                <button
                  onClick={() => setWarningMsg(null)}
                  className="px-3 py-1 bg-white/70 dark:bg-gray-800/70 border border-yellow-300/50 dark:border-yellow-700/50 text-yellow-800 dark:text-yellow-200 rounded-xl text-sm hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {ExamHeader}

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/20 dark:border-slate-700/50 overflow-hidden">
          {/* Question Header */}
          <div className="p-6 border-b border-white/20 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/50 dark:to-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentQuestion.difficulty && (
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {currentQuestion.difficulty}
                    </span>
                  )}
                  {currentQuestion.tags && currentQuestion.tags.length > 0 && (
                    currentQuestion.tags.map((tag: string, i: number) => (
                      <span key={i} className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs mr-1">
                        {tag}
                      </span>
                    ))
                  )}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="p-8 bg-gradient-to-br from-white/60 to-blue-50/30 dark:from-slate-800/60 dark:to-slate-700/30 backdrop-blur-sm">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 leading-relaxed">
                {currentQuestion.title}
              </h3>

              {currentQuestion.description && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    {currentQuestion.description}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {currentQuestion.options?.map((option: string, index: number) => {
                  const isSelected = answers[currentQuestion.id] === option;
                  const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
                  
                  return (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleSelect(currentQuestion.id, option)}
                      disabled={submitted}
                      className={`w-full p-4 text-left rounded-2xl transition-all duration-300 ${
                        isSelected
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transform scale-[0.98]"
                          : "bg-white/70 dark:bg-slate-700/70 shadow-[0_4px_8px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.15)] hover:bg-white/90 dark:hover:bg-slate-600/90 border border-white/30 dark:border-slate-600/30"
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          isSelected
                            ? "bg-white/20 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                            : "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-700 text-slate-700 dark:text-slate-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                        }`}>
                          {optionLetter}
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-900 dark:text-white font-medium">
                            {option}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Navigation Footer */}
          <div className="p-6 border-t border-white/20 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/80 to-blue-50/60 dark:from-slate-700/80 dark:to-slate-600/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                {answers[currentQuestion.id] && (
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Answered
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {currentQuestionIndex > 0 && (
                  <button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
                    className="px-4 py-2 bg-white/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-white/90 dark:hover:bg-slate-600/90 transition-all duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] border border-white/30 dark:border-slate-600/30"
                  >
                    Previous
                  </button>
                )}

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-[0_4px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.3)] transform hover:scale-105"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || answeredCount === 0}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_4px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.3)] transform hover:scale-105 flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Exam
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Question Overview */}
        <div className="mt-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/20 dark:border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Question Overview</h3>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-300 ${
                    index === currentQuestionIndex
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transform scale-95"
                      : answers[questions[index].id]
                      ? "bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-800 dark:text-blue-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] hover:bg-gradient-to-r hover:from-blue-200 hover:to-indigo-200"
                      : "bg-white/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] hover:bg-white/90 dark:hover:bg-slate-600/90 border border-white/30 dark:border-slate-600/30"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"></div>
              <span className="text-slate-600 dark:text-slate-400">Current</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 border border-blue-300 dark:border-blue-700 rounded shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"></div>
              <span className="text-slate-600 dark:text-slate-400">Answered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white/70 dark:bg-slate-700/70 border border-white/30 dark:border-slate-600/30 rounded shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"></div>
              <span className="text-slate-600 dark:text-slate-400">Not Answered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCQRoundPage;
