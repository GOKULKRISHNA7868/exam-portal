import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

import {
  LayoutDashboard,
  Users,
  CheckSquare,
  LogOut,
  Menu,
  X,
  MessageSquareTextIcon,
  Bell,
  Code,
  Trophy,
  Mic,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";

function Layout() {
  const { signOut, user, userRole } = useAuthStore();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Violation tracking for non-admin users
  const violationCountRef = useRef<number>(0);
  const lastVisibilityChangeRef = useRef<number>(0);
  const fullScreenRequestedRef = useRef<boolean>(false);

  const isActive = (path: string) => location.pathname === path;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleNotifications = () => setShowNotifications(!showNotifications);

  // Auto-collapse sidebar when on coding round
  useEffect(() => {
    if (location.pathname === '/CodingRound') {
      setIsCollapsed(true);
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("receiverId", "==", user.uid),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const newNotes: string[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          newNotes.push(`${data.senderName || "Unknown"}: ${data.message}`);
          const sound = new Audio(
            "https://www.myinstants.com/media/sounds/bleep.mp3"
          );
          sound.play().catch(() => {});
        }
      });
      setNotifications((prev) => [...newNotes, ...prev]);
    });
    return () => unsub();
  }, [user?.uid]);

  // Request fullscreen and set up proctoring for regular users
  useEffect(() => {
    if (!user) return;
    if (userRole !== 'user') return; // Only enforce for non-admin users

    // If there is a past lockout, ensure it is respected at runtime as well
    const lockoutUntilRaw = localStorage.getItem('exam_lockout_until');
    if (lockoutUntilRaw) {
      const lockoutUntil = parseInt(lockoutUntilRaw, 10);
      if (!Number.isNaN(lockoutUntil) && Date.now() < lockoutUntil) {
        // Immediately sign out and block access
        import('react-hot-toast').then(({ default: toast }) => {
          toast.error('Access locked due to prior violations. Try later.');
        });
        signOut();
        return;
      }
    }

    const requestFullscreenIfNeeded = async () => {
      try {
        if (document.fullscreenElement) return;
        const elem = document.documentElement as any;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          fullScreenRequestedRef.current = true;
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
          fullScreenRequestedRef.current = true;
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
          fullScreenRequestedRef.current = true;
        }
      } catch {
        // ignore
      }
    };

    // Initiate fullscreen on mount (best-effort; some browsers require user gesture)
    requestFullscreenIfNeeded();

    let violationCount = 0;
    violationCountRef.current = 0;

    const handleViolation = (reason: string) => {
      violationCount += 1;
      violationCountRef.current = violationCount;
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error(`Screen change detected (${reason}). Attempt ${violationCount}/5`);
      });

      if (violationCount >= 5) {
        const tenMinutesMs = 10 * 60 * 1000;
        const until = Date.now() + tenMinutesMs;
        localStorage.setItem('exam_lockout_until', String(until));
        import('react-hot-toast').then(({ default: toast }) => {
          toast.error('Too many violations. Locked for 10 minutes.');
        });
        // Optional: exit fullscreen
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        signOut();
      }
    };

    const onVisibilityChange = () => {
      const now = Date.now();
      // Debounce rapid duplicate events
      if (now - lastVisibilityChangeRef.current < 500) return;
      lastVisibilityChangeRef.current = now;
      if (document.hidden) {
        handleViolation('tab hidden');
      }
    };

    const onBlur = () => {
      handleViolation('window blur');
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && fullScreenRequestedRef.current) {
        handleViolation('exited fullscreen');
        // Try re-entering fullscreen
        requestFullscreenIfNeeded();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [user, userRole, signOut]);

  // Define all navigation items
  const allNavigationItems = [
    {
      path: "/",
      icon: LayoutDashboard,
      label: "Dashboard",
      roles: ['hr'] // Only HR can see Dashboard
    },
    {
      path: "/ViewScores",
      icon: Trophy,
      label: "View Scores",
      roles: ['hr'] // Only HR can see View Scores
    },
    {
      path: "/questions",
      icon: CheckSquare,
      label: "Question Bank",
      roles: ['hr']
    },
    {
      path: "/MCQRound",
      icon: CheckSquare,
      label: "MCQ Round",
      roles: ['hr', 'user'] // Both HR and users can see MCQ Round
    },
    {
      path: "/users",
      icon: Users,
      label: "Users",
      roles: ['hr'] // Only HR can see Users
    },
    {
      path: "/CommunicationRound",
      icon: MessageSquareTextIcon,
      label: "Communication Round",
      roles: ['hr'] // Only HR can see Communication Round
    },
    {
      path: "/Takecomm",
      icon: Mic,
      label: "Take Communication",
      roles: ['hr', 'user'] // Both HR and users can see Take Communication
    },
    {
      path: "/CodingRound",
      icon: Code,
      label: "Coding Round",
      roles: ['hr', 'user'] // Both HR and users can see Coding Round
    },
  ];

  // Filter navigation items based on user role
  const navigationItems = allNavigationItems.filter(item => 
    item.roles.includes(userRole)
  );

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-3 rounded-xl bg-white dark:bg-slate-800 shadow-lg md:hidden transition-all duration-300 hover:scale-105 border border-slate-200 dark:border-slate-700"
      >
        {isSidebarOpen ? (
          <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        ) : (
          <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 transition-all duration-500 ease-in-out bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col shadow-2xl ${
          isCollapsed ? "w-20" : "w-80"
        } rounded-3xl m-4 md:m-6 overflow-hidden`}
      >
        {/* Header */}
        <div className="h-24 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              
              <div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-white">Exam</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400"> Portal</p>
              </div>
            </div>
          )}

          

          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <>
                <button 
                  onClick={toggleNotifications} 
                  className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center animate-pulse">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>

                {/* <button
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-300"
                  title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                >
                  {theme === "light" ? (
                    <Moon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  ) : (
                    <Sun className="h-5 w-5 text-blue-400" />
                  )}
                </button> */}
              </>
            )}

            <button
              onClick={toggleCollapse}
              className="hidden md:block p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {showNotifications && !isCollapsed && (
          <div className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 max-h-48 overflow-y-auto animate-slideDown">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Notifications</h3>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No new notifications</p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((note, i) => (
                    <div key={i} className="p-3 bg-white dark:bg-slate-600 rounded-xl text-sm border border-slate-200 dark:border-slate-500 shadow-sm hover:shadow-md transition-shadow">
                      {note}
                    </div>
                  ))}
                  {notifications.length > 5 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">
                      +{notifications.length - 5} more notifications
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-auto px-3 py-5">
          <div className="space-y-1">
          {navigationItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              onClick={closeSidebar}
              className={`group relative flex items-center ${isCollapsed ? "justify-center" : "justify-start"} px-3 py-3 rounded-2xl transition-all duration-300 ease-in-out ${
                isActive(path)
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title={isCollapsed ? label : ""}
            >
              {/* Active pill background */}
              <span className={`absolute inset-0 scale-95 rounded-2xl transition-all duration-300 ${
                isActive(path)
                  ? "bg-slate-100 dark:bg-slate-700 shadow-inner"
                  : "opacity-0 group-hover:opacity-100 group-hover:bg-slate-100 dark:group-hover:bg-slate-700"
              }`} />

              <div className={`relative z-10 flex items-center ${isCollapsed ? "" : "gap-3"}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  isActive(path) ? "bg-slate-200 dark:bg-slate-600" : "bg-transparent"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <span className={`font-medium transition-colors ${isActive(path) ? "" : ""}`}>{label}</span>
                )}
              </div>
            </Link>
          ))}
          </div>
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-5 bg-slate-50 dark:bg-slate-800/50">
          {!isCollapsed ? (
            <>
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Signed in</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-300 hover:scale-[1.02] border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold text-sm mx-auto">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                className="w-full p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-300 flex items-center justify-center"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 max-w-full">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
