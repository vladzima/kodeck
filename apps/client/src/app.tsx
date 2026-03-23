import { useEffect } from "react";
import { useWebSocket } from "./hooks/use-websocket.ts";
import { useAppStore } from "./store.ts";
import { Sidebar } from "./components/sidebar.tsx";
import { TabBar } from "./components/tab-bar.tsx";
import { SearchBar } from "./components/search-bar.tsx";
import { MainPanel } from "./components/main-panel.tsx";
import { WorktreeCreateModal } from "./components/worktree-create-modal.tsx";
import { Notifications } from "./components/notifications.tsx";

export function App() {
  useWebSocket();
  const connected = useAppStore((s) => s.connected);
  const searchOpen = useAppStore((s) => s.searchOpen);

  // Cmd+F (Mac) / Ctrl+F (other) to toggle search bar
  // Must use capture phase to intercept before the browser opens its own find bar
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        const { searchOpen, setSearchOpen } = useAppStore.getState();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TabBar />
        {searchOpen && <SearchBar />}
        <div className="flex-1 overflow-hidden">
          <MainPanel />
        </div>
        {!connected && (
          <div className="border-t border-destructive bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
            Disconnected from server. Reconnecting...
          </div>
        )}
      </div>
      <WorktreeCreateModal />
      <Notifications />
    </div>
  );
}
