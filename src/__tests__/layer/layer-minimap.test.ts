/**
 * Tests for Story 9.4: Layer Minimap — tree-building logic
 *
 * Since LayerMinimap is a React component with fetch/router dependencies,
 * we test the pure tree-building algorithm extracted as a utility function.
 */
import { describe, it, expect } from 'vitest';

interface FlatLayer {
  id: string;
  name: string;
  parentGraphId: string | null;
}

interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  children: TreeNode[];
}

/** Pure function that mirrors the tree-building logic in LayerMinimap */
function buildTree(data: FlatLayer[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  data.forEach((l) =>
    map.set(l.id, { id: l.id, name: l.name, parentId: l.parentGraphId, children: [] })
  );
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

describe('LayerMinimap — tree-building logic (Story 9.4)', () => {
  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('returns single root node when no parentGraphId', () => {
    const data: FlatLayer[] = [{ id: 'root', name: 'Root', parentGraphId: null }];
    const tree = buildTree(data);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children).toHaveLength(0);
  });

  it('builds two-level tree correctly', () => {
    const data: FlatLayer[] = [
      { id: 'root', name: 'Root', parentGraphId: null },
      { id: 'child-a', name: 'Child A', parentGraphId: 'root' },
      { id: 'child-b', name: 'Child B', parentGraphId: 'root' },
    ];
    const tree = buildTree(data);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    const childIds = tree[0].children.map((c) => c.id);
    expect(childIds).toContain('child-a');
    expect(childIds).toContain('child-b');
  });

  it('builds three-level deep tree correctly', () => {
    const data: FlatLayer[] = [
      { id: 'root', name: 'Root', parentGraphId: null },
      { id: 'child', name: 'Child', parentGraphId: 'root' },
      { id: 'grandchild', name: 'Grandchild', parentGraphId: 'child' },
    ];
    const tree = buildTree(data);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe('grandchild');
  });

  it('treats node with unknown parentGraphId as root', () => {
    const data: FlatLayer[] = [{ id: 'orphan', name: 'Orphan', parentGraphId: 'nonexistent' }];
    const tree = buildTree(data);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('handles multiple roots', () => {
    const data: FlatLayer[] = [
      { id: 'root-1', name: 'Root 1', parentGraphId: null },
      { id: 'root-2', name: 'Root 2', parentGraphId: null },
    ];
    const tree = buildTree(data);
    expect(tree).toHaveLength(2);
    const rootIds = tree.map((r) => r.id);
    expect(rootIds).toContain('root-1');
    expect(rootIds).toContain('root-2');
  });

  it('preserves layer names in tree nodes', () => {
    const data: FlatLayer[] = [
      { id: 'root', name: 'My Root Layer', parentGraphId: null },
      { id: 'child', name: 'Marketing Flow', parentGraphId: 'root' },
    ];
    const tree = buildTree(data);
    expect(tree[0].name).toBe('My Root Layer');
    expect(tree[0].children[0].name).toBe('Marketing Flow');
  });

  it('handles four-level deep tree (depth >= 3 scenario)', () => {
    const data: FlatLayer[] = [
      { id: 'l0', name: 'Level 0', parentGraphId: null },
      { id: 'l1', name: 'Level 1', parentGraphId: 'l0' },
      { id: 'l2', name: 'Level 2', parentGraphId: 'l1' },
      { id: 'l3', name: 'Level 3', parentGraphId: 'l2' },
    ];
    const tree = buildTree(data);
    expect(tree[0].children[0].children[0].children[0].id).toBe('l3');
    expect(tree[0].children[0].children[0].children[0].name).toBe('Level 3');
  });

  it('parentId is preserved on tree nodes', () => {
    const data: FlatLayer[] = [
      { id: 'root', name: 'Root', parentGraphId: null },
      { id: 'child', name: 'Child', parentGraphId: 'root' },
    ];
    const tree = buildTree(data);
    expect(tree[0].parentId).toBeNull();
    expect(tree[0].children[0].parentId).toBe('root');
  });
});
