import { describe, it, expect } from "vitest";
import { buildFileTree } from "./file-tree.ts";
import type { WorktreeFileChange } from "@kodeck/shared";

describe("buildFileTree", () => {
  it("returns empty array for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("handles a single root-level file", () => {
    const files: WorktreeFileChange[] = [{ path: "readme.md", status: "M" }];
    const tree = buildFileTree(files);
    expect(tree).toEqual([{ name: "readme.md", status: "M", children: [] }]);
  });

  it("groups files under a directory", () => {
    const files: WorktreeFileChange[] = [
      { path: "src/a.ts", status: "M" },
      { path: "src/b.ts", status: "A" },
    ];
    const tree = buildFileTree(files);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("src");
    expect(tree[0].status).toBeUndefined();
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0]).toEqual({ name: "a.ts", status: "M", children: [] });
    expect(tree[0].children[1]).toEqual({ name: "b.ts", status: "A", children: [] });
  });

  it("compacts single-child directories", () => {
    const files: WorktreeFileChange[] = [{ path: "apps/client/src/index.ts", status: "M" }];
    const tree = buildFileTree(files);
    // apps → client → src should compact to "apps/client/src"
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("apps/client/src");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("index.ts");
  });

  it("does not compact when directory has multiple children", () => {
    const files: WorktreeFileChange[] = [
      { path: "src/a.ts", status: "M" },
      { path: "lib/b.ts", status: "M" },
    ];
    const tree = buildFileTree(files);
    expect(tree).toHaveLength(2);
    // Each has a single file, so src and lib are compacted with their children dirs if any
    // But src only has a.ts (leaf), so no further compaction
    expect(tree.find((n) => n.name === "src")).toBeDefined();
    expect(tree.find((n) => n.name === "lib")).toBeDefined();
  });

  it("handles mixed depths", () => {
    const files: WorktreeFileChange[] = [
      { path: "apps/client/src/components/sidebar.tsx", status: "M" },
      { path: "apps/client/src/components/tab-bar.tsx", status: "M" },
      { path: "apps/server/src/projects.ts", status: "M" },
      { path: "readme.md", status: "A" },
    ];
    const tree = buildFileTree(files);
    // Should have "apps" and "readme.md" at top level
    expect(tree).toHaveLength(2);

    const apps = tree.find((n) => n.name === "apps");
    expect(apps).toBeDefined();
    expect(apps!.children).toHaveLength(2); // client and server branches

    const readme = tree.find((n) => n.name === "readme.md");
    expect(readme).toBeDefined();
    expect(readme!.status).toBe("A");
  });

  it("compacts deep single-child chains", () => {
    const files: WorktreeFileChange[] = [{ path: "a/b/c/d/e.ts", status: "M" }];
    const tree = buildFileTree(files);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("a/b/c/d");
    expect(tree[0].children[0].name).toBe("e.ts");
  });

  it("stops compaction when a directory has multiple children", () => {
    const files: WorktreeFileChange[] = [
      { path: "a/b/x.ts", status: "M" },
      { path: "a/b/y.ts", status: "A" },
    ];
    const tree = buildFileTree(files);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("a/b"); // compacted
    expect(tree[0].children).toHaveLength(2); // x.ts and y.ts
  });
});
