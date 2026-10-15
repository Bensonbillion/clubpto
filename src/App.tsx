import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SiteLayout from "./site/ui/SiteLayout";
import Home from "./pages/Home";
import { RETIRED } from "./site/retired";
import { SiteAnalytics } from "./site/analytics";

// Everything except the homepage is code-split so public visitors never
// download the court-manager engine, admin tooling, or inner pages up front.
const Play = lazy(() => import("./pages/Play"));
const Events = lazy(() => import("./pages/Events"));
const BookPTO = lazy(() => import("./pages/BookPTO"));
const Partners = lazy(() => import("./pages/Partners"));
const SkillsLab = lazy(() => import("./pages/SkillsLab"));
const LeagueAdmin = lazy(() => import("./pages/LeagueAdmin"));
const League = lazy(() => import("./pages/League"));
// Court Manager. There is one now, mounted twice.
//
// v1 (/manage-classic), v2 (/manage2), v3 (/manage) and v4 (/manage4) are gone,
// along with their engines, their components and their tests. Four managers
// meant four answers to "what happened on court 1 tonight", and the operator
// had to know which URL they were on before they could trust the screen.
// /manage2 is alive again, but as the SAME app with its own night, not a
// different manager: one court on each phone, two URLs, one codebase.
const ManageApp = lazy(() => import("./manage/ManageApp"));
// Not a manager. This is /admin/playoffs, a standalone bracket tool that shares
// nothing with the engines above, which is why it outlived them.
const ManualPlayoffs = lazy(() => import("./pages/ManualPlayoffs"));
const SeasonReset = lazy(() => import("./pages/admin/SeasonReset"));
const SessionHistory = lazy(() => import("./pages/admin/SessionHistory"));
const SessionDetail = lazy(() => import("./pages/admin/SessionDetail"));
const Set01Tournament = lazy(() => import("./pages/admin/Set01Tournament"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();



// Quiet paper screen while a lazy chunk arrives (the redesigned pages are
// cream; the manager and clubhouse paint over it immediately).
const Loading = () => (
  <div style={{ minHeight: "100vh", background: "#F5EFE3" }} aria-busy="true" />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SiteAnalytics />
      {/* basename follows Vite's base so subpath deploys (e.g. GitHub Pages) work; "/" locally */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* The redesigned public site (October 2026): light layout. */}
            <Route element={<SiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/play" element={<Play />} />
              <Route path="/league" element={<League />} />
              <Route path="/events" element={<Events />} />
              <Route path="/book-pto" element={<BookPTO />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/skills-lab" element={<SkillsLab />} />
              {/* Anything unknown gets the site's own 404, with a way back in. */}
              <Route path="*" element={<NotFound />} />
            </Route>
            {/* the old singular URL has been shared, keep it landing */}
            <Route path="/skill-lab" element={<Navigate to="/skills-lab" replace />} />

            {/* Retired old-branding pages (Oct 15 2026). Their links have been
                shared, so each lands on the page that replaced it. vercel.json
                redirects the same paths before the app even loads. */}
            {RETIRED.map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            {/* Friendly aliases for the new pages. */}
            <Route path="/thursday" element={<Navigate to="/play" replace />} />
            <Route path="/corporate" element={<Navigate to="/book-pto" replace />} />
            <Route path="/private-events" element={<Navigate to="/book-pto" replace />} />

            {/* League admin: courtside tool, own shell, no site chrome, and
                behind the same shared passcode as the rest of the back of
                house. Robots-blocked by prefix like /manage. */}
            <Route path="/league/admin" element={<LeagueAdmin />} />

          {/* The manager. Isolated, no public layout, robots-blocked by prefix.
                The passcode is the door; there is no sign-in and no inbox. */}
            <Route path="/manage" element={<ManageApp key="manage-1" />} />
            {/* The old managers' URLs. An operator with /manage4 on their home
                screen taps it tonight and must land on the manager, not on a
                blank page, so these redirect rather than 404. */}
            <Route path="/manage4" element={<Navigate to="/manage" replace />} />
            <Route path="/manage-next" element={<Navigate to="/manage" replace />} />
            <Route path="/manage-classic" element={<Navigate to="/manage" replace />} />
            {/* A second manager, same app, its own night. The club runs one
                court on /manage and the other on /manage2 from two phones
                when it wants to, and each instance keeps its night under its
                own localStorage key so the two never see each other. The keys
                on the two elements force a remount if anything ever navigates
                between them client-side: same component type at the same route
                position would otherwise carry one manager's unlocked door and
                court UI state straight into the other. */}
            <Route path="/manage2" element={<ManageApp key="manage-2" instance={2} />} />
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
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
