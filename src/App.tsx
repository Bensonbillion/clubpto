import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import Index from "./pages/Index";

// Everything except the homepage is code-split so public visitors never
// download the court-manager engine, admin tooling, or inner pages up front.
const Book = lazy(() => import("./pages/Book"));
const About = lazy(() => import("./pages/About"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const Community = lazy(() => import("./pages/Community"));
const Partners = lazy(() => import("./pages/Partners"));
const Install = lazy(() => import("./pages/Install"));
const Manage = lazy(() => import("./pages/Manage"));
const Manage2 = lazy(() => import("./pages/Manage2"));
const ManageNext = lazy(() => import("./pages/ManageNext"));
const ManageAmericano = lazy(() => import("./pages/ManageAmericano"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const ManualPlayoffs = lazy(() => import("./pages/ManualPlayoffs"));
const Simulate = lazy(() => import("./pages/Simulate"));
const EngineTest = lazy(() => import("./pages/EngineTest"));
const SeasonReset = lazy(() => import("./pages/admin/SeasonReset"));
const SessionHistory = lazy(() => import("./pages/admin/SessionHistory"));
const SessionDetail = lazy(() => import("./pages/admin/SessionDetail"));
const Set01Tournament = lazy(() => import("./pages/admin/Set01Tournament"));
const Login = lazy(() => import("./pages/Login"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Club = lazy(() => import("./pages/Club"));

const queryClient = new QueryClient();

// Quiet forest screen while a lazy chunk arrives
const Loading = () => (
  <div style={{ minHeight: "100vh", background: "#0a1810" }} aria-busy="true" />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* basename follows Vite's base so subpath deploys (e.g. GitHub Pages) work; "/" locally */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public routes — wrapped with Header + Footer + Lenis */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/book" element={<Book />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQPage />} />
              {/* Membership is parked for now; keep the URL alive as a redirect */}
              <Route path="/membership" element={<Navigate to="/" replace />} />
              {/* Old events page retired; Courtside info lives on the homepage */}
              <Route path="/events" element={<Navigate to="/" replace />} />
              <Route path="/community" element={<Community />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/install" element={<Install />} />
            </Route>

            {/* Clubhouse door (Wave 2): own shell, soft-launch (unlinked) */}
          <Route path="/club" element={<Club />} />

          {/* Manage routes — completely isolated, no public layout.
                /manage now serves Court Manager v3 (games-first rebuild).
                /manage-classic keeps the legacy manager as the courtside
                escape hatch until the rebuild reaches full parity. */}
            <Route path="/manage" element={<ManageNext />} />
          {/* Court Manager v4 (Americano) — robots-blocked via the /manage prefix */}
          <Route path="/manage4" element={<ManageAmericano />} />
            <Route path="/manage-classic" element={<Manage />} />
            <Route path="/manage2" element={<Manage2 />} />
            <Route path="/manage/simulate" element={<Simulate />} />
            <Route path="/manage/test" element={<EngineTest />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile/:playerId" element={<Profile />} />
            <Route path="/admin/playoffs" element={<ManualPlayoffs />} />
            <Route path="/admin/playoffs/set01" element={<Set01Tournament />} />
            <Route path="/admin/reset" element={<SeasonReset />} />
            <Route path="/admin/history" element={<SessionHistory />} />
            <Route path="/admin/history/:id" element={<SessionDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
