import React, { useEffect, useState } from "react";
import { X, Share, Plus, Download, Smartphone } from "lucide-react";

// ── Detection helpers ──────────────────────────────────────────────────────
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari(): boolean {
  return /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as any).standalone === true)
  );
}

// ── iOS Guide Modal ────────────────────────────────────────────────────────
function IOSGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-sm bg-[#1a1a2e] border border-white/12 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vascan-gold/15 border border-vascan-gold/20 flex items-center justify-center">
              <span className="text-vascan-gold font-bold text-sm">V</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Instalar Vascan</p>
              <p className="text-white/40 text-xs">Agrega la app a tu iPhone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-5 space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3.5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-vascan-gold/15 border border-vascan-gold/30 flex items-center justify-center">
              <span className="text-vascan-gold font-bold text-xs">1</span>
            </div>
            <div className="flex-1 pt-1">
              <p className="text-white text-sm font-medium leading-snug">
                Toca el botón{" "}
                <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-md text-xs font-semibold">
                  <Share className="w-3 h-3" />
                  Compartir
                </span>{" "}
                en la barra inferior del navegador
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="ml-4 h-4 w-px bg-white/10" />

          {/* Step 2 */}
          <div className="flex items-start gap-3.5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-vascan-gold/15 border border-vascan-gold/30 flex items-center justify-center">
              <span className="text-vascan-gold font-bold text-xs">2</span>
            </div>
            <div className="flex-1 pt-1">
              <p className="text-white text-sm font-medium leading-snug">
                Desliza hacia abajo y elige{" "}
                <span className="inline-flex items-center gap-1 bg-white/10 text-white/80 px-1.5 py-0.5 rounded-md text-xs font-semibold border border-white/15">
                  <Plus className="w-3 h-3" />
                  Agregar a inicio
                </span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="ml-4 h-4 w-px bg-white/10" />

          {/* Step 3 */}
          <div className="flex items-start gap-3.5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-vascan-gold/15 border border-vascan-gold/30 flex items-center justify-center">
              <span className="text-vascan-gold font-bold text-xs">3</span>
            </div>
            <div className="flex-1 pt-1">
              <p className="text-white text-sm font-medium leading-snug">
                Pulsa{" "}
                <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-md text-xs font-semibold">
                  Agregar
                </span>{" "}
                en la esquina superior derecha — ¡listo!
              </p>
            </div>
          </div>
        </div>

        {/* Arrow indicator pointing down (Safari bar is at bottom on iOS) */}
        <div className="px-5 pb-6 pt-2">
          <p className="text-white/30 text-xs text-center leading-relaxed">
            La app aparecerá en tu pantalla de inicio como cualquier otra aplicación
          </p>
        </div>

        {/* Caret pointing to share button */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="w-5 h-5 bg-[#1a1a2e] border-r border-b border-white/12 rotate-45" />
        </div>
      </div>
    </div>
  );
}

// ── Install Banner (Chrome/Edge) ───────────────────────────────────────────
interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className="fixed bottom-5 left-4 right-4 z-40 flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#1a1a2e] border border-vascan-gold/25 shadow-2xl max-w-sm mx-auto">
      <div className="w-9 h-9 rounded-xl bg-vascan-gold/15 border border-vascan-gold/20 flex items-center justify-center flex-shrink-0">
        <Smartphone className="w-4 h-4 text-vascan-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight">Instalar Vascan</p>
        <p className="text-white/40 text-xs mt-0.5 leading-tight">Accede rápido desde tu pantalla de inicio</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onInstall}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-vascan-gold text-vascan-bg text-xs font-bold hover:brightness-110 transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar
        </button>
        <button
          onClick={onDismiss}
          className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-white/40"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const DISMISS_KEY = "vascan_install_dismissed";

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isInStandaloneMode()) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const iosAndSafari = isIOS() && isSafari();

    if (iosAndSafari) {
      // Show iOS banner after a short delay
      const t = setTimeout(() => setShowBanner(true), 2500);
      return () => clearTimeout(t);
    }

    // Chrome/Edge — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 2500);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (isIOS() && isSafari()) {
      setShowIOSGuide(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
        setShowBanner(false);
      });
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShowBanner(false);
    setDismissed(true);
  }

  if (dismissed || !showBanner) return null;

  return (
    <>
      <InstallBanner onInstall={handleInstall} onDismiss={handleDismiss} />
      {showIOSGuide && <IOSGuide onClose={() => { setShowIOSGuide(false); handleDismiss(); }} />}
    </>
  );
}
