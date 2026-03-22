import { useEffect } from "react";
import { useAppStore } from "../store.ts";

export function Notifications() {
  const notifications = useAppStore((s) => s.notifications);
  const removeNotification = useAppStore((s) => s.removeNotification);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onDismiss={() => removeNotification(n.id)}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: { id: string; message: string; type: "success" | "error" };
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`max-w-sm rounded-lg border px-3 py-2 text-xs shadow-lg ${
        notification.type === "error"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border bg-background text-foreground"
      }`}
    >
      {notification.message}
    </div>
  );
}
