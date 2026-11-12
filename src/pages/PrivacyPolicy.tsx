import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500/30">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Chronora</span>
        </Link>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-slate-400 mt-1">Last updated: November 2026 • Chronora Study Platform</p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-slate-300">
            <section>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                1. Introduction
              </h2>
              <p>
                Welcome to <strong>Chronora</strong> ("we", "our", or "the app"). We respect your privacy and are committed to protecting the personal data of our users. This Privacy Policy explains how we collect, use, and protect your information when you use our study, timer, notes, and collaborative learning features.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                2. Information We Collect
              </h2>
              <p className="mb-2">We collect only the essential information necessary to provide study tracking and collaborative features:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                <li>
                  <strong className="text-slate-200">Account Information:</strong> When you sign in using Google Sign-In or Email, we receive your name, email address, and profile picture (if provided by Google).
                </li>
                <li>
                  <strong className="text-slate-200">Study & Productivity Data:</strong> Focus timer session durations, timestamps, study subject tags, daily streaks, task checklists, and study notes created within the app.
                </li>
                <li>
                  <strong className="text-slate-200">Group & Collaboration Data:</strong> Messages and interactions within study groups you choose to join.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                3. How We Use Your Information
              </h2>
              <p className="mb-2">Your information is used solely to enhance your personal and group study experience:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                <li>To calculate study statistics, streaks, weekly insights, and XP rankings.</li>
                <li>To synchronize your data seamlessly across all your devices (Phone, Tablet, PC).</li>
                <li>To allow real-time collaborative group study sessions.</li>
                <li>We <strong className="text-slate-200">never sell, rent, or monetize</strong> your personal data or study records to third parties or advertisers.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                4. Data Storage and Security
              </h2>
              <p>
                All account credentials, timer sessions, notes, and task lists are securely stored using <strong>Google Firebase Cloud Infrastructure</strong> with enterprise-grade encryption both in transit (TLS/SSL) and at rest.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">5. User Control & Data Deletion</h2>
              <p>
                You retain complete ownership over your data. You can edit or delete your tasks, notes, and study subjects at any time directly in the app. To request full deletion of your user account and all associated study history, contact us at our support email.
              </p>
            </section>

            <section className="pt-4 border-t border-slate-800">
              <h2 className="text-base font-bold text-white mb-1">Contact Us</h2>
              <p className="text-slate-400 text-xs">
                If you have any questions about this Privacy Policy or Chronora's data practices, please contact us at: <span className="text-cyan-400 font-mono">support@chronora.app</span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
