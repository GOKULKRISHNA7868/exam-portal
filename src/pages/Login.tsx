import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, CheckSquare, Mic, Code } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, password);
      toast.success("Successfully logged in!");
      navigate("/");
    } catch (err) {
      toast.error("Invalid login credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 overflow-hidden">
      {/* Enhanced animated background */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-96 h-96 rounded-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute top-1/4 -right-20 w-80 h-80 rounded-full bg-gradient-to-r from-blue-400/20 to-cyan-400/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="pointer-events-none absolute bottom-20 left-1/4 w-72 h-72 rounded-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />

      <div className="rounded-3xl overflow-hidden flex w-full max-w-[1000px] bg-white/80 backdrop-blur-sm shadow-[20px_20px_40px_rgba(0,0,0,0.1),-20px_-20px_40px_rgba(255,255,255,0.8)] min-h-[600px] border border-white/20">
        {/* Left Panel */}
        <div className="hidden md:flex flex-col items-center justify-center w-1/2 p-12 text-center relative bg-gradient-to-br from-blue-600/10 to-purple-600/10">
          <div className="w-full max-w-xl mb-8">
            <DotLottieReact 
              src="https://lottie.host/1add37dc-5e37-495d-b85c-cc2104b7f27e/CBdY1kiUmx.lottie" 
              loop 
              autoplay 
              style={{ width: "400px", height: "300px" }} 
            />
          </div>
          
          <div className="space-y-4">
  <h1 className="text-4xl font-bold bg-gradient-to-r from-[#9eea9e] to-[#5dc55d] bg-clip-text text-transparent">
    Exam Portal
  </h1>
  <p className="text-lg text-gray-700 leading-relaxed">
    Welcome to our comprehensive examination platform. Take your assessments with confidence and track your progress.
  </p>

  <div className="flex items-center justify-center space-x-6 mt-8">
    {/* You can add buttons or links here */}
  </div>
</div>

        </div>

        {/* Right Panel - Enhanced Login Form */}
        <div className="w-full md:w-1/2 p-12 bg-white/90 backdrop-blur-sm flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
              <p className="text-gray-600">Sign in to continue your exam journey</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:bg-gray-100"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:bg-gray-100"
                  />
                </div>
              </div>

              {/* Default Password Info */}
             

              {/* Submit */}
              <button
  type="submit"
  disabled={isLoading}
  className={`w-full py-4 rounded-xl text-white font-semibold transition-all duration-300 transform ${
    isLoading
      ? "bg-gray-400 cursor-not-allowed"
      : "bg-[#9eea9e] hover:bg-[#B8FFB8] hover:scale-[1.02] hover:shadow-lg"
  }`}
>
  {isLoading ? (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Logging in...</span>
    </div>
  ) : (
    "LOG IN"
  )}
</button>

            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Need help? Contact your administrator
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
