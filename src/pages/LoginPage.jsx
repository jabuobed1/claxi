import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, Lock } from 'lucide-react';

function Button({ type = 'button', children, className = '', ...props }) {
  return (
    <button 
      type={type}
      className={`w-full py-3 px-4 bg-black text-white font-bold rounded-2xl hover:bg-zinc-900 transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login attempt:', { email, password });
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-100 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-200 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 text-zinc-500 hover:text-black transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to home</span>
        </Link>
        <h2 className="text-center text-4xl font-black tracking-tight text-black">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Don't have an account?{' '}
          <Link to="/signup" className="font-bold text-black hover:underline">
            Sign up for free
          </Link>
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-10 px-6 shadow-2xl shadow-black/5 sm:rounded-[32px] sm:px-12 border border-zinc-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-black mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-black mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-black focus:ring-black border-zinc-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-zinc-500 cursor-pointer">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-bold text-black hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full py-4 text-lg">
                Sign in
              </Button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-zinc-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <button className="w-full inline-flex justify-center py-3 px-4 border border-zinc-200 rounded-2xl bg-white text-sm font-bold text-black hover:bg-zinc-50 transition-colors">
                Google
              </button>
              <button className="w-full inline-flex justify-center py-3 px-4 border border-zinc-200 rounded-2xl bg-white text-sm font-bold text-black hover:bg-zinc-50 transition-colors">
                Apple
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
