import { useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../store.ts";
import { performSearch, type SearchScope } from "../search-utils.ts";

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    setSearchOpen,
    setSearchResults,
    setSearchResultsTabOpen,
    setSearchTabSelected,
    setSearchQuery,
    searchQuery,
    searchScope,
    setSearchScope,
  } = useAppStore();
  const resultCount = useAppStore((s) => s.searchResults.length);
  const searchTabSelected = useAppStore((s) => s.searchTabSelected);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [setSearchOpen]);

  const runSearch = useCallback(
    (q: string, s: SearchScope) => {
      const state = useAppStore.getState();
      const results = performSearch(q, s, state);
      setSearchResults(results);
      setSearchQuery(q);
      if (q.trim()) {
        setSearchResultsTabOpen(true);
        setSearchTabSelected(true);
      }
    },
    [setSearchResults, setSearchResultsTabOpen, setSearchTabSelected, setSearchQuery],
  );

  const handleInput = (value: string) => {
    setSearchQuery(value);
    runSearch(value, searchScope);
  };

  const handleScopeChange = (newScope: SearchScope) => {
    setSearchScope(newScope);
    runSearch(searchQuery, newScope);
  };

  const scopes: { value: SearchScope; label: string; disabled?: boolean }[] = [
    { value: "session", label: "This chat", disabled: searchTabSelected },
    { value: "project", label: "This project" },
    { value: "all", label: "All projects" },
  ];

  return (
    <div className="flex items-center gap-3 border-b border-border bg-background px-3 py-1.5">
      <div className="flex items-center gap-0.5 rounded-md border border-border text-[11px]">
        {scopes.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={s.disabled}
            className={`px-2 py-0.5 transition-colors ${
              searchScope === s.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            } ${s.value === "session" ? "rounded-l-md" : ""} ${s.value === "all" ? "rounded-r-md" : ""} ${s.disabled ? "opacity-30" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleScopeChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Search messages..."
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
      />
      <span className="text-[11px] text-muted-foreground/40">
        {searchQuery.trim() ? `${resultCount} results` : ""}
      </span>
      <button
        type="button"
        className="rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          handleInput("");
          inputRef.current?.focus();
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
