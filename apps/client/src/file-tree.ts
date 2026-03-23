import type { WorktreeFileChange } from "@kodeck/shared";

export interface FileTreeNode {
  name: string;
  status?: WorktreeFileChange["status"];
  children: FileTreeNode[];
}

export function buildFileTree(files: WorktreeFileChange[]): FileTreeNode[] {
  const root: FileTreeNode = { name: "", children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      let child = current.children.find((c) => c.name === part && !c.status);
      if (isLeaf) {
        current.children.push({ name: part, status: file.status, children: [] });
      } else {
        if (!child) {
          child = { name: part, children: [] };
          current.children.push(child);
        }
        current = child;
      }
    }
  }

  // Compact single-child directories (apps/client/src → apps/client/src)
  function compact(node: FileTreeNode): FileTreeNode {
    node.children = node.children.map(compact);
    if (!node.status && node.children.length === 1 && !node.children[0].status) {
      return { name: `${node.name}/${node.children[0].name}`, children: node.children[0].children };
    }
    return node;
  }

  return root.children.map(compact);
}
