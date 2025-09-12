import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import { BookOpen, CheckSquare, Code, Users, Pencil, Trash2, Search, Info, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

type Question = any;

const QuestionBank = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"mcq" | "code">("mcq");
  const [search, setSearch] = useState("");
  const [assigneeMap, setAssigneeMap] = useState<Record<string, { name: string; email: string }>>({});
  const [showAllAssigneesMap, setShowAllAssigneesMap] = useState<Record<string, boolean>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const qSnap = await getDocs(collection(db, "questions"));
        const list = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Question[];
        setQuestions(list);

        // Preload assignees: flatten all assignedTo UIDs and map to names/emails from users collection
        const allUids = new Set<string>();
        list.forEach((q: any) => {
          (Array.isArray(q.assignedTo) ? q.assignedTo : []).forEach((u: string) => allUids.add(u));
        });
        const map: Record<string, { name: string; email: string }> = {};
        await Promise.all(
          Array.from(allUids).map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              if (userSnap.exists()) {
                const u: any = userSnap.data();
                map[uid] = { name: u.fullName || u.name || u.email || "Unknown", email: u.email || "unknown@example.com" };
              } else {
                // fallback to employees
                const empSnap = await getDoc(doc(db, "employees", uid));
                if (empSnap.exists()) {
                  const e: any = empSnap.data();
                  map[uid] = { name: e.name || "Unknown", email: e.email || "unknown@example.com" };
                }
              }
            } catch {}
          })
        );
        setAssigneeMap(map);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load questions");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return questions
      .filter((q: any) => q.type === tab)
      .filter((q: any) => {
        const hay = `${q.title || ""} ${q.description || ""} ${(q.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(search.toLowerCase());
      });
  }, [questions, tab, search]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    try {
      setActionLoadingId(id);
      await deleteDoc(doc(db, "questions", id));
      setQuestions((prev) => prev.filter((q: any) => q.id !== id));
      toast.success("Question deleted");
    } catch (e: any) {
      console.error("Delete failed", e);
      if (e?.code === 'permission-denied') {
        toast.error("Permission denied. Update your Firestore rules to allow HR to delete questions.");
      } else {
        toast.error(e?.message || "Failed to delete");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onEditTitle = async (q: any) => {
    const next = prompt("Update title", q.title || "");
    if (next == null) return;
    try {
      setActionLoadingId(q.id);
      await updateDoc(doc(db, "questions", q.id), { title: next });
      setQuestions((prev) => prev.map((it: any) => (it.id === q.id ? { ...it, title: next } : it)));
      toast.success("Updated");
    } catch (e: any) {
      console.error("Update failed", e);
      if (e?.code === 'permission-denied') {
        toast.error("Permission denied. Update your Firestore rules to allow HR to edit questions.");
      } else {
        toast.error(e?.message || "Failed to update");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderAssignees = (q: any) => {
    const assigned: string[] = Array.isArray(q.assignedTo) ? q.assignedTo : [];
    const count = assigned.length;
    if (count === 0) return <span className="text-slate-500">Unassigned (global)</span>;
    const showAll = !!showAllAssigneesMap[q.id];
    const toShow = showAll ? assigned : assigned.slice(0, 5);
    return (
      <div className="space-y-1">
        <div className="text-sm">Assigned: {count}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {toShow.map((uid) => {
            const info = assigneeMap[uid];
            return (
              <div key={uid} className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {info ? `${info.name} (${info.email})` : uid}
              </div>
            );
          })}
        </div>
        {count > 5 && (
          <button
            onClick={() => setShowAllAssigneesMap((m) => ({ ...m, [q.id]: !showAll }))}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {showAll ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    );
  };

  const QuestionCard = ({ q }: { q: any }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6 bg-[#eff1f6] text-slate-800 shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:text-slate-100 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] hover:shadow-[12px_12px_24px_rgba(0,0,0,0.15),-12px_-12px_24px_#ffffff] dark:hover:shadow-[12px_12px_24px_rgba(0,0,0,0.7),-12px_-12px_24px_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#f3f5fa] dark:bg-slate-700/70 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.05)]">
            {q.type === "mcq" ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Code className="w-5 h-5 text-green-600" />}
          </div>
          <div>
            <h3 className="font-semibold">{q.title || "Untitled"}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 max-w-2xl">{q.description}</p>
            {q.tags && q.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {q.tags.map((t: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-white/70 dark:bg-slate-700/70 border border-white/30 dark:border-slate-600/30">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" disabled={actionLoadingId === q.id} onClick={(e) => { e.stopPropagation(); onEditTitle(q); }} className={`px-3 py-2 rounded-xl bg-[#f3f5fa] dark:bg-slate-700/70 hover:bg-[#e8ebf0] dark:hover:bg-slate-600/90 text-slate-700 dark:text-slate-300 text-sm flex items-center transition-all duration-300 shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.15),-6px_-6px_12px_#ffffff] dark:hover:shadow-[6px_6px_12px_rgba(0,0,0,0.4),-6px_-6px_12px_rgba(255,255,255,0.05)] ${actionLoadingId === q.id ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </button>
          <button type="button" disabled={actionLoadingId === q.id} onClick={(e) => { e.stopPropagation(); onDelete(q.id); }} className={`px-3 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 text-sm flex items-center transition-all duration-300 shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.15),-6px_-6px_12px_#ffffff] dark:hover:shadow-[6px_6px_12px_rgba(0,0,0,0.4),-6px_-6px_12px_rgba(255,255,255,0.05)] ${actionLoadingId === q.id ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#f3f5fa] dark:bg-slate-700/70 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-600/30">
          <div className="text-xs text-slate-500 flex items-center gap-1 mb-2"><Info className="w-3 h-3" /> Meta</div>
          <div className="space-y-1 text-sm">
            <div>Difficulty: <span className="font-medium">{q.difficulty || "-"}</span></div>
            <div>Created: <span className="font-medium">{q.createdAt?.toDate?.()?.toLocaleString?.() || "-"}</span></div>
            {q.type === "code" && (
              <div>Time Limit: <span className="font-medium">{q.timeLimit || "-"}s</span>, Memory: <span className="font-medium">{q.memoryLimit || "-"}MB</span></div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#f3f5fa] dark:bg-slate-700/70 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-600/30">
          <div className="text-xs text-slate-500 flex items-center gap-1 mb-2"><Users className="w-3 h-3" /> Assignees</div>
          <div className="mt-1">{renderAssignees(q)}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#f3f5fa] dark:bg-slate-700/70 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-600/30">
          {q.type === "mcq" ? (
            <div className="text-sm space-y-2">
              <div className="text-xs text-slate-500 mb-2">Options</div>
              {(q.options || []).map((opt: string, i: number) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-[#f3f5fa] dark:bg-slate-600/60 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-500/40 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">{opt}</span>
                  {q.answer === opt && <span className="ml-2 text-green-600 text-xs font-medium">✓ Correct</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm space-y-2">
              <div className="text-xs text-slate-500 mb-2">Problem Statement</div>
              <div className="max-h-24 overflow-auto whitespace-pre-wrap bg-[#f3f5fa] dark:bg-slate-600/60 rounded-lg p-3 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-500/40 text-slate-700 dark:text-slate-300">
                {q.problemStatement || "-"}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"><ChevronDown className="w-4 h-4" /> View Examples/Test Cases</summary>
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-slate-500 font-medium">Examples</div>
                  {(q.examples || []).map((ex: any, i: number) => (
                    <div key={i} className="rounded-lg bg-[#f3f5fa] dark:bg-slate-600/60 p-3 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-500/40">
                      <div className="text-slate-700 dark:text-slate-300">Input: <span className="font-mono text-slate-900 dark:text-white">{ex.input}</span></div>
                      <div className="text-slate-700 dark:text-slate-300">Output: <span className="font-mono text-slate-900 dark:text-white">{ex.output}</span></div>
                    </div>
                  ))}
                  <div className="text-xs text-slate-500 font-medium">Test Cases</div>
                  {(q.testCases || []).map((tc: any, i: number) => (
                    <div key={i} className="rounded-lg bg-[#f3f5fa] dark:bg-slate-600/60 p-3 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border border-white/30 dark:border-slate-500/40">
                      <div className="text-slate-700 dark:text-slate-300">Input: <span className="font-mono text-slate-900 dark:text-white">{tc.input}</span></div>
                      <div className="text-slate-700 dark:text-slate-300">Expected: <span className="font-mono text-slate-900 dark:text-white">{tc.expectedOutput}</span></div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Raw data section removed as requested */}
    </motion.div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <motion.h1 
            className="text-3xl font-bold text-slate-900 dark:text-white"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Question Bank
          </motion.h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage and organize your question collection
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-xl overflow-hidden shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)]">
          <button
            onClick={() => setTab("mcq")}
            className={`px-4 py-2 text-sm transition-all duration-300 ${
              tab === "mcq" 
                ? "bg-blue-600 text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]" 
                : "bg-[#f3f5fa] dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-[#e8ebf0] dark:hover:bg-slate-600/90"
            }`}
          >
            MCQ
          </button>
          <button
            onClick={() => setTab("code")}
            className={`px-4 py-2 text-sm transition-all duration-300 ${
              tab === "code" 
                ? "bg-blue-600 text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]" 
                : "bg-[#f3f5fa] dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-[#e8ebf0] dark:hover:bg-slate-600/90"
            }`}
          >
            Coding
          </button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f3f5fa] dark:bg-slate-700/70 border border-white/30 dark:border-slate-600/30 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] focus:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.15),inset_-4px_-4px_8px_#ffffff] dark:focus:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3),inset_-4px_-4px_8px_rgba(255,255,255,0.05)] focus:outline-none"
          />
        </div>
      </div>

      {/* Questions Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-60">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading questions...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((q: any) => (
            <QuestionCard key={q.id} q={q} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="bg-[#eff1f6] dark:bg-slate-800 rounded-2xl p-8 shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]">
                <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No questions found</h3>
                <p className="text-slate-600 dark:text-slate-400">Try adjusting your search criteria or create new questions.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionBank;


