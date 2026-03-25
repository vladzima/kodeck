import { useEffect, useState } from "react";
import { Dithering, GrainGradient } from "@paper-design/shaders-react";
import {
  Terminal,
  ChevronRight,
  GitBranch,
  FolderGit2,
  MessageSquare,
  ChevronDown,
} from "lucide-react";

/* ── scroll reveal hook ── */
function useReveal() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll(".reveal");
    if (prefersReducedMotion) {
      els.forEach((el) => el.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ── animated feature illustrations (larger) ── */

function IllustrationWorkspace() {
  return (
    <svg viewBox="0 0 80 64" fill="none" className="feat-anim h-28 w-36" aria-hidden="true">
      <rect
        x="4"
        y="8"
        width="30"
        height="22"
        rx="2"
        fill="var(--color-card)"
        style={{ animation: "float 4s ease-in-out infinite" }}
      />
      <rect
        x="46"
        y="4"
        width="30"
        height="22"
        rx="2"
        fill="var(--color-card)"
        style={{ animation: "float 4s ease-in-out infinite 0.6s" }}
      />
      <rect
        x="4"
        y="36"
        width="30"
        height="22"
        rx="2"
        fill="var(--color-card)"
        style={{ animation: "float 4s ease-in-out infinite 1.2s" }}
      />
      <rect
        x="46"
        y="38"
        width="30"
        height="22"
        rx="2"
        fill="var(--color-card)"
        style={{ animation: "float 4s ease-in-out infinite 1.8s" }}
      />
      <circle
        cx="8"
        cy="12"
        r="1.5"
        fill="var(--color-primary-bright)"
        style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
      />
      <rect
        x="12"
        y="13"
        width="18"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
      />
      <rect
        x="12"
        y="18"
        width="12"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
      />
      <rect
        x="54"
        y="9"
        width="18"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
      />
      <rect
        x="54"
        y="14"
        width="14"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
      />
      <line
        x1="34"
        y1="19"
        x2="46"
        y2="15"
        stroke="var(--color-primary)"
        strokeWidth="0.5"
        opacity="0.3"
        strokeDasharray="3 2"
        style={{ animation: "dash-flow 2s linear infinite" }}
      />
      <line
        x1="34"
        y1="47"
        x2="46"
        y2="49"
        stroke="var(--color-primary)"
        strokeWidth="0.5"
        opacity="0.3"
        strokeDasharray="3 2"
        style={{ animation: "dash-flow 2s linear infinite 0.5s" }}
      />
    </svg>
  );
}

function IllustrationSearch() {
  return (
    <svg viewBox="0 0 80 64" fill="none" className="feat-anim h-28 w-36" aria-hidden="true">
      <circle
        cx="32"
        cy="28"
        r="16"
        stroke="var(--color-muted-foreground)"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <circle
        cx="32"
        cy="28"
        r="16"
        stroke="var(--color-primary-bright)"
        strokeWidth="1.5"
        opacity="0.6"
        strokeDasharray="20 80"
        strokeLinecap="round"
        style={{ animation: "rotate-slow 3s linear infinite", transformOrigin: "32px 28px" }}
      />
      <line
        x1="44"
        y1="40"
        x2="54"
        y2="50"
        stroke="var(--color-muted-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <rect
        x="56"
        y="12"
        width="18"
        height="2"
        rx="1"
        fill="var(--color-primary-bright)"
        opacity="0.5"
        style={{ animation: "slide-in 2s ease-out infinite" }}
      />
      <rect
        x="56"
        y="20"
        width="14"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.25"
        style={{ animation: "slide-in 2s ease-out infinite 0.15s" }}
      />
      <rect
        x="56"
        y="28"
        width="16"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
        style={{ animation: "slide-in 2s ease-out infinite 0.3s" }}
      />
      <rect
        x="56"
        y="36"
        width="10"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
        style={{ animation: "slide-in 2s ease-out infinite 0.45s" }}
      />
      <circle
        cx="32"
        cy="28"
        r="6"
        fill="var(--color-primary)"
        opacity="0.08"
        style={{ animation: "scale-pulse 2s ease-in-out infinite", transformOrigin: "32px 28px" }}
      />
    </svg>
  );
}

function IllustrationClaude() {
  return (
    <svg viewBox="0 0 80 64" fill="none" className="feat-anim h-28 w-36" aria-hidden="true">
      <rect x="8" y="6" width="64" height="52" rx="3" fill="var(--color-card)" />
      <rect x="8" y="6" width="64" height="10" rx="3" fill="var(--color-secondary)" />
      <circle cx="16" cy="11" r="1.5" fill="#ff5f57" opacity="0.7" />
      <circle cx="22" cy="11" r="1.5" fill="#febc2e" opacity="0.7" />
      <circle cx="28" cy="11" r="1.5" fill="#28c840" opacity="0.7" />
      <rect
        x="14"
        y="22"
        width="3"
        height="2"
        rx="1"
        fill="var(--color-primary-bright)"
        opacity="0.8"
      />
      <rect
        x="20"
        y="22"
        width="24"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="14"
        y="30"
        width="44"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
        style={{ animation: "slide-in 3s ease-out infinite" }}
      />
      <rect
        x="14"
        y="35"
        width="36"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
        style={{ animation: "slide-in 3s ease-out infinite 0.2s" }}
      />
      <rect
        x="14"
        y="40"
        width="40"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
        style={{ animation: "slide-in 3s ease-out infinite 0.4s" }}
      />
      <rect
        x="14"
        y="47"
        width="2"
        height="6"
        rx="0.5"
        fill="var(--color-primary-bright)"
        style={{ animation: "blink 1s step-end infinite" }}
      />
    </svg>
  );
}

function IllustrationConfig() {
  return (
    <svg viewBox="0 0 80 64" fill="none" className="feat-anim h-28 w-36" aria-hidden="true">
      <circle
        cx="30"
        cy="32"
        r="14"
        stroke="var(--color-muted-foreground)"
        strokeWidth="1"
        opacity="0.2"
      />
      <g style={{ animation: "rotate-slow 8s linear infinite", transformOrigin: "30px 32px" }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="28"
            y="16"
            width="4"
            height="6"
            rx="1"
            fill="var(--color-muted-foreground)"
            opacity="0.2"
            transform={`rotate(${angle} 30 32)`}
          />
        ))}
        <circle cx="30" cy="32" r="8" fill="var(--color-card)" />
        <circle cx="30" cy="32" r="4" stroke="var(--color-primary)" strokeWidth="1" opacity="0.4" />
      </g>
      <rect
        x="52"
        y="18"
        width="16"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.25"
      />
      <rect
        x="52"
        y="24"
        width="12"
        height="2"
        rx="1"
        fill="var(--color-primary-bright)"
        opacity="0.4"
      />
      <rect
        x="52"
        y="30"
        width="18"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
      />
      <rect
        x="52"
        y="36"
        width="10"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
      />
      <rect
        x="52"
        y="42"
        width="14"
        height="2"
        rx="1"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
      />
      <circle
        cx="49"
        cy="25"
        r="1.5"
        fill="var(--color-primary-bright)"
        style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
      />
    </svg>
  );
}

function IllustrationTerminalChat() {
  return (
    <svg viewBox="0 0 80 64" fill="none" className="feat-anim h-28 w-36" aria-hidden="true">
      <rect x="4" y="8" width="34" height="48" rx="2" fill="var(--color-card)" />
      <rect
        x="8"
        y="14"
        width="3"
        height="1.5"
        rx="0.75"
        fill="var(--color-primary-bright)"
        opacity="0.7"
      />
      <rect
        x="13"
        y="14"
        width="16"
        height="1.5"
        rx="0.75"
        fill="var(--color-foreground)"
        opacity="0.2"
      />
      <rect
        x="8"
        y="20"
        width="22"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
      />
      <rect
        x="8"
        y="25"
        width="18"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.12"
      />
      <rect
        x="8"
        y="30"
        width="3"
        height="1.5"
        rx="0.75"
        fill="var(--color-primary-bright)"
        opacity="0.7"
      />
      <rect
        x="13"
        y="30"
        width="12"
        height="1.5"
        rx="0.75"
        fill="var(--color-foreground)"
        opacity="0.2"
      />
      <rect x="42" y="8" width="34" height="48" rx="2" fill="var(--color-card)" />
      <rect x="54" y="14" width="18" height="8" rx="2" fill="var(--color-secondary)" />
      <rect
        x="46"
        y="26"
        width="22"
        height="10"
        rx="2"
        fill="var(--color-background)"
        stroke="var(--color-muted-foreground)"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <rect
        x="50"
        y="30"
        width="14"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
        style={{ animation: "slide-in 2.5s ease-out infinite" }}
      />
      <rect x="38" y="8" width="4" height="48" fill="var(--color-background)" opacity="0.5" />
      <circle
        cx="40"
        cy="32"
        r="2"
        fill="var(--color-primary)"
        opacity="0.15"
        style={{ animation: "scale-pulse 3s ease-in-out infinite", transformOrigin: "40px 32px" }}
      />
    </svg>
  );
}

function IllustrationPlatform() {
  return (
    <svg viewBox="0 0 80 64" fill="none" className="feat-anim h-28 w-36" aria-hidden="true">
      <rect
        x="6"
        y="10"
        width="36"
        height="28"
        rx="2"
        fill="var(--color-card)"
        style={{ animation: "float 5s ease-in-out infinite" }}
      />
      <rect x="6" y="10" width="36" height="6" rx="2" fill="var(--color-secondary)" />
      <circle cx="12" cy="13" r="1" fill="var(--color-muted-foreground)" opacity="0.3" />
      <circle cx="16" cy="13" r="1" fill="var(--color-muted-foreground)" opacity="0.3" />
      <circle cx="20" cy="13" r="1" fill="var(--color-muted-foreground)" opacity="0.3" />
      <rect
        x="10"
        y="22"
        width="18"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
      />
      <rect
        x="10"
        y="27"
        width="12"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
      />
      <rect
        x="38"
        y="24"
        width="36"
        height="30"
        rx="2"
        fill="var(--color-card)"
        style={{ animation: "float 5s ease-in-out infinite 1.5s" }}
      />
      <rect x="38" y="24" width="36" height="6" rx="2" fill="var(--color-secondary)" />
      <circle cx="44" cy="27" r="1" fill="#ff5f57" opacity="0.5" />
      <circle cx="48" cy="27" r="1" fill="#febc2e" opacity="0.5" />
      <circle cx="52" cy="27" r="1" fill="#28c840" opacity="0.5" />
      <rect
        x="42"
        y="36"
        width="20"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.2"
      />
      <rect
        x="42"
        y="41"
        width="14"
        height="1.5"
        rx="0.75"
        fill="var(--color-muted-foreground)"
        opacity="0.15"
      />
      <path
        d="M 36 28 Q 40 20 44 28"
        stroke="var(--color-primary)"
        strokeWidth="0.5"
        opacity="0.3"
        fill="none"
        strokeDasharray="3 2"
        style={{ animation: "dash-flow 2s linear infinite" }}
      />
    </svg>
  );
}

/* ── brand mark ── */
function KodeckLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="4" fill="oklch(21% 0.006 285.885)" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="3.5"
        stroke="oklch(100% 0 0 / 0.06)"
        strokeWidth="1"
      />
      <path
        d="M10 10h4.5l3.5 6-3.5 6H10l3.5-6L10 10z"
        fill="var(--color-primary-bright)"
        opacity="0.9"
      />
      <path
        d="M17 10h4.5l3.5 6-3.5 6H17l3.5-6L17 10z"
        fill="var(--color-primary-bright)"
        opacity="0.4"
      />
    </svg>
  );
}

/* ── nav ── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 right-0 left-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl" : ""}`}
      style={{ borderBottom: scrolled ? "1px solid oklch(100% 0 0 / 0.06)" : "1px solid transparent" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-8">
        <a href="#" className="flex items-center gap-3" aria-label="Kodeck home">
          <KodeckLogo size={28} />
          <span
            className="text-base font-medium tracking-[0.25em] text-foreground uppercase"
            style={{ fontFamily: "var(--font-brand)" }}
          >
            kodeck
          </span>
        </a>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Features
          </a>
          <a
            href="#roadmap"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Roadmap
          </a>
          <a
            href="https://github.com/vladzima/kodeck"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-transparent px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            style={{ border: "1px solid oklch(100% 0 0 / 0.1)" }}
          >
            <GithubIcon />
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M5 2h4v2H7v2H5zm0 10H3V6h2zm2 2H5v-2h2zm2 2v-2H7v2H3v-2H1v2h2v2h4v4h2v-4h2v-2zm0 0v2H7v-2zm6-12v2H9V4zm4 2h-2V4h-2V2h4zm0 6V6h2v6zm-2 2v-2h2v2zm-2 2v-2h2v2zm0 2h-2v-2h2zm0 0h2v4h-2z" />
    </svg>
  );
}

/* ── ascii spinner hook ── */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function useSpinner(intervalMs = 80) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return SPINNER_FRAMES[frame];
}

/* ── typing text hook ── */
function useTypingText(text: string, speed = 120, pause = 2000) {
  const [len, setLen] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(
      () => {
        if (!deleting) {
          if (len < text.length) setLen(len + 1);
          else setTimeout(() => setDeleting(true), pause);
        } else {
          if (len > 0) setLen(len - 1);
          else setDeleting(false);
        }
      },
      deleting ? speed / 2 : speed,
    );
    return () => clearTimeout(timeout);
  }, [len, deleting, text, speed, pause]);
  return text.slice(0, len);
}

/* ── sidebar mockup (matches real product) ── */
function SidebarMockup() {
  return (
    <div className="hidden md:flex h-full w-48 shrink-0 flex-col bg-background font-mono text-[10px] text-muted-foreground overflow-hidden">
      {/* header */}
      <div
        className="flex h-10 items-center justify-between px-3"
        style={{ borderBottom: "1px solid oklch(100% 0 0 / 0.06)" }}
      >
        <span
          className="text-[11px] font-medium tracking-[0.25em] text-foreground uppercase"
          style={{ fontFamily: "var(--font-brand)" }}
        >
          kodeck
        </span>
      </div>

      <div className="flex-1 overflow-hidden px-1.5 pt-2">
        {/* add project */}
        <div className="mb-2 px-2 text-muted-foreground/40 transition-colors hover:text-muted-foreground/70 cursor-pointer">
          + Add project
        </div>

        {/* project 1 — expanded */}
        <div className="mb-2">
          <div className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-foreground transition-colors hover:bg-secondary/50 cursor-pointer">
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
            <FolderGit2 className="h-2.5 w-2.5" />
            <span className="truncate">KODECK</span>
          </div>
          <div className="ml-3 mt-0.5 flex flex-col">
            {/* active branch */}
            <div
              className="flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-foreground cursor-pointer"
              style={{ borderLeft: "2px solid var(--color-primary-bright)" }}
            >
              <GitBranch className="h-2.5 w-2.5" />
              <span>main</span>
            </div>
            {/* unstaged */}
            <div className="ml-3 mt-0.5 flex flex-col gap-0">
              <span className="px-1 py-px text-muted-foreground/40">UNSTAGED</span>
              <span className="px-1 py-px transition-colors hover:text-foreground cursor-pointer">
                <span className="text-amber-400">M</span> pnpm-lock.yaml
              </span>
              <span className="px-1 py-px transition-colors hover:text-foreground cursor-pointer">
                <span className="text-amber-400">M</span> skills-lock.json
              </span>
              <span className="px-1 py-px text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 cursor-pointer">
                ▿ apps/landing
              </span>
            </div>
          </div>
        </div>

        {/* project 2 — expanded with branches */}
        <div>
          <div className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-foreground transition-colors hover:bg-secondary/50 cursor-pointer">
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
            <FolderGit2 className="h-2.5 w-2.5" />
            <span className="truncate text-[9px]">SOLANA-TELEGRAM</span>
          </div>
          <div className="ml-3 mt-0.5 flex flex-col gap-0">
            <div className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-muted-foreground/60 transition-colors hover:bg-secondary/30 hover:text-muted-foreground cursor-pointer">
              <GitBranch className="h-2.5 w-2.5" />
              <span>main</span>
            </div>
            <div className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-muted-foreground/60 transition-colors hover:bg-secondary/30 hover:text-muted-foreground cursor-pointer">
              <GitBranch className="h-2.5 w-2.5" />
              <span className="truncate">ask-735-wallet</span>
            </div>
            <div className="ml-5 flex items-center gap-1 text-[9px]">
              <span className="text-muted-foreground/40">#257</span>
              <span className="text-amber-400">●</span>
            </div>
            <div className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-muted-foreground/60 transition-colors hover:bg-secondary/30 hover:text-muted-foreground cursor-pointer">
              <GitBranch className="h-2.5 w-2.5" />
              <span>feat/ASK-493</span>
            </div>
            <div className="ml-5 flex items-center gap-1 text-[9px]">
              <span className="text-muted-foreground/40">#161</span>
              <span className="text-green-400">merged</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── chat panel (left split) ── */
function ChatPanel() {
  const spinner = useSpinner();
  const typedText = useTypingText("refactor auth middleware to use JWT", 90, 3000);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* tab bar */}
      <div
        className="flex h-9 items-center gap-0 bg-background px-1.5"
        style={{ borderBottom: "1px solid oklch(100% 0 0 / 0.06)" }}
      >
        <div className="flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-[10px] text-foreground cursor-pointer transition-colors hover:bg-secondary/80">
          <MessageSquare className="h-2.5 w-2.5" />
          <span>Resume Testing</span>
          <span className="text-muted-foreground/40">*1</span>
          <span className="ml-0.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground">
            &times;
          </span>
        </div>
        <div className="ml-1 flex items-center gap-2 text-[10px] text-muted-foreground/30">
          <span className="cursor-pointer transition-colors hover:text-muted-foreground/50">
            + Chat
          </span>
        </div>
      </div>

      {/* messages */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-hidden px-3 py-2.5">
        {/* claude message */}
        <div className="rounded-sm px-1 -mx-1 transition-colors hover:bg-card/30 cursor-default">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/40">
            <span className="text-muted-foreground/60">claude</span>
            <span>12:58 AM</span>
          </div>
          <div className="text-[11px] leading-relaxed text-foreground">
            Sure, here's a test message: just checking that things work end-to-end.
          </div>
        </div>

        {/* user message */}
        <div className="rounded-sm px-1 -mx-1 transition-colors hover:bg-card/30 cursor-default">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/40">
            <span className="text-primary-bright/70">you</span>
            <span>2h ago</span>
          </div>
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            pls create any sample file in the repo. for testing
          </div>
        </div>

        {/* claude message with tool call */}
        <div className="rounded-sm px-1 -mx-1 transition-colors hover:bg-card/30 cursor-default">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/40">
            <span className="text-muted-foreground/60">claude</span>
            <span>2h ago</span>
            <span className="text-muted-foreground/25">1 tool · 1 file</span>
          </div>
          <div
            className="my-1 inline-flex items-center gap-1 rounded-sm bg-card px-2 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:bg-card/80 cursor-pointer"
            style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
          >
            <span>📄</span>
            <span className="font-mono">Write</span>
            <span className="text-muted-foreground/30 truncate">/kodeck/test-sample.txt</span>
            <span className="text-green-400">✓</span>
          </div>
          <div className="text-[11px] leading-relaxed text-foreground">
            Done — created{" "}
            <code className="rounded-sm bg-secondary px-1 py-px font-mono text-[10px] text-primary-bright">
              test-sample.txt
            </code>{" "}
            in the repo root.
          </div>
        </div>

        {/* user message */}
        <div className="rounded-sm px-1 -mx-1 transition-colors hover:bg-card/30 cursor-default">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/40">
            <span className="text-primary-bright/70">you</span>
            <span>1h ago</span>
          </div>
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            cool. can you pls create any file, then make a change in it?
          </div>
        </div>

        {/* claude message with multiple tools */}
        <div className="rounded-sm px-1 -mx-1 transition-colors hover:bg-card/30 cursor-default">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/40">
            <span className="text-muted-foreground/60">claude</span>
            <span>1h ago</span>
            <span className="text-muted-foreground/25">opus-4-6 · 3 tools · $0.42</span>
          </div>
          <div className="my-1 flex flex-col gap-0.5">
            <div
              className="inline-flex items-center gap-1 rounded-sm bg-card px-2 py-1 text-[10px] text-muted-foreground/50 w-fit transition-colors hover:bg-card/80 cursor-pointer"
              style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
            >
              <span>📄</span>
              <span className="font-mono">Write</span>
              <span className="text-muted-foreground/30 truncate">/kodeck/test.txt</span>
              <span className="text-green-400">✓</span>
            </div>
            <div
              className="inline-flex items-center gap-1 rounded-sm bg-card px-2 py-1 text-[10px] text-muted-foreground/50 w-fit transition-colors hover:bg-card/80 cursor-pointer"
              style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
            >
              <span>✏️</span>
              <span className="font-mono">Edit</span>
              <span className="text-muted-foreground/30 truncate">/kodeck/test.txt</span>
              <span className="text-green-400">✓</span>
            </div>
          </div>
          <div className="text-[11px] leading-relaxed text-foreground">
            Done — created{" "}
            <code className="rounded-sm bg-secondary px-1 py-px font-mono text-[10px] text-primary-bright">
              test.txt
            </code>{" "}
            then edited it.
          </div>
        </div>

        {/* live streaming indicator — claude is thinking */}
        <div className="rounded-sm px-1 -mx-1">
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground/40">
            <span className="text-muted-foreground/60">claude</span>
            <span>just now</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
            <span className="font-mono text-primary-bright/60 w-3 text-center">{spinner}</span>
            <span>Reading project files…</span>
          </div>
          <div
            className="my-1 inline-flex items-center gap-1 rounded-sm bg-card px-2 py-1 text-[10px] text-muted-foreground/50"
            style={{ border: "1px solid oklch(47.3% 0.137 46.201 / 0.15)" }}
          >
            <span className="font-mono text-primary-bright/60 w-3 text-center">{spinner}</span>
            <span className="font-mono">Read</span>
            <span className="text-muted-foreground/30 truncate">/kodeck/src/app.tsx</span>
          </div>
        </div>
      </div>

      {/* input bar */}
      <div className="px-3 py-2" style={{ borderTop: "1px solid oklch(100% 0 0 / 0.06)" }}>
        <div
          className="flex items-center rounded-sm bg-card px-2.5 py-1.5 transition-colors hover:bg-card/80 cursor-text"
          style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
        >
          <span className="text-[11px] text-muted-foreground/50 font-mono">
            {typedText}
            <span
              className="inline-block w-[5px] h-[12px] bg-primary-bright/70 align-middle ml-px"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          </span>
          <div className="ml-auto flex items-center gap-2 text-[9px] text-muted-foreground/25">
            <span className="cursor-pointer transition-colors hover:text-muted-foreground/50">
              ⌘F
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-primary text-[8px] text-primary-foreground cursor-pointer transition-all hover:brightness-110">
              →
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] text-muted-foreground/20">
          <span>Enter to send · Shift+Enter for newline</span>
          <span className="cursor-pointer transition-colors hover:text-muted-foreground/40">
            🗑 Clean chat
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── terminal panel (right split) ── */
function TerminalPanel() {
  const spinner = useSpinner(100);

  return (
    <div className="hidden md:flex flex-1 flex-col overflow-hidden">
      {/* tab bar */}
      <div
        className="flex h-9 items-center gap-0 bg-background px-1.5"
        style={{ borderBottom: "1px solid oklch(100% 0 0 / 0.06)" }}
      >
        <div className="flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-[10px] text-foreground cursor-pointer transition-colors hover:bg-secondary/80">
          <Terminal className="h-2.5 w-2.5" />
          <span>Terminal</span>
          <span className="text-muted-foreground/40">*2</span>
          <span className="ml-0.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground">
            &times;
          </span>
        </div>
        <div className="ml-1 flex items-center gap-2 text-[10px] text-muted-foreground/30">
          <span className="cursor-pointer transition-colors hover:text-muted-foreground/50">
            + Terminal
          </span>
        </div>
      </div>

      {/* terminal output */}
      <div className="flex flex-1 flex-col overflow-hidden px-3 py-2.5 font-mono text-[10px] leading-relaxed">
        <div className="text-muted-foreground/30">~/Projects/kodeck</div>
        <div className="mt-1">
          <span className="text-primary-bright">$</span>{" "}
          <span className="text-foreground/80">pnpm dev</span>
        </div>
        <div className="mt-2 text-muted-foreground/40">
          <div>vite v8.0.1 dev server running at:</div>
          <div className="mt-0.5">
            {"  "}Local: <span className="text-primary-bright">http://localhost:5173/</span>
          </div>
          <div>
            {"  "}Network: <span className="text-muted-foreground/25">use --host to expose</span>
          </div>
        </div>
        <div className="mt-2 text-muted-foreground/30">
          <div>
            ready in <span className="text-foreground/60">184ms</span>
          </div>
        </div>
        <div className="mt-3">
          <span className="text-primary-bright">$</span>{" "}
          <span className="text-foreground/80">pnpm test</span>
        </div>
        <div className="mt-1 text-muted-foreground/40">
          <div className="flex items-center gap-1">
            <span className="text-primary-bright/60">{spinner}</span>
            <span>Running 47 tests...</span>
          </div>
          <div className="mt-0.5 text-green-400/60">{"  "}PASS src/utils.test.ts (12 tests)</div>
          <div className="text-green-400/60">{"  "}PASS src/store.test.ts (8 tests)</div>
          <div className="text-green-400/60">{"  "}PASS src/api.test.ts (15 tests)</div>
          <div className="flex items-center gap-1">
            <span className="text-primary-bright/60">{spinner}</span>
            <span>src/components.test.tsx</span>
          </div>
        </div>
        <div className="mt-3">
          <span className="text-primary-bright">$</span>{" "}
          <span className="text-foreground/80">git status</span>
        </div>
        <div className="mt-1 text-muted-foreground/40">
          <div>
            On branch <span className="text-foreground/60">main</span>
          </div>
          <div>Changes not staged for commit:</div>
          <div className="text-amber-400/60">{"  "}modified: pnpm-lock.yaml</div>
          <div className="text-amber-400/60">{"  "}modified: skills-lock.json</div>
          <div className="mt-0.5">Untracked files:</div>
          <div className="text-green-400/60">{"  "}apps/landing/</div>
        </div>

        {/* prompt line with blinking cursor */}
        <div className="mt-3 flex items-center">
          <span className="text-primary-bright">$</span>
          <span
            className="ml-1 inline-block w-[5px] h-[11px] bg-foreground/50"
            style={{ animation: "blink 1s step-end infinite" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── center split area (chat + terminal) ── */
function CenterSplit() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatPanel />
      <div className="w-px bg-ghost hidden md:block" />
      <TerminalPanel />
    </div>
  );
}

/* ── right config sidebar (matches real product) ── */
function ConfigSidebar() {
  const [ctx, setCtx] = useState(47);
  useEffect(() => {
    const id = setInterval(() => setCtx((c) => (c >= 52 ? 47 : c + 1)), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="hidden lg:flex h-full w-40 shrink-0 flex-col overflow-hidden bg-background font-mono text-[9px] text-muted-foreground/50 px-2.5 py-2.5"
      style={{ borderLeft: "1px solid oklch(100% 0 0 / 0.06)" }}
    >
      {/* parameters */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-foreground cursor-pointer transition-colors hover:text-primary-bright/80">
          <span>PARAMETERS</span>
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/30" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="cursor-pointer transition-colors hover:text-foreground/90">
            <span className="text-muted-foreground/30">MODEL</span>
            <br />
            <span className="text-foreground/80">Opus 4.6</span>
          </div>
          <div className="cursor-pointer transition-colors hover:text-foreground/90">
            <span className="text-muted-foreground/30">EFFORT</span>
            <br />
            <span className="text-primary-bright">● High</span>
          </div>
          <div className="cursor-pointer transition-colors hover:text-foreground/90">
            <span className="text-muted-foreground/30">STREAMING</span>
            <br />
            <span className="text-foreground/80">(w) Live</span>
          </div>
          <div className="cursor-pointer transition-colors hover:text-foreground/90">
            <span className="text-muted-foreground/30">PERMISSIONS</span>
            <br />
            <span className="text-foreground/80">⊘ Allow all</span>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-foreground cursor-pointer transition-colors hover:text-primary-bright/80">
          <span>STATS</span>
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/30" />
        </div>
        <div className="flex flex-col gap-1">
          <div>
            <span className="text-muted-foreground/30">CONTEXT</span>
            <br />
            <span className="text-foreground/80 tabular-nums">{ctx}k / 200k</span>
          </div>
          <div>
            <span className="text-muted-foreground/30">COST</span>
            <br />
            <span className="text-foreground/80">$0.42</span>
          </div>
          <div>
            <span className="text-muted-foreground/30">MESSAGES</span>
            <br />
            <span className="text-foreground/80">12 user · 10 claude</span>
          </div>
        </div>
      </div>

      {/* configs */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-foreground cursor-pointer transition-colors hover:text-primary-bright/80">
          <span>CONFIGS</span>
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/30" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground/30">CLAUDE.MD</span>
          <span className="pl-1 cursor-pointer transition-colors hover:text-foreground/80">
            CLAUDE.md
          </span>
          <span className="pl-1 cursor-pointer transition-colors hover:text-foreground/80">
            CLAUDE.md ~
          </span>
          <span className="mt-0.5 text-muted-foreground/30 cursor-pointer transition-colors hover:text-muted-foreground/50">
            ▸ COMMANDS (42)
          </span>
          <span className="text-muted-foreground/30 cursor-pointer transition-colors hover:text-muted-foreground/50">
            ▸ AGENTS (16)
          </span>
          <span className="text-muted-foreground/30 cursor-pointer transition-colors hover:text-muted-foreground/50">
            ▸ HOOKS (11)
          </span>
          <span className="mt-0.5 text-muted-foreground/30">MCPS</span>
          <span className="pl-1 cursor-pointer transition-colors hover:text-foreground/80">
            chrome-devtools ~
          </span>
          <span className="pl-1 cursor-pointer transition-colors hover:text-foreground/80">
            figma ~
          </span>
          <span className="pl-1 cursor-pointer transition-colors hover:text-foreground/80">
            linear-server ~
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── app mockup (3-panel layout) ── */
function AppMockup() {
  return (
    <div
      className="overflow-hidden rounded-t-lg shadow-[0_0_80px_-20px_oklch(47.3%_0.137_46.201_/_0.08)]"
      style={{ border: "1px solid oklch(100% 0 0 / 0.06)", borderBottom: "none" }}
    >
      {/* window chrome */}
      <div
        className="flex items-center gap-2 bg-card px-4 py-2.5"
        style={{ borderBottom: "1px solid oklch(100% 0 0 / 0.06)" }}
      >
        <span className="h-3 w-3 rounded-full bg-[#ff5f57] transition-opacity hover:opacity-80 cursor-pointer" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e] transition-opacity hover:opacity-80 cursor-pointer" />
        <span className="h-3 w-3 rounded-full bg-[#28c840] transition-opacity hover:opacity-80 cursor-pointer" />
        <span className="ml-auto font-mono text-[9px] text-muted-foreground/20">
          Kodeck — ~/Projects/kodeck
        </span>
      </div>
      {/* 3-panel body with split center */}
      <div className="flex h-[28rem] bg-background md:h-[34rem]">
        <SidebarMockup />
        <div className="w-px bg-ghost hidden md:block" />
        <CenterSplit />
        <ConfigSidebar />
      </div>
    </div>
  );
}

/* ── feature card ── */
function FeatureCard({
  illustration,
  title,
  description,
  delay = 0,
}: {
  illustration: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <div
      className="reveal group cursor-default rounded-lg bg-card/50 p-7 transition-colors hover:bg-card"
      style={{ transitionDelay: `${delay}ms`, border: "1px solid oklch(100% 0 0 / 0.06)" }}
    >
      <div className="mb-5">{illustration}</div>
      <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/* ── coming soon card ── */
function ComingSoonCard({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <div
      className="reveal rounded-lg p-7"
      style={{ transitionDelay: `${delay}ms`, border: "1px solid oklch(100% 0 0 / 0.12)", background: "oklch(20% 0.005 260 / 0.85)" }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className="inline-flex rounded-sm p-3"
          style={{ border: "1px solid oklch(100% 0 0 / 0.1)" }}
        >
          {icon}
        </div>
        <span
          className="inline-flex items-center rounded-sm px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider text-primary-bright uppercase"
          style={{ border: "1px solid oklch(47.3% 0.137 46.201 / 0.2)" }}
        >
          Soon
        </span>
      </div>
      <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/* ── terminal snippet ── */
function TerminalSnippet() {
  return (
    <div
      className="inline-block max-w-full overflow-hidden rounded-lg text-left"
      style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
    >
      <div
        className="flex items-center gap-2 bg-card px-4 py-2.5"
        style={{ borderBottom: "1px solid oklch(100% 0 0 / 0.06)" }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="space-y-1 bg-background p-6 font-mono text-sm leading-7 md:p-8 [overflow-wrap:anywhere]">
        <div>
          <span className="text-primary-bright">$</span>{" "}
          <span className="text-foreground">npx kodeck-app</span>
        </div>
        <div className="pt-2">
          <span className="text-muted-foreground/60">{"  "}kodeck running at </span>
          <span className="text-primary-bright">https://kodeck.localhost:1355</span>
        </div>
      </div>
    </div>
  );
}

/* ── section divider ── */
function Divider() {
  return (
    <div
      className="mx-auto h-px max-w-6xl"
      style={{
        background: "linear-gradient(90deg, transparent, oklch(100% 0 0 / 0.06) 50%, transparent)",
      }}
      aria-hidden="true"
    />
  );
}

/* ── main app ── */
export function App() {
  useReveal();

  return (
    <div className="dot-grid min-h-screen">
      <Nav />

      {/* ── hero ── */}
      <section className="relative pt-36 md:pt-48">
        {/* shader background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <GrainGradient
            colors={["#c6750c", "#beae60", "#d7cbc6"]}
            colorBack="#000a0f"
            softness={0.7}
            intensity={0.15}
            noise={0.5}
            shape="wave"
            speed={1.14}
            style={{ width: "100%", height: "130%" }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-8">
          <div className="max-w-3xl">
            {/* npx command */}
            <div className="reveal relative mb-8 inline-flex items-center gap-3">
              <code
                className="inline-flex items-center gap-2 rounded-md bg-card px-4 py-2 font-mono text-sm text-primary-bright"
                style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <span className="text-muted-foreground/50">$</span> npx kodeck-app
              </code>
              <button
                type="button"
                className="cursor-pointer rounded-md bg-card p-2 text-muted-foreground transition-colors hover:text-primary-bright"
                style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
                onClick={() => {
                  navigator.clipboard.writeText("npx kodeck-app");
                  const el = document.getElementById("copy-ok");
                  if (el) {
                    el.style.opacity = "1";
                    setTimeout(() => {
                      el.style.opacity = "0";
                    }, 1500);
                  }
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <span className="font-mono text-[11px] tracking-wider text-muted-foreground/40 uppercase">
                Early alpha
              </span>
              <span
                id="copy-ok"
                className="absolute -bottom-6 left-0 text-xs text-primary-bright transition-opacity duration-300"
                style={{ opacity: 0 }}
              >
                Copied!
              </span>
            </div>

            {/* headline */}
            <h1
              className="reveal mb-6 text-4xl leading-[1.1] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
              style={{
                fontFamily: '"GeistPixelGrid"',
                transitionDelay: "80ms",
              }}
            >
              Your command center
              <br />
              for <span className="text-primary-bright">Claude Code</span>
            </h1>

            {/* subheadline */}
            <p
              className="reveal mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
              style={{ transitionDelay: "140ms" }}
            >
              Multi-project IDE built around the Claude CLI. Manage sessions, git worktrees, and
              terminals &mdash; all in one clean interface.
            </p>

            {/* CTAs */}
            <div className="reveal flex flex-wrap gap-4" style={{ transitionDelay: "200ms" }}>
              <a
                href="#get-started"
                className="inline-flex cursor-pointer items-center gap-2.5 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                <Terminal className="h-4 w-4" />
                Get Started
              </a>
              <a
                href="https://github.com/vladzima/kodeck"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-2.5 rounded-sm bg-transparent px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                View Source
              </a>
            </div>
          </div>

          {/* app mockup */}
          <div className="reveal mt-20 -mb-px md:mt-24" style={{ transitionDelay: "320ms" }}>
            <AppMockup />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── features bento ── */}
      <section id="features" className="py-28 md:py-36">
        <div className="mx-auto max-w-6xl px-8">
          <div className="reveal mb-16 text-center">
            <span className="font-mono text-xs tracking-widest text-primary-bright uppercase">
              Features
            </span>
            <h2
              className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: '"GeistPixelGrid"' }}
            >
              Everything you need, nothing you don't
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
              Purpose-built for developers who live in the terminal and think in worktrees.
            </p>
          </div>

          {/* bento grid — no row-span, clean 3-col rows */}
          <div className="flex flex-col gap-5">
            {/* ── ROW 1: hero + two accent cards ── */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
              {/* Missing Client — 3/5 */}
              <div
                className="reveal relative overflow-hidden rounded-lg p-8 lg:col-span-3"
                style={{
                  border: "1px solid oklch(100% 0 0 / 0.06)",
                }}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  <Dithering
                    colorBack="#000000"
                    colorFront="#241600"
                    shape="wave"
                    type="random"
                    size={6.6}
                    speed={1}
                    scale={1.2}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
                <div className="relative z-10">
                  <span
                    className="mb-4 inline-flex items-center rounded-sm bg-primary/15 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider text-primary-bright uppercase"
                    style={{ border: "1px solid oklch(47.3% 0.137 46.201 / 0.2)" }}
                  >
                    The missing piece
                  </span>
                  <h3
                    className="mb-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl"
                    style={{ fontFamily: "var(--font-brand)" }}
                  >
                    The client Claude Code
                    <br />
                    never shipped
                  </h3>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
                    Claude Code is a powerful CLI — but it has no GUI. Kodeck gives it one.
                    Multi-project management, visual configs, searchable history, and a real
                    interface — everything the CLI should have had from day one.
                  </p>
                </div>
              </div>

              {/* Right stack — 2/5, two cards stacked */}
              <div className="flex flex-col gap-5 lg:col-span-2">
                {/* Free & OSS */}
                <div
                  className="reveal flex flex-1 items-start gap-5 rounded-lg p-7"
                  style={{
                    border: "1px solid oklch(100% 0 0 / 0.06)",
                    background: "oklch(21% 0.006 285.885)",
                  }}
                >
                  <div
                    className="shrink-0 flex h-11 w-11 items-center justify-center rounded-sm bg-primary/15"
                    style={{ border: "1px solid oklch(47.3% 0.137 46.201 / 0.2)" }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="var(--color-primary-bright)" d="M5 2h4v2H7v2H5zm0 10H3V6h2zm2 2H5v-2h2zm2 2v-2H7v2H3v-2H1v2h2v2h4v4h2v-4h2v-2zm0 0v2H7v-2zm6-12v2H9V4zm4 2h-2V4h-2V2h4zm0 6V6h2v6zm-2 2v-2h2v2zm-2 2v-2h2v2zm0 2h-2v-2h2zm0 0h2v4h-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-1 text-base font-semibold text-foreground">
                      Free & Open Source
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      MIT licensed. No telemetry, no accounts, no paywalls. Your tools should belong
                      to you.
                    </p>
                  </div>
                </div>
                {/* DX First */}
                <div
                  className="reveal flex flex-1 items-start gap-5 rounded-lg p-7"
                  style={{
                    border: "1px solid oklch(100% 0 0 / 0.06)",
                    background: "oklch(21% 0.006 285.885)",
                  }}
                >
                  <div
                    className="shrink-0 flex h-11 w-11 items-center justify-center rounded-sm bg-primary/15"
                    style={{ border: "1px solid oklch(47.3% 0.137 46.201 / 0.2)" }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="var(--color-primary-bright)" d="M8 5h2v2H8zM6 7h2v2H6zM4 9h2v2H4zm-2 2h2v2H2zm2 2h2v2H4zm2 2h2v2H6zm2 2h2v2H8zm8-12h-2v2h2zm2 2h-2v2h2zm2 2h-2v2h2zm2 2h-2v2h2zm-2 2h-2v2h2zm-2 2h-2v2h2zm-2 2h-2v2h2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-1 text-base font-semibold text-foreground">DX First</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Keyboard-driven, fast renders, zero config to start. If it slows you down, it
                      doesn't ship.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 2: workspace (wide) + search + claude ── */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {/* Multi-Project Workspace — 2/4 */}
              <div
                className="reveal group cursor-default overflow-hidden rounded-lg bg-card/50 transition-colors hover:bg-card md:col-span-2"
                style={{ border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <div className="flex items-center justify-center bg-background/50 px-8 py-8">
                  <svg
                    viewBox="0 0 80 64"
                    fill="none"
                    className="feat-anim h-40 w-full max-w-xs"
                    aria-hidden="true"
                  >
                    <rect
                      x="4"
                      y="8"
                      width="30"
                      height="22"
                      rx="2"
                      fill="var(--color-card)"
                      style={{ animation: "float 4s ease-in-out infinite" }}
                    />
                    <rect
                      x="46"
                      y="4"
                      width="30"
                      height="22"
                      rx="2"
                      fill="var(--color-card)"
                      style={{ animation: "float 4s ease-in-out infinite 0.6s" }}
                    />
                    <rect
                      x="4"
                      y="36"
                      width="30"
                      height="22"
                      rx="2"
                      fill="var(--color-card)"
                      style={{ animation: "float 4s ease-in-out infinite 1.2s" }}
                    />
                    <rect
                      x="46"
                      y="38"
                      width="30"
                      height="22"
                      rx="2"
                      fill="var(--color-card)"
                      style={{ animation: "float 4s ease-in-out infinite 1.8s" }}
                    />
                    <circle
                      cx="8"
                      cy="12"
                      r="1.5"
                      fill="var(--color-primary-bright)"
                      style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
                    />
                    <rect
                      x="12"
                      y="13"
                      width="18"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.2"
                    />
                    <rect
                      x="12"
                      y="18"
                      width="12"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.15"
                    />
                    <rect
                      x="54"
                      y="9"
                      width="18"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.2"
                    />
                    <rect
                      x="54"
                      y="14"
                      width="14"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.15"
                    />
                    <line
                      x1="34"
                      y1="19"
                      x2="46"
                      y2="15"
                      stroke="var(--color-primary)"
                      strokeWidth="0.5"
                      opacity="0.3"
                      strokeDasharray="3 2"
                      style={{ animation: "dash-flow 2s linear infinite" }}
                    />
                    <line
                      x1="34"
                      y1="47"
                      x2="46"
                      y2="49"
                      stroke="var(--color-primary)"
                      strokeWidth="0.5"
                      opacity="0.3"
                      strokeDasharray="3 2"
                      style={{ animation: "dash-flow 2s linear infinite 0.5s" }}
                    />
                  </svg>
                </div>
                <div className="p-7">
                  <h3 className="mb-2 text-base font-semibold text-foreground">
                    Multi-Project Workspace
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Register any number of repositories. Navigate projects, worktrees, and branches
                    from a unified sidebar.
                  </p>
                </div>
              </div>
              {/* Advanced Search — 1/4 */}
              <div
                className="reveal group cursor-default rounded-lg bg-card/50 p-7 transition-colors hover:bg-card"
                style={{ transitionDelay: "60ms", border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <div className="mb-4">
                  <IllustrationSearch />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">Advanced Search</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Search across all sessions, messages, and projects instantly.
                </p>
              </div>
              {/* Built for Claude Code — 1/4 */}
              <div
                className="reveal group cursor-default rounded-lg bg-card/50 p-7 transition-colors hover:bg-card"
                style={{ transitionDelay: "120ms", border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <div className="mb-4">
                  <IllustrationClaude />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Built for Claude Code
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Deep CLI integration. Streaming responses, tool call cards, permission prompts —
                  rendered natively.
                </p>
              </div>
            </div>

            {/* ── ROW 3: config + terminal+chat (wide) + platform ── */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {/* Config Browser — 1/4 */}
              <div
                className="reveal group cursor-default rounded-lg bg-card/50 p-7 transition-colors hover:bg-card"
                style={{ transitionDelay: "180ms", border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <div className="mb-4">
                  <IllustrationConfig />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">Config Browser</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Visual read-only view of your Claude configurations, permissions, and hooks.
                </p>
              </div>
              {/* Terminal + Chat — 2/4 */}
              <div
                className="reveal group cursor-default overflow-hidden rounded-lg bg-card/50 transition-colors hover:bg-card md:col-span-2"
                style={{ transitionDelay: "240ms", border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <div className="flex items-center justify-center bg-background/50 px-8 py-8">
                  <svg
                    viewBox="0 0 80 64"
                    fill="none"
                    className="feat-anim h-40 w-full max-w-xs"
                    aria-hidden="true"
                  >
                    <rect x="4" y="8" width="34" height="48" rx="2" fill="var(--color-card)" />
                    <rect
                      x="8"
                      y="14"
                      width="3"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-primary-bright)"
                      opacity="0.7"
                    />
                    <rect
                      x="13"
                      y="14"
                      width="16"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-foreground)"
                      opacity="0.2"
                    />
                    <rect
                      x="8"
                      y="20"
                      width="22"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.15"
                    />
                    <rect
                      x="8"
                      y="25"
                      width="18"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.12"
                    />
                    <rect
                      x="8"
                      y="30"
                      width="3"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-primary-bright)"
                      opacity="0.7"
                    />
                    <rect
                      x="13"
                      y="30"
                      width="12"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-foreground)"
                      opacity="0.2"
                    />
                    <rect x="42" y="8" width="34" height="48" rx="2" fill="var(--color-card)" />
                    <rect
                      x="54"
                      y="14"
                      width="18"
                      height="8"
                      rx="2"
                      fill="var(--color-secondary)"
                    />
                    <rect
                      x="46"
                      y="26"
                      width="22"
                      height="10"
                      rx="2"
                      fill="var(--color-background)"
                      stroke="var(--color-muted-foreground)"
                      strokeWidth="0.5"
                      opacity="0.5"
                    />
                    <rect
                      x="50"
                      y="30"
                      width="14"
                      height="1.5"
                      rx="0.75"
                      fill="var(--color-muted-foreground)"
                      opacity="0.2"
                      style={{ animation: "slide-in 2.5s ease-out infinite" }}
                    />
                    <rect
                      x="38"
                      y="8"
                      width="4"
                      height="48"
                      fill="var(--color-background)"
                      opacity="0.5"
                    />
                    <circle
                      cx="40"
                      cy="32"
                      r="2"
                      fill="var(--color-primary)"
                      opacity="0.15"
                      style={{
                        animation: "scale-pulse 3s ease-in-out infinite",
                        transformOrigin: "40px 32px",
                      }}
                    />
                  </svg>
                </div>
                <div className="p-7">
                  <h3 className="mb-2 text-base font-semibold text-foreground">Terminal + Chat</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Side-by-side terminal and chat sessions per worktree. Full PTY support with
                    WebGL-accelerated rendering.
                  </p>
                </div>
              </div>
              {/* Browser or Desktop — 1/4 */}
              <div
                className="reveal group cursor-default rounded-lg bg-card/50 p-7 transition-colors hover:bg-card"
                style={{ transitionDelay: "300ms", border: "1px solid oklch(100% 0 0 / 0.06)" }}
              >
                <div className="mb-4">
                  <IllustrationPlatform />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">Browser or Desktop</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Run in any browser or install as a native macOS app. Same experience, your choice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── coming soon ── */}
      <section id="roadmap" className="py-28 md:py-36">
        <div className="mx-auto max-w-6xl px-8">
          <div className="reveal mb-16 text-center">
            <span className="font-mono text-xs tracking-widest text-primary-bright uppercase">
              Roadmap
            </span>
            <h2
              className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: '"GeistPixelGrid"' }}
            >
              What's next
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
              We're building the tools developers actually want. Here's what's coming.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-3">
            <ComingSoonCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="var(--color-primary-bright)" d="M13 2h-2v4h2zm2 6H9v2H7v4h2v4h6v-4h2v-4h-2zm0 2v4h-2v2h-2v-2H9v-4zM9 20h6v2H9zm14-9v2h-4v-2zM5 13v-2H1v2zm12-7h2v2h-2zm2 0h2V4h-2zM5 6h2v2H5zm0 0V4H3v2z" /></svg>}
              title="Smart Recommendations"
              description="Context-aware suggestions that learn your workflow. Get relevant actions, files, and commands surfaced automatically."
            />
            <ComingSoonCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="var(--color-primary-bright)" d="M4 2h18v16H6v2H4v-2h2v-2h14V4H4v18H2V2zm5 7H7v2h2zm2 0h2v2h-2zm6 0h-2v2h2z" /></svg>}
              title="Telegram Integration"
              description="Monitor sessions and interact with Claude directly from Telegram. Notifications, approvals, and quick commands on the go."
              delay={80}
            />
            <ComingSoonCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="var(--color-primary-bright)" d="M15 2h2v2h4v18H3V4h4V2h2v2h6zM9 6H5v2h14V6zm-4 4v10h14V10zm6 2h2v2h2v2h-2v2h-2v-2H9v-2h2z" /></svg>}
              title="Intelligent Plugins"
              description="On-the-fly plugin recommendations tailored to your current context. The right tools, exactly when you need them."
              delay={160}
            />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── get started ── */}
      <section id="get-started" className="py-28 md:py-36">
        <div className="mx-auto max-w-6xl px-8 text-center">
          <div className="reveal">
            <span className="font-mono text-xs tracking-widest text-primary-bright uppercase">
              Get Started
            </span>
            <h2
              className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
              style={{ fontFamily: '"GeistPixelGrid"' }}
            >
              One command away
            </h2>
            <p className="mx-auto mt-4 mb-12 max-w-md text-base text-muted-foreground">
              Run one command. Requires Node.js 22+ and Claude Code authentication.
            </p>
          </div>

          <div className="reveal" style={{ transitionDelay: "100ms" }}>
            <TerminalSnippet />
          </div>

          <div
            className="reveal mt-12 flex flex-wrap justify-center gap-4"
            style={{ transitionDelay: "200ms" }}
          >
            <a
              href="https://github.com/vladzima/kodeck"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <GithubIcon />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="py-10" style={{ borderTop: "1px solid oklch(100% 0 0 / 0.06)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <KodeckLogo size={22} />
            <span
              className="text-sm tracking-[0.2em] text-muted-foreground uppercase"
              style={{ fontFamily: "var(--font-brand)" }}
            >
              kodeck
            </span>
            <span className="text-xs text-muted-foreground/30">
              by{" "}
              <a
                href="https://github.com/vladzima"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/50 transition-colors hover:text-primary-bright"
              >
                Vlad Arbatov
              </a>
            </span>
          </div>
          <p className="text-xs text-muted-foreground/50">Open source under MIT License</p>
        </div>
      </footer>
    </div>
  );
}
