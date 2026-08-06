// Landing page composition. Every section is a server component rendering
// from components/marketing/landing/content.ts; the only client islands are
// LandingNav, StartCta (auth-aware hrefs), and CoffeeLink (build-time env),
// so the static HTML ships the full marketing content.

import LandingNav from './landing/LandingNav';
import Hero from './landing/Hero';
import StatsStrip from './landing/StatsStrip';
import OfferingsSection from './landing/OfferingsSection';
import JourneySection from './landing/JourneySection';
import HowItWorks from './landing/HowItWorks';
import JurisdictionsSection from './landing/JurisdictionsSection';
import FaqSection from './landing/FaqSection';
import ClosingCta from './landing/ClosingCta';
import LandingFooter from './landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingNav />
      <Hero />
      <StatsStrip />
      <OfferingsSection />
      <JourneySection />
      <HowItWorks />
      <JurisdictionsSection />
      <FaqSection />
      <ClosingCta />
      <LandingFooter />
    </div>
  );
}
