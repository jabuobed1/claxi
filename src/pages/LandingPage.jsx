import { motion } from 'motion/react';
import { Zap, ShieldCheck, Globe, Calendar, ArrowRight } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { Link } from 'react-router-dom';

function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '',
  ...props 
}) {
  const baseStyles = 'font-bold rounded-lg transition-all duration-200 inline-flex items-center justify-center';
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  const variantStyles = {
    primary: 'bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/30 hover:shadow-lg hover:shadow-brand/40',
    secondary: 'bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 shadow-md hover:shadow-lg dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-white dark:border-zinc-700',
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 hover:border-brand/30 dark:hover:border-brand/20 transition-all duration-300 group">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-6 group-hover:bg-brand/20 transition-colors">
        <div className="text-brand">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative text-center"
    >
      <div className="mb-6 flex justify-center">
        <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center border-2 border-brand/20">
          <span className="text-3xl font-black text-brand">{number}</span>
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-48">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px] opacity-50 dark:opacity-20" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-light/10 rounded-full blur-[100px] opacity-50 dark:opacity-20" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest uppercase bg-brand/10 text-brand-dark dark:text-brand-light rounded-full">
              The Future of Learning
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-zinc-900 dark:text-white mb-8 leading-[0.9]">
              Get a Tutor <br />
              <span className="text-brand">Anytime, Anywhere.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-500 dark:text-zinc-400 mb-12 leading-relaxed">
              Claxi connects you with world-class tutors instantly. Request a class, 
              get accepted, and start learning online in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Request a Class
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Become a Tutor
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="underline">Terms of Service</Link> and{' '}
              <Link to="/privacy-policy" className="underline">Privacy Policy</Link>.
            </p>
          </motion.div>

          {/* Hero Image/Graphic Placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="aspect-[16/9] rounded-[40px] bg-zinc-900 dark:bg-zinc-950 overflow-hidden shadow-2xl shadow-brand/10 border border-zinc-800">
              <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-brand/20 backdrop-blur-md flex items-center justify-center mx-auto mb-6">
                    <Zap className="text-brand w-10 h-10 fill-brand" />
                  </div>
                  <p className="text-zinc-400 font-mono text-sm tracking-widest uppercase">Platform Preview</p>
                </div>
              </div>
            </div>
            {/* Floating UI Elements */}
            <div className="absolute -top-10 -right-10 hidden lg:block">
              <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                  <ShieldCheck className="text-brand w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Verified Tutors</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">100% Background Checked</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6 text-zinc-900 dark:text-zinc-50">Built for Modern Learning</h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg">
              We've reimagined the tutoring experience to be faster, safer, and more flexible than ever.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Zap className="w-6 h-6" />}
              title="Instant Requests"
              description="Need help right now? Request a class and get matched with a tutor in seconds."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Verified Tutors"
              description="Every tutor on Claxi goes through a rigorous verification process and background check."
            />
            <FeatureCard 
              icon={<Globe className="w-6 h-6" />}
              title="Learn Anywhere"
              description="Our high-end online classroom works on any device, anywhere in the world."
            />
            <FeatureCard 
              icon={<Calendar className="w-6 h-6" />}
              title="Flexible Scheduling"
              description="Book classes for right now or schedule them for later. It's entirely up to you."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6 text-zinc-900 dark:text-zinc-50">How Claxi Works</h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg">
              Three simple steps to start your learning journey.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-24 left-0 w-full h-px bg-zinc-200 dark:bg-zinc-800 -z-10" />
            
            <StepCard 
              number="01"
              title="Request a Class"
              description="Choose your subject, level, and duration. Post your request to the Claxi network."
            />
            <StepCard 
              number="02"
              title="Tutor Accepts"
              description="Expert tutors see your request and accept instantly. You'll get a notification immediately."
            />
            <StepCard 
              number="03"
              title="Start Learning"
              description="Jump into our integrated online classroom and start your session right away."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative p-12 md:p-24 rounded-[48px] bg-brand overflow-hidden text-center">
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-dark rounded-full blur-[120px] -mr-48 -mt-48 opacity-50" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-light rounded-full blur-[120px] -ml-48 -mb-48 opacity-50" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-8">
                Ready to master <br />
                any subject?
              </h2>
              <p className="text-emerald-50 max-w-xl mx-auto text-lg mb-12">
                Join thousands of students and tutors already using Claxi to transform online education.
              </p>
              <Link to="/signup">
                <Button variant="secondary" size="lg" className="group">
                  Get Started Now
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
