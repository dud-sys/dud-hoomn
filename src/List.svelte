<script>
  import { getContext, setContext } from 'svelte';
  import ASTNode from './ASTNode.svelte';

  export let node;
  export let focusOnMount = false;
  export let noDomId = false;
  export let addSiblingAfter = undefined;
  export let isRoot = false;

  const childFilter = ({ names }) => !names?.includes('characters');

  const insertChild = (insertAt, child) => {
    if (!child) return;
    node.children = [
      ...node.children.slice(0, insertAt),
      child,
      ...node.children.slice(insertAt),
    ];
  };

  const findPreviousValidChild = (targetIndex) => {
    for (let index = targetIndex - 1; index >= 0; index--) {
      const child = node.children[index];
      if (childFilter(child)) return child;
    }
  };

  const findNextValidChild = (targetIndex) => {
    for (let index = targetIndex + 1; index < node.children.length; index++) {
      const child = node.children[index];
      if (childFilter(child)) return child;
    }
  };

  const joinChildToEndOfSibling = (toRemove, sibling) => {
    if (!toRemove || !sibling) return;
    const toRemoveIndex = node.children.indexOf(toRemove);
    if (!(toRemoveIndex >= 0)) return;
    const remainingCharsNode = toRemove.children.find(({ names }) => names?.includes('characters'));
    const remainingNonCharChildren = toRemove.children.filter(({ names }) => !names?.includes('characters'));
    node.children = [
      ...node.children.slice(0, toRemoveIndex),
      ...node.children.slice(1 + toRemoveIndex),
    ].map((child) => {
      if (child !== sibling) return child;
      return {
        ...sibling,
        children: sibling.children.map((grandchild) => {
          if (!grandchild.names?.includes('characters')) return grandchild;
          return {
            ...grandchild,
            children: [
              ...grandchild.children,
              ...remainingCharsNode.children,
            ]
          }
        }).concat(remainingNonCharChildren),
      }
    });
    return sibling;
  };

  const swapChildren = (childA, childB) => {
    if (!node.children.includes(childA)) return;
    if (!node.children.includes(childB)) return;
    if (childA === childB) return;
    node.children = node.children.map((child) => {
      if (child === childA) return childB;
      if (child === childB) return childA;
      return child;
    });
  };

  const moveChildToGrandchild = (childToMove, childToMoveInto) => {
    if (!childToMove || !childToMoveInto) return false;
    const childToMoveIndex = node.children.indexOf(childToMove);
    if (!(childToMoveIndex >= 0)) return false;
    if (!node.children.includes(childToMoveInto)) return false;
    node.children = [
      ...node.children.slice(0, childToMoveIndex),
      ...node.children.slice(1 + childToMoveIndex),
    ].map((child) => {
      if (child !== childToMoveInto) return child;
      return {
        ...child,
        children: child.children.concat(childToMove),
      };
    });
    return true;
  };

  const moveChildToSibling = (childToMove) => {
    if (!addSiblingAfter || !childToMove) return false;
    const childToMoveIndex = node.children.indexOf(childToMove);
    if (!(childToMoveIndex >= 0)) return false;
    node.children = [
      ...node.children.slice(0, childToMoveIndex),
      ...node.children.slice(1 + childToMoveIndex),
    ];
    addSiblingAfter(childToMove);
    return true;
  };

  const removeChild = (toRemove) => {
    if (!toRemove) return false;
    const toRemoveIndex = node.children.indexOf(toRemove);
    if (!(toRemoveIndex >= 0)) return false;
    if (isRoot && node.children.length === 1) return false;
    node.children = [
      ...node.children.slice(0, toRemoveIndex),
      ...node.children.slice(1 + toRemoveIndex),
    ];
    return true;
  };

  const getLastValidAncestor = (node) => {
    const lastValidChild = node.children.findLast(childFilter);
    if (!lastValidChild) return node;
    return getLastValidAncestor(lastValidChild);
  };

  const getNearestProximalNodeAbove = (child) => {
    if (!child) return;
    const childIndex = node.children.indexOf(child);
    if (!(childIndex >= 0)) return;
    const previousSibling = findPreviousValidChild(childIndex);
    if (!previousSibling) {
      if (isRoot) return;
      return node;
    }
    return getLastValidAncestor(previousSibling);
  };

  const parentGetNextValidSibling = getContext('parentGetNextValidSibling');
  const selfRecursivelyGetNextValidSibling = (child) => {
    if (!child) return;
    const childIndex = node.children.indexOf(child);
    if (!(childIndex >= 0)) return;
    const sibling = findNextValidChild(childIndex);
    if (sibling) return sibling;
    if (!parentGetNextValidSibling) return;
    return parentGetNextValidSibling(node);
  };
  setContext('parentGetNextValidSibling', selfRecursivelyGetNextValidSibling);

  const getNearestProximalNodeBelow = (child, { allowChild = true } = {}) => {
    if (!child) return;
    const childIndex = node.children.indexOf(child);
    if (!(childIndex >= 0)) return;
    if (allowChild) {
      const grandchild = child.children.find(childFilter);
      if (grandchild) return grandchild;
    }
    return selfRecursivelyGetNextValidSibling(child);
  };
</script>

<ul id={noDomId ? null : node.id}>
  {#each node.children as child, idx (child.id)}
    {#if childFilter(child)}
      <li>
        <div class='bullet'>◉</div><!--
     --><ASTNode
          node={child}
          focusOnMount={focusOnMount && idx === 0}
          addSiblingAfter={(child) => insertChild(idx + 1, child)}
          addSiblingBefore={(child) => insertChild(idx, child)}
          joinToEndOfPreviousSibling={() => joinChildToEndOfSibling(child, findPreviousValidChild(idx))}
          swapUp={() => swapChildren(child, findPreviousValidChild(idx))}
          swapDown={() => swapChildren(child, findNextValidChild(idx))}
          becomeChildOfPreviousSibling={() => moveChildToGrandchild(child, findPreviousValidChild(idx))}
          becomeSiblingOfParent={() => moveChildToSibling(child)}
          removeSelf={() => removeChild(child)}
          getNearestNodeAboveSelf={() => getNearestProximalNodeAbove(child)}
          getNearestNodeAfterSelf={(options) => getNearestProximalNodeBelow(child, options)}
        />
      </li>
    {/if}
  {/each}
</ul>

<style>
  ul {
    padding-inline-start: 1.6em;
    list-style-type: none;
  }
  li {
    margin: 0.4em 0;
  }
  .bullet {
    display: inline;
    margin-left: -1em;
  }
</style>
