import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import { Trophy, User, CheckCircle, XCircle, Code, FileText, Eye, Download, Search, BarChart3 } from "lucide-react";

interface User {
  uid: string;
  name: string;
  email: string;
  round1: { correct: number; wrong: number; score: number; answers?: any };
  round2: any[];
  r2Total: number;
  r2Passed: number;
  r2Percentage: number;
  totalScore: number;
  overallPercentage: number;
}

const ViewScores = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "totalScore" | "overallPercentage">("totalScore");
  const [filterByRound, setFilterByRound] = useState<"all" | "round1" | "round2">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const resSnap = await getDocs(collection(db, "responses"));
        const list: User[] = [];

        for (const res of resSnap.docs) {
          const uid = res.id;
          const data = res.data();

          // Prefer canonical user profile from `users` collection (doc id == auth UID)
          let displayName = "Unknown";
          let displayEmail = "unknown@example.com";

          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            const u = userSnap.data() as any;
            displayName = u.fullName || u.name || u.email || "Unknown";
            displayEmail = u.email || displayEmail;
          } else {
            // Fallback: try employees doc with same id (legacy)
            const empSnap = await getDoc(doc(db, "employees", uid));
            if (empSnap.exists()) {
              const emp = empSnap.data() as any;
              displayName = emp.name || displayName;
              displayEmail = emp.email || displayEmail;
            }
          }

          // Round1
          const round1 = data.round1 || {};
          const r1Score = round1.score || 0;
          const r1Correct = round1.correct || 0;
          const r1Wrong = round1.wrong || 0;

          // Round2 (subcollection)
          const round2Snap = await getDocs(
            collection(db, "responses", uid, "round2")
          );
          let round2: any[] = [];
          round2Snap.forEach((d) => {
            round2.push({ id: d.id, ...d.data() });
          });

          // total passed across problems
          const r2Passed = round2.reduce((sum, r) => sum + (r.passed || 0), 0);
          const r2Total = round2.reduce((sum, r) => sum + (r.total || 0), 0);
          const r2Percentage = r2Total > 0 ? Math.round((r2Passed / r2Total) * 100) : 0;

          // total score (Round1 + passed test cases from Round2)
          const totalScore = r1Score + r2Passed;

          // overall percentage (based on MCQ + coding combined)
          const totalPossible = r1Correct + r1Wrong + r2Total;
          const overallPercentage = totalPossible > 0
            ? Math.round(((r1Score + r2Passed) / totalPossible) * 100)
            : 0;

          list.push({
            uid,
            name: displayName,
            email: displayEmail,
            round1: { ...round1 },
            round2,
            totalScore,
            r2Passed,
            r2Total,
            r2Percentage,
            overallPercentage,
          });
        }

        setUsers(list);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      if (filterByRound === "round1") return matchesSearch && user.round1.score > 0;
      if (filterByRound === "round2") return matchesSearch && user.round2.length > 0;
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "totalScore":
          return b.totalScore - a.totalScore;
        case "overallPercentage":
          return b.overallPercentage - a.overallPercentage;
        default:
          return 0;
      }
    });

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 90) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-200" };
    if (percentage >= 75) return { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-200" };
    if (percentage >= 60) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    return { label: "Needs Improvement", color: "bg-red-100 text-red-800 border-red-200" };
  };

  const topPerformers = filteredAndSortedUsers.slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading scores...</p>
        </div>
      </div>
    );
  }

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
            Exam Scores 
          </motion.h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            
          </p>
        </div>

        
      </div>

      {/* Top Performers */}
      <div className="relative rounded-2xl p-6 bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
          <Trophy className="w-6 h-6 text-blue-600 mr-2" />
          Top Performers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topPerformers.map((user, index) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold bg-[#f3f5fa] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.08),inset_-3px_-3px_6px_#ffffff] dark:bg-slate-700`}>
                  {index + 1}
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getPerformanceBadge(user.overallPercentage).color
                  }`}>
                  {user.overallPercentage}%
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-white">{user.name}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{user.email}</p>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {user.totalScore} pts
              </div>
              <div className="absolute -right-3 -top-3 w-10 h-10 bg-[#f3f5fa] rounded-xl rotate-12" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="rounded-2xl p-6 bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f3f5fa] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:bg-slate-700 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-3 rounded-xl bg-[#f3f5fa] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:bg-slate-700 dark:text-white focus:outline-none"
            >
              <option value="totalScore">Sort by Total Score</option>
              <option value="overallPercentage">Sort by Percentage</option>
              <option value="name">Sort by Name</option>
            </select>

            <select
              value={filterByRound}
              onChange={(e) => setFilterByRound(e.target.value as any)}
              className="px-4 py-3 rounded-xl bg-[#f3f5fa] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:bg-slate-700 dark:text-white focus:outline-none"
            >
              <option value="all">All Rounds</option>
              <option value="round1">Round 1 Only</option>
              <option value="round2">Round 2 Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scores Table */}
      <div className="rounded-2xl bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] overflow-hidden">
        <div className="p-6 border-b border-transparent">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-blue-600" />
            Detailed Results ({filteredAndSortedUsers.length} students)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f3f5fa] dark:bg-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Round 1 (MCQ)
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Round 2 (Coding)
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Total Score
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredAndSortedUsers.map((user, index) => {
                const badge = getPerformanceBadge(user.overallPercentage);
                return (
                  <motion.tr
                    key={user.uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f7f9fc] dark:hover:bg-slate-700"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-[#f3f5fa] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.08),inset_-3px_-3px_6px_#ffffff] dark:bg-slate-700 text-slate-700 dark:text-white flex items-center justify-center font-semibold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {user.name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center space-x-4">
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {user.round1.correct}
                          </span>
                          <span className="flex items-center text-red-600">
                            <XCircle className="w-4 h-4 mr-1" />
                            {user.round1.wrong}
                          </span>
                        </div>
                        <div className="text-sm font-semibold">Score: {user.round1.score}</div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      {user.r2Total > 0 ? (
                        <div className="space-y-1">
                          <div className="text-sm">
                            {user.r2Passed}/{user.r2Total} test cases
                          </div>
                          <div className="text-sm font-semibold">
                            {user.r2Percentage}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">Not attempted</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="text-xl font-bold text-slate-800 dark:text-blue-400">
                        {user.totalScore}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <div className="text-lg font-bold">
                          {user.overallPercentage}%
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="inline-flex items-center px-3 py-2 rounded-xl bg-[#eff1f6] shadow-[6px_6px_12px_rgba(0,0,0,0.12),-6px_-6px_12px_#ffffff] dark:bg-slate-700 hover:-translate-y-0.5 transition-all"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {filteredAndSortedUsers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No students found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedUser && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedUser.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Overall Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedUser.totalScore}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Score</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedUser.overallPercentage}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Overall Performance</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {getPerformanceBadge(selectedUser.overallPercentage).label}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Grade</div>
                </div>
              </div>

              {/* Round 1 Details */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  Round 1 (MCQ) - Detailed Answers
                </h4>

                {selectedUser.round1.answers ? (
                  <div className="space-y-3">
                    {Object.entries(selectedUser.round1.answers).map(([qid, ans]: any) => (
                      <div key={qid} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p className="font-medium text-gray-900 dark:text-white mb-2">{ans.question}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Your Answer: </span>
                            <span className={ans.isCorrect ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              {ans.selected}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Correct Answer: </span>
                            <span className="font-semibold text-gray-900 dark:text-white">{ans.correct}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No detailed answers available.</p>
                )}
              </div>

              {/* Round 2 Details */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Code className="w-5 h-5 mr-2 text-green-600" />
                  Round 2 (Coding) - Solutions
                </h4>

                {selectedUser.round2.length > 0 ? (
                  <div className="space-y-4">
                    {selectedUser.round2.map((solution: any) => (
                      <div key={solution.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900 dark:text-white">
                            Problem: {solution.problemId}
                          </h5>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${solution.result === "Passed"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                            }`}>
                            {solution.result}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Test Cases: </span>
                            <span className="font-semibold">{solution.passed || 0}/{solution.total || 0}</span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">
                              ({solution.percentage || 0}%)
                            </span>
                          </div>

                          <details className="mt-3">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                              View Code Solution
                            </summary>
                            <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs">
                              {solution.code}
                            </pre>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No coding solutions submitted.</p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default ViewScores;
