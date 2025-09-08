import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, updateDoc, doc, getDocs, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";
import { MessageCircle, Users, Plus, Send, Edit3, Trash2, Clock, FileText, Eye, Calendar, Target } from "lucide-react";

const CommunicationRound: React.FC = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [existingTests, setExistingTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // NEW: view & edit state
  const [viewTest, setViewTest] = useState<any | null>(null);
  const [editTestId, setEditTestId] = useState<string | null>(null);

  // Fetch employees from Firestore
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const snap = await getDocs(collection(db, "employees"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEmployees(data);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);

  // Helper: fetch tests
  const fetchTests = async () => {
    try {
      const snap = await getDocs(collection(db, "COMMUNICATIONTEST"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExistingTests(data);
    } catch (error) {
      console.error("Error fetching tests:", error);
    }
  };

  // Fetch existing tests
  useEffect(() => {
    fetchTests();
  }, []);

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length > 1) {
      const updated = questions.filter((_, i) => i !== index);
      setQuestions(updated);
    }
  };

  const handleSaveTest = async () => {
    if (!title || questions.length === 0 || questions.some(q => !q.trim())) {
      alert("Please enter a title and at least one complete question");
      return;
    }

    if (selectedEmployees.length === 0) {
      alert("Please select at least one employee");
      return;
    }

    setLoading(true);
    try {
      if (editTestId) {
        // Update existing test
        await updateDoc(doc(db, "COMMUNICATIONTEST", editTestId), {
          title,
          description,
          instructions,
          questions: questions.filter(q => q.trim()),
          assigned: selectedEmployees,
          updatedAt: serverTimestamp(),
        });
        alert("Test updated successfully!");
      } else {
        // Create new test
        await addDoc(collection(db, "COMMUNICATIONTEST"), {
          title,
          description,
          instructions,
          questions: questions.filter(q => q.trim()),
          assigned: selectedEmployees,
          createdAt: serverTimestamp(),
          status: "active",
        });
        alert("Communication test created and assigned successfully!");
      }

      resetForm();
      setShowCreateForm(false);
      fetchTests();
    } catch (err) {
      console.error("Error saving test", err);
      alert("Error creating/updating test. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setInstructions("");
    setQuestions([""]);
    setSelectedEmployees([]);
    setEditTestId(null);
  };

  const handleSelectEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
  };

  // NEW: open view
  const handleView = (test: any) => setViewTest(test);

  // NEW: open edit with prefill
  const handleEdit = (test: any) => {
    setTitle(test.title || "");
    setDescription(test.description || "");
    setInstructions(test.instructions || "");
    setQuestions(test.questions || [""]);
    setSelectedEmployees(test.assigned || []);
    setEditTestId(test.id);
    setShowCreateForm(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <motion.h1 
            className="text-3xl font-bold text-gray-900 dark:text-white"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Communication Assessment
          </motion.h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Create and manage communication tests for evaluation
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => { resetForm(); setShowCreateForm(true); }}
            className="inline-flex items-center px-6 py-3 font-semibold rounded-xl
            shadow-[6px_6px_12px_rgba(0,0,0,0.15),-6px_-6px_12px_rgba(255,255,255,0.9)]
            dark:shadow-[6px_6px_12px_rgba(0,0,0,0.6),-6px_-6px_12px_rgba(255,255,255,0.05)]
            bg-[#f8f5f2] text-[#d64b4b]
            dark:bg-[#e0e0e0] dark:text-[#4da6ff]
            hover:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.8)]
            dark:hover:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.1)]
            transition-all duration-300 transform hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Test
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { title: "Total Tests", value: existingTests.length, icon: FileText, color: "blue" },
          { title: "Active Tests", value: existingTests.filter(t => t.status === "active").length, icon: Clock, color: "green" },
          { title: "Total Employees", value: employees.length, icon: Users, color: "purple" },
          { title: "Assigned Tests", value: existingTests.reduce((acc, test) => acc + (test.assigned?.length || 0), 0), icon: Target, color: "orange" },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative rounded-2xl transition-all duration-300 overflow-hidden hover:-translate-y-0.5 bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]"
          >
            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-[#f3f5fa] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.08),inset_-4px_-4px_8px_#ffffff] dark:bg-slate-700">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{stat.title}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Existing Tests */}
      <div className="rounded-2xl bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            Existing Communication Tests
          </h2>
        </div>
        
        <div className="p-6">
          {existingTests.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tests created yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first communication test to get started.</p>
              <button
                onClick={() => { resetForm(); setShowCreateForm(true); }}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Test
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {existingTests.map((test, index) => (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative rounded-2xl p-6 transition-all duration-300 overflow-hidden hover:-translate-y-0.5 bg-[#eff1f6] shadow-[8px_8px_16px_rgba(0,0,0,0.12),-8px_-8px_16px_#ffffff] dark:bg-slate-800 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)]"
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                          {test.title}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-3">{test.description || "No description provided"}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {test.status || 'active'}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                        <FileText className="w-4 h-4 mr-2" />
                        {test.questions?.length || 0} questions
                      </div>
                      
                      <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                        <Users className="w-4 h-4 mr-2" />
                        {test.assigned?.length || 0} employees assigned
                      </div>
                      
                      <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                        <Calendar className="w-4 h-4 mr-2" />
                        {test.createdAt?.toDate?.()?.toLocaleDateString() || 'Date not available'}
                      </div>
                    </div>
                    
                    <div className="mt-6 flex space-x-2">
                      <button onClick={() => handleView(test)} className="flex-1 inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-lg hover:-translate-y-0.5 transition-all bg-[#f3f5fa] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.08),inset_-3px_-3px_6px_#ffffff] dark:bg-slate-700">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button onClick={() => handleEdit(test)} className="flex-1 inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-lg hover:-translate-y-0.5 transition-all bg-[#f3f5fa] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.08),inset_-3px_-3px_6px_#ffffff] dark:bg-slate-700">
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Test Modal */}
      {viewTest && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  View Communication Test
                </h2>
                <button
                  onClick={() => setViewTest(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{viewTest.title}</h3>
                <p className="mt-1 text-gray-600 dark:text-gray-400">{viewTest.description || 'No description provided'}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Instructions</h4>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{viewTest.instructions || '—'}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Questions</h4>
                <ol className="list-decimal pl-5 space-y-2 text-gray-900 dark:text-gray-100">
                  {(viewTest.questions || []).map((q: string, i: number) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Assigned Employees</h4>
                <div className="flex flex-wrap gap-2">
                  {(viewTest.assigned || []).length === 0 ? (
                    <span className="text-gray-600 dark:text-gray-400">None</span>
                  ) : (
                    (viewTest.assigned || []).map((id: string) => {
                      const emp = employees.find((e) => e.id === id);
                      const label = emp?.name || id;
                      return (
                        <span key={id} className="px-3 py-1 rounded-full bg-[#f3f5fa] dark:bg-slate-700 text-sm text-gray-800 dark:text-gray-200">
                          {label}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Create / Edit Test Modal (same design) */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  {editTestId ? 'Edit Communication Test' : 'Create Communication Test'}
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Test Title *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter test title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Brief description of the test"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Instructions for Candidates
                  </label>
                  <textarea
                    placeholder="Detailed instructions for taking the test"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Questions *
                  </label>
                  <button
                    onClick={handleAddQuestion}
                    className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Question
                  </button>
                </div>
                
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder={`Question ${index + 1}`}
                          value={question}
                          onChange={(e) => handleQuestionChange(index, e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      {questions.length > 1 && (
                        <button
                          onClick={() => handleRemoveQuestion(index)}
                          className="p-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee Assignment */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Assign to Employees *
                  </label>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedEmployees.length === employees.length ? "Unselect All" : "Select All"}
                  </button>
                </div>
                
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    {employees.map((emp) => (
                      <label key={emp.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => handleSelectEmployee(emp.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                            {emp.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{emp.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{emp.email}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {selectedEmployees.length} of {employees.length} employees selected
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTest}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      {editTestId ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {editTestId ? 'Update Test' : 'Create & Assign Test'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default CommunicationRound;
