import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface LegalPageProps {
  onBack: () => void;
  title: string;
  content: React.ReactNode;
}

export function LegalLayout({ onBack, title, content }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Home
        </button>
        <h1 className="text-4xl font-bold mb-8 text-white">{title}</h1>
        <div className="prose prose-invert max-w-none prose-p:text-slate-400 prose-headings:text-white prose-li:text-slate-400">
          {content}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
        <p>We collect information you provide directly to us when you use our service, including your name, email address, and Google Business Profile data when you authorize access via Google OAuth.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">2. How We Use Your Information</h2>
        <p>We use the information we collect to provide, maintain, and improve our services, specifically to automate Google Business Profile management and provide marketing insights through AI.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">3. Data Security</h2>
        <p>We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">4. Google User Data</h2>
        <p>Our app's use and transfer to any other app of information received from Google APIs will adhere to the Google API Service User Data Policy, including the Limited Use requirements.</p>
      </section>
    </div>
  );
}

export function TermsOfServiceContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
        <p>By accessing and using Cort X AI, you accept and agree to be bound by the terms and provision of this agreement.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">2. Description of Service</h2>
        <p>Cort X AI provides users with AI-powered tools for Google Business Profile management, including review responses and marketing strategy generation.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">3. User Conduct</h2>
        <p>You agree to use the service only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the service.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">4. Limitation of Liability</h2>
        <p>Cort X AI shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues.</p>
      </section>
    </div>
  );
}
