import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import Index from "./pages/Index";
import Book from "./pages/Book";
import About from "./pages/About";
import FAQPage from "./pages/FAQPage";
import Membership from "./pages/Membership";
import Events from "./pages/Events";
import Community from "./pages/Community";
import Manage from "./pages/Manage";
import Install from "./pages/Install";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import ManualPlayoffs from "./pages/ManualPlayoffs";
import Simulate from "./pages/Simulate";
import EngineTest from "./pages/EngineTest";
import SeasonReset from "./pages/admin/SeasonReset";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes — wrapped with Header + Footer + Lenis */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/book" element={<Book />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/events" element={<Events />} />
            <Route path="/community" element={<Community />} />
            <Route path="/install" element={<Install />} />
          </Route>

          {/* Manage route — completely isolated, no public layout */}
          <Route path="/manage" element={<Manage />} />
          <Route path="/manage/simulate" element={<Simulate />} />
          <Route path="/manage/test" element={<EngineTest />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile/:playerId" element={<Profile />} />
          <Route path="/admin/playoffs" element={<ManualPlayoffs />} />
          <Route path="/admin/reset" element={<SeasonReset />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
