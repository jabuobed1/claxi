import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, Lock, User, GraduationCap, BookOpen } from 'lucide-react';

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

export default function SignupPage() {
  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Signup attempt:', { name, email, password, role });
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-100 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-200 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 text-zinc-500 hover:text-black transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to home</span>
        </Link>
        <h2 className="text-center text-4xl font-black tracking-tight text-black">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-black hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl"
      >
        <div className="bg-white py-10 px-6 shadow-2xl shadow-black/5 sm:rounded-[32px] sm:px-12 border border-zinc-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                  role === 'student' 
                    ? 'border-black bg-black text-white' 
                    : 'border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <GraduationCap className={`w-8 h-8 mb-2 ${role === 'student' ? 'text-white' : 'text-zinc-400'}`} />
                <span className="text-sm font-bold">I'm a Student</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('tutor')}
                className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                  role === 'tutor' 
                    ? 'border-black bg-black text-white' 
                    : 'border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <BookOpen className={`w-8 h-8 mb-2 ${role === 'tutor' ? 'text-white' : 'text-zinc-400'}`} />
                <span className="text-sm font-bold">I'm a Tutor</span>
              </button>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-bold text-black mb-2">
                Full name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              By signing up, you agree to our{' '}
              <a href="#" className="text-black font-bold hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-black font-bold hover:underline">Privacy Policy</a>.
            </p>

            <div>
              <Button type="submit" className="w-full py-4 text-lg">
                Create Account
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
