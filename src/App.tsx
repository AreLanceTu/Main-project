import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import Account from "./pages/Account.jsx";
import Messages from "./pages/Messages.jsx";
import JobPost from "./pages/JobPost";
import AuthGuard from "./components/AuthGuard.jsx";
import RoleGuard from "./components/RoleGuard.jsx";
import FreelancerDashboard from "./pages/FreelancerDashboard.jsx";
import WithdrawalDetails from "./pages/WithdrawalDetails.jsx";
import Gigs from "./pages/Gigs";
import Gig from "./pages/Gig";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import JobPosts from "./pages/JobPosts";
import JobPostDetails from "./pages/JobPostDetails";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import RefundPolicy from "./pages/RefundPolicy";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import CookiePolicy from "./pages/CookiePolicy";
import ParticleBackground from "./components/ParticleBackground";
import CursorFollower from "./components/CursorFollower";
import PresenceUpdater from "./components/PresenceUpdater";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PresenceUpdater />
        <ParticleBackground />
        <CursorFollower />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/refunds" element={<RefundPolicy />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/cookies" element={<CookiePolicy />} />

            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <ClientDashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/freelancer-dashboard"
              element={
                <AuthGuard>
                  <RoleGuard role="freelancer" redirectTo="/dashboard">
                    <FreelancerDashboard />
                  </RoleGuard>
                </AuthGuard>
              }
            />
            <Route
              path="/withdrawal"
              element={
                <AuthGuard>
                  <RoleGuard role="freelancer" redirectTo="/dashboard">
                    <WithdrawalDetails />
                  </RoleGuard>
                </AuthGuard>
              }
            />
            <Route
              path="/gigs"
              element={
                <AuthGuard>
                  <Gigs />
                </AuthGuard>
              }
            />
            <Route
              path="/gig/:id"
              element={
                <AuthGuard>
                  <Gig />
                </AuthGuard>
              }
            />
            <Route
              path="/checkout"
              element={
                <AuthGuard>
                  <Checkout />
                </AuthGuard>
              }
            />
            <Route
              path="/order-confirmation"
              element={
                <AuthGuard>
                  <OrderConfirmation />
                </AuthGuard>
              }
            />
            <Route
              path="/account"
              element={
                <AuthGuard>
                  <Account />
                </AuthGuard>
              }
            />
            <Route
              path="/messages"
              element={
                <AuthGuard>
                  <Messages />
                </AuthGuard>
              }
            />

            <Route
              path="/job-post"
              element={
                <AuthGuard>
                  <JobPost />
                </AuthGuard>
              }
            />

            <Route
              path="/job-posts"
              element={
                <AuthGuard>
                  <JobPosts />
                </AuthGuard>
              }
            />

            <Route
              path="/job-posts/:id"
              element={
                <AuthGuard>
                  <JobPostDetails />
                </AuthGuard>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;