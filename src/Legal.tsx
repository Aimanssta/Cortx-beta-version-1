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
        <p>We collect information you provide directly to us, including your name and email address. When you authorize CORTX GBP to access your Google account, we collect data from your Google Business Profiles, including location details, reviews, performance metrics, and post history.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">2. How We Use Google User Data</h2>
        <p>Your Google user data is used exclusively to provide the core functionality of CORTX GBP, which includes:</p>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li>Monitoring and displaying your business profile performance metrics.</li>
          <li>Generating AI-powered responses to your customer reviews.</li>
          <li>Scheduling and publishing posts to your Google Business Profile.</li>
          <li>Performing AI-driven audits to suggest optimizations for your profile.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">3. Data Storage and Retention</h2>
        <p>We store your Google OAuth tokens and profile metadata in a secure, encrypted Firebase database to maintain your connection. We do not sell or trade your personal data to third parties. Data is retained only as long as you maintain an active account with us.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">4. Data Sharing and Disclosure</h2>
        <p>CORTX GBP does not share your Google user data with any third-party AI models in a way that identifies you. We use the Gemini API to generate text responses, but only the specific review content or metric summaries are sent as prompts, never your personal account identifiers.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">5. Limited Use Policy</h2>
        <p>CORTX GBP's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" className="text-indigo-400 hover:underline">Google API Service User Data Policy</a>, including the Limited Use requirements.</p>
      </section>
    </div>
  );
}

export function TermsOfServiceContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
        <p>By accessing and using CORTX GBP, you accept and agree to be bound by the terms and provision of this agreement.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">2. Description of Service</h2>
        <p>CORTX GBP provides users with AI-powered tools for Google Business Profile management, including review responses and marketing strategy generation.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">3. User Conduct</h2>
        <p>You agree to use the service only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the service.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">4. Limitation of Liability</h2>
        <p>CORTX GBP shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues.</p>
      </section>
    </div>
  );
}
