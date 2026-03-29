import { motion } from 'motion/react';
import { ArrowRight, Calendar, Globe, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

function CTAButton({ children, variant = 'primary', ...props }) {
  const styles =
    variant === 'primary'
      ? 'bg-black text-white hover:bg-zinc-800'
      : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100';

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold transition ${styles}`}
      {...props}
    >
      {children}
    </button>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-500">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-black text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </article>
  );
}

export default function LandingPage() {
  return (
    <MainLayout>
      <div className="bg-[#f4f5f7] pb-20">
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[36px] border border-zinc-200 bg-white p-8 shadow-sm md:p-12"
          >
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400">Student Portal</p>
            <h1 className="mt-4 text-5xl font-black leading-[0.95] text-zinc-900 md:text-7xl">
              Need a quick <span className="text-indigo-500">Math</span> session?
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-500">
              Find verified tutors who are ready to help with your assignments right now.
              Fast requests, live sessions, and real-time updates in one place.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <CTAButton>
                  <Zap className="mr-2 h-4 w-4" />
                  Request Class Now
                </CTAButton>
              </Link>
              <Link to="/signup">
                <CTAButton variant="secondary">
                  Become a Tutor
                  <ArrowRight className="ml-2 h-4 w-4" />
                </CTAButton>
              </Link>
            </div>

            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="underline">Terms of Service</Link> and{' '}
              <Link to="/privacy-policy" className="underline">Privacy Policy</Link>.
            </p>

            <div className="mt-10 rounded-[28px] border border-zinc-200 bg-zinc-50 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="h-4 w-4 rounded-full bg-amber-400 shadow" />
                <div className="h-5 w-5 rounded-full bg-indigo-500 shadow" />
                <div className="h-4 w-4 rounded-full bg-emerald-500 shadow" />
              </div>
              <p className="mt-6 text-sm text-zinc-500">Live tutor availability map preview</p>
            </div>
          </motion.div>
        </section>

        <section id="features" className="mx-auto mt-8 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <FeatureCard icon={Zap} title="Instant Requests" description="Submit a topic in seconds and notify online tutors immediately." />
          <FeatureCard icon={ShieldCheck} title="Verified Tutors" description="Tutor profile checks and qualification thresholds for safer matching." />
          <FeatureCard icon={Globe} title="Learn Anywhere" description="Join sessions from mobile or desktop with live status tracking." />
          <FeatureCard icon={Calendar} title="Flexible Sessions" description="Start now or schedule around your day with minimal setup." />
        </section>

        <section id="how-it-works" className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <h2 className="text-3xl font-black text-zinc-900">How Claxi Works</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { step: '01', title: 'Complete profile', text: 'Set up your student or tutor details once.' },
                { step: '02', title: 'Request or accept', text: 'Students request help, tutors get live offers.' },
                { step: '03', title: 'Join and learn', text: 'Start session, track time, and complete payment flow.' },
              ].map((item) => (
                <article key={item.step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">{item.step}</p>
                  <h3 className="mt-2 text-xl font-black text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-500">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
