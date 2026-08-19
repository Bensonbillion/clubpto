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
const SkillsLab = lazy(() => import("./pages/SkillsLab"));
const Install = lazy(() => import("./pages/Install"));
// Court Manager. There is one now.
//
// v1 (/manage-classic), v2 (/manage2), v3 (/manage) and v4 (/manage4) are gone,
// along with their engines, their components and their tests. Four managers
// meant four answers to "what happened on court 1 tonight", and the operator
// had to know which URL they were on before they could trust the screen.
const ManageApp = lazy(() => import("./manage/ManageApp"));
// Not a manager. This is /admin/playoffs, a standalone bracket tool that shares
// nothing with the engines above, which is why it outlived them.
const ManualPlayoffs = lazy(() => import("./pages/ManualPlayoffs"));
const SeasonReset = lazy(() => import("./pages/admin/SeasonReset"));
const SessionHistory = lazy(() => import("./pages/admin/SessionHistory"));
const SessionDetail = lazy(() => import("./pages/admin/SessionDetail"));
const Set01Tournament = lazy(() => import("./pages/admin/Set01Tournament"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Club = lazy(() => import("./pages/Club"));
const ClubRoomPreview = lazy(() => import("./pages/ClubRoomPreview"));

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
              <Route path="/skills-lab" element={<SkillsLab />} />
              {/* the old singular URL has been shared — keep it landing */}
              <Route path="/skill-lab" element={<Navigate to="/skills-lab" replace />} />
              <Route path="/install" element={<Install />} />
            </Route>

            {/* Clubhouse door (Wave 2): own shell, soft-launch (unlinked) */}
          <Route path="/club" element={<Club />} />
          {/* Dev-only visual harness for the room (redirects in prod) */}
          <Route path="/club/preview" element={<ClubRoomPreview />} />

          {/* The manager. Isolated, no public layout, robots-blocked by prefix.
                The passcode is the door; there is no sign-in and no inbox. */}
            <Route path="/manage" element={<ManageApp />} />
            {/* The old managers' URLs. An operator with /manage4 on their home
                screen taps it tonight and must land on the manager, not on a
                blank page, so these redirect rather than 404. */}
            <Route path="/manage4" element={<Navigate to="/manage" replace />} />
            <Route path="/manage-next" element={<Navigate to="/manage" replace />} />
            <Route path="/manage-classic" element={<Navigate to="/manage" replace />} />
            <Route path="/manage2" element={<Navigate to="/manage" replace />} />
            <Route path="/manage/simulate" element={<Navigate to="/manage" replace />} />
            <Route path="/manage/test" element={<Navigate to="/manage" replace />} />
            {/* Player-facing rankings are DOWN until clubhouse Wave 3 puts
                them behind a login: real names and full standings were public
                at these URLs. The routes stay alive as redirects because
                /manage still links to /profile/:playerId, and a redirect is a
                kinder dead end than a 404. robots.txt keeps disallowing them. */}
            <Route path="/leaderboard" element={<Navigate to="/" replace />} />
            <Route path="/profile/:playerId" element={<Navigate to="/" replace />} />
            <Route path="/admin/playoffs" element={<ManualPlayoffs />} />
            <Route path="/admin/playoffs/set01" element={<Set01Tournament />} />
            <Route path="/admin/reset" element={<SeasonReset />} />
            <Route path="/admin/history" element={<SessionHistory />} />
            <Route path="/admin/history/:id" element={<SessionDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
