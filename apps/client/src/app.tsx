import { useWebSocket } from "./hooks/use-websocket.ts";
import { useAppStore } from "./store.ts";
import { Sidebar } from "./components/sidebar.tsx";
import { TabBar } from "./components/tab-bar.tsx";
import { MainPanel } from "./components/main-panel.tsx";

export function App() {
  useWebSocket();
  const connected = useAppStore((s) => s.connected);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <MainPanel />
        </div>
        {!connected && (
          <div className="border-t border-destructive bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
            Disconnected from server. Reconnecting...
          </div>
        )}
      </div>
    </div>
  );
}
