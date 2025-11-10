'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/src/store/auth';
import { 
  Activity, 
  Zap, 
  Shield, 
  LayoutDashboard, 
  Users, 
  Bell, 
  TrendingUp,
  Puzzle,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const features = [
    {
      icon: <Activity className="h-8 w-8" />,
      title: 'Real-Time Monitoring',
      description: 'Track your portals and metrics as they happen with WebSocket-powered live updates',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: 'Secure Access',
      description: 'Enterprise-grade authentication with OAuth support and role-based access control',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <LayoutDashboard className="h-8 w-8" />,
      title: 'Custom Dashboards',
      description: 'Build beautiful portals with drag-and-drop widgets and customizable layouts',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <Puzzle className="h-8 w-8" />,
      title: 'Powerful Integrations',
      description: 'Connect with your favorite tools and services through our extensive integration library',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: 'Integrations',
      description: 'Connect with your favorite tools and services to centralize your data',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: 'Team Collaboration',
      description: 'Invite team members and manage workspace permissions with ease',
      color: 'from-indigo-500 to-blue-500',
    },
    {
      icon: <Bell className="h-8 w-8" />,
      title: 'Smart Notifications',
      description: 'Stay informed with real-time alerts and activity notifications',
      color: 'from-pink-500 to-rose-500',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop",
          }}
          style={{ willChange: 'transform' }}
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-purple-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop",
          }}
          style={{ willChange: 'transform' }}
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue-500/10 rounded-full blur-3xl"
        />
      </div>

      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Navigation */}
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-between items-center mb-20 backdrop-blur-sm bg-slate-900/30 rounded-2xl p-6 border border-slate-800/50"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Real-Time Pulse
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="px-6 py-2 text-white hover:text-purple-300 transition-colors font-medium"
            >
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="group relative px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Sign Up
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 transition-opacity" />
            </Link>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <div className="text-center py-20">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1
              className="text-7xl md:text-8xl font-black mb-6 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent"
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              Welcome to
              <br />
              Real-Time Pulse
            </motion.h1>
          </motion.div>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Monitor your portals and workspaces in real-time. Get instant insights and manage everything from a unified, beautiful dashboard.
          </motion.p>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20"
          >
            {/* Get Started Card */}
            <motion.div
              whileHover={{ scale: 1.05, y: -10 }}
              transition={{ duration: 0.2 }}
              className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 hover:border-purple-500 transition-all"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl group-hover:bg-purple-500/30 transition-colors" />
              <div className="relative z-10">
                <Lock className="h-12 w-12 text-purple-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-4">Get Started</h2>
                <p className="text-gray-400 mb-6">
                  Create a new account or sign in to access your dashboard
                </p>
                <div className="space-y-3">
                  <Link
                    href="/auth/signup"
                    className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-3 rounded-xl transition-all"
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/auth/login"
                    className="block w-full border-2 border-purple-500 text-purple-300 hover:bg-purple-500/10 font-semibold py-3 rounded-xl transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Dashboard Info Card */}
            <motion.div
              whileHover={{ scale: 1.05, y: -10 }}
              transition={{ duration: 0.2 }}
              className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 hover:border-blue-500 transition-all"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl group-hover:bg-blue-500/30 transition-colors" />
              <div className="relative z-10">
                <TrendingUp className="h-12 w-12 text-blue-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-4">Dashboard</h2>
                <p className="text-gray-400 mb-6">
                  View and manage your portals, workspaces, and real-time metrics
                </p>
                <Link
                  href="/dashboard"
                  className="block w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  Go to Dashboard
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Features Section */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-4">
            Powerful Features
          </h2>
          <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
            Everything you need to monitor, manage, and optimize your workflows
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.05, ease: "easeOut" }}
                whileHover={{ scale: 1.05, y: -8 }}
                style={{ willChange: 'transform' }}
                className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700 rounded-xl p-6 hover:border-purple-500/50 transition-all"
              >
                <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${feature.color} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity`} />
                <div className="relative z-10">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} bg-opacity-20 text-white mb-4`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center py-20"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-900/50 via-pink-900/50 to-purple-900/50 backdrop-blur-xl border border-purple-500/50 rounded-3xl p-12 max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 animate-pulse" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of teams already using Real-Time Pulse to streamline their workflows
              </p>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-105"
              >
                Create Free Account
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
