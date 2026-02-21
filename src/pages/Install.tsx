import { useState, useEffect } from "react";
import { Download, Smartphone, Monitor, Share, MoreVertical, PlusSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else setPlatform("desktop");

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-2xl text-accent">Install App</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-10 animate-fade-up">
        {isInstalled ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
              <Download className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-accent">Already Installed!</h2>
            <p className="text-muted-foreground">Club PTO is installed on your device. Open it from your home screen.</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-accent" />
              </div>
              <h2 className="font-display text-3xl text-accent">Install Club PTO</h2>
              <p className="text-muted-foreground text-lg">Add to your home screen for the best experience — launches full screen, no browser bar.</p>
            </div>

            {/* Native install prompt (Android Chrome) */}
            {deferredPrompt && (
              <div className="text-center">
                <Button onClick={handleInstall} className="bg-accent text-accent-foreground hover:bg-accent/80 min-h-[52px] px-8 text-lg">
                  <Download className="w-5 h-5 mr-2" /> Install Now
                </Button>
              </div>
            )}

            {/* Manual instructions */}
            <div className="space-y-6">
              {platform === "android" && !deferredPrompt && (
                <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                  <h3 className="font-display text-xl text-accent flex items-center gap-2">
                    <Smartphone className="w-5 h-5" /> Android
                  </h3>
                  <ol className="space-y-3 text-foreground/80">
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">1.</span>
                      <span>Tap the <MoreVertical className="inline w-4 h-4" /> menu in Chrome</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">2.</span>
                      <span>Select <strong>"Add to Home screen"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">3.</span>
                      <span>Tap <strong>"Add"</strong> to confirm</span>
                    </li>
                  </ol>
                </div>
              )}

              {platform === "ios" && (
                <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                  <h3 className="font-display text-xl text-accent flex items-center gap-2">
                    <Smartphone className="w-5 h-5" /> iPhone / iPad
                  </h3>
                  <ol className="space-y-3 text-foreground/80">
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">1.</span>
                      <span>Tap the <Share className="inline w-4 h-4" /> Share button in Safari</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">2.</span>
                      <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">3.</span>
                      <span>Tap <strong>"Add"</strong> to confirm</span>
                    </li>
                  </ol>
                </div>
              )}

              {platform === "desktop" && (
                <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                  <h3 className="font-display text-xl text-accent flex items-center gap-2">
                    <Monitor className="w-5 h-5" /> Desktop
                  </h3>
                  <ol className="space-y-3 text-foreground/80">
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">1.</span>
                      <span>Look for the <PlusSquare className="inline w-4 h-4" /> install icon in your browser's address bar</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-display text-accent text-lg">2.</span>
                      <span>Click <strong>"Install"</strong></span>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Install;
