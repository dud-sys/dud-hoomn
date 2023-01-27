<script>
  import { tick } from 'svelte';

  import cuid from 'cuid';

  import List from './List.svelte';
  import Text from './Text.svelte';
  import cursorRangeStore from './cursorRangeStore';
  import currentVerticalNavigationLine from './currentVerticalNavigationLine';

  export let node;
  export let focusOnMount = false;
  export let addSiblingAfter;
  export let addSiblingBefore;
  export let joinToEndOfPreviousSibling;
  export let swapUp;
  export let swapDown;
  export let becomeChildOfPreviousSibling;
  export let becomeSiblingOfParent;
  export let removeSelf;
  export let getNearestNodeAboveSelf;
  export let getNearestNodeAfterSelf

  // TODO: undo/redo

  $: charsNode = node.children.find(({ names }) => names?.includes('characters'));

  const updateCharacters = (updater) => {
    const charsNodeIndex = node.children.findIndex(({ names }) => names?.includes('characters'));
    return [
      ...node.children.slice(0, charsNodeIndex),
      {
        ...node.children[charsNodeIndex],
        children: updater(node.children[charsNodeIndex])
      },
      ...node.children.slice(charsNodeIndex + 1),
    ];
  };

  let serializedCursorRange = cursorRangeStore[node.id];

  const storeSerializedCursorRange = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const ownDomNode = document.getElementById(node.id);
      if (ownDomNode.contains(range.startContainer) && ownDomNode.contains(range.endContainer)) {
        serializedCursorRange = cursorRangeStore[node.id] = serializeOwnCursorRange(range);
      }
    }
  };

  const serializeOwnCursorRange = (range) => {
    const serializedRange = {
      startNodePath: [],
      startOffset: range.startOffset,
      endNodePath: [],
      endOffset: range.endOffset,
    };
    const ownDomNode = document.getElementById(node.id);
    let currDomNode = range.startContainer;
    while (ownDomNode.contains(currDomNode) && ownDomNode !== currDomNode) {
      const indexInParent = Array.from(currDomNode.parentNode.childNodes).indexOf(currDomNode);
      serializedRange.startNodePath.unshift(indexInParent);
      currDomNode = currDomNode.parentNode;
    }
    currDomNode = range.endContainer;
    while (ownDomNode.contains(currDomNode) && ownDomNode !== currDomNode) {
      const indexInParent = Array.from(currDomNode.parentNode.childNodes).indexOf(currDomNode);
      serializedRange.endNodePath.unshift(indexInParent);
      currDomNode = currDomNode.parentNode;
    }
    return serializedRange;
  };

  const deserializeOwnCursorRange = ({ startNodePath, startOffset, endNodePath, endOffset }) => {
    const range = document.createRange();
    const startNode = startNodePath.reduce(
      (domNode, index) => domNode?.childNodes[index],
      document.getElementById(node.id)
    );
    range.setStart(startNode, startOffset);
    const endNode = endNodePath.reduce(
      (domNode, index) => domNode?.childNodes[index],
      document.getElementById(node.id)
    );
    range.setEnd(endNode, endOffset);
    return range;
  };

  const selectStoredCursorRange = () => {
    if (!serializedCursorRange) return;
    const newRange = deserializeOwnCursorRange(serializedCursorRange);
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const currentRange = selection.getRangeAt(0);
      selection.removeRange(currentRange);
    }
    selection.addRange(newRange);
  };

  const handleFocus = () => {
    selectStoredCursorRange();
  };

  const handleFocusOut = () => {
    storeSerializedCursorRange();
  };

  const maybeFocus = (domElement) => {
    if (!focusOnMount) return;
    domElement.focus();
  };

  const selectionNodeToCharacterIndex = ({ node: selectionNode, offset }) => {
    const charsNode = node.children.find(({ names }) => names?.includes('characters'));
    const idToMatch = selectionNode.id ? selectionNode.id : selectionNode.parentNode.id;
    if (idToMatch === node.id) return offset;
    return charsNode.children.findIndex(({ id }) => idToMatch === id) + offset;
  };

  const findCursorCharacterIndex = () => {
    const { anchorNode, anchorOffset, focusNode, focusOffset } = window.getSelection();
    const anchorIndex = selectionNodeToCharacterIndex({ node: anchorNode, offset: anchorOffset });
    const focusIndex = selectionNodeToCharacterIndex({ node: focusNode, offset: focusOffset });
    return {
      start: Math.min(anchorIndex, focusIndex),
      end: Math.max(anchorIndex, focusIndex),
      focus: focusIndex,
      anchor: anchorIndex,
    };
  };

  const isInsertNewline = (event) => {
    return event.shiftKey && event.key === 'Enter';
  };
  const handleInsertNewline = () => {
    handleCharacter({ key: '\n' });
  };

  const isInsertSiblingBefore = (event) => {
    return event.altKey && event.key === 'Enter';
  };
  const handleInsertSiblingBefore = async () => {
    const { start, end } = findCursorCharacterIndex();
    let charNodesBeforeCursor;
    node.children = updateCharacters((charsNode) => {
      charNodesBeforeCursor = charsNode.children.slice(0, start);
      return charsNode.children.slice(end);
    });
    const newSibling = {
      id: cuid(),
      defaultComponent: Text,
      children: [{
        id: cuid(),
        names: ['characters'],
        children: charNodesBeforeCursor,
      }],
    };
    addSiblingBefore(newSibling);
    await tick();
    document.getElementById(newSibling.id).focus();
    window.getSelection().modify('move', 'forward', 'paragraphboundary');
  };

  const handleEnter = async () => {
    const { start, end } = findCursorCharacterIndex();
    let charNodesAfterCursor;
    node.children = updateCharacters((charsNode) => {
      charNodesAfterCursor = charsNode.children.slice(end);
      return charsNode.children.slice(0, start);
    });
    const newSibling = {
      id: cuid(),
      defaultComponent: Text,
      children: [{
        id: cuid(),
        names: ['characters'],
        children: charNodesAfterCursor,
      }],
    };
    addSiblingAfter(newSibling);
    await tick();
    document.getElementById(newSibling.id).focus();
  };

  const handleCharacter = async ({ key }) => {
    const { start, end } = findCursorCharacterIndex();
    node.children = updateCharacters((charsNode) => {
      return [
        ...charsNode.children.slice(0, start),
        { id: cuid(), value: key },
        ...charsNode.children.slice(end),
      ];
    });
    const { anchorNode, anchorOffset } = window.getSelection();
    // When insert to the left of a text node, cursor doesn't need to move
    if (anchorNode.nodeType === 3 && anchorOffset === 0 && start === end) {
      return;
    }
    await tick();
    window.getSelection().modify('move', 'forward', 'character');
  };

  const isPlainCharacter = (event) => {
    return event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
  };

  const isDeleteSelf = (event) => {
    return event.altKey && event.key === 'Backspace';
  };

  const handleDeleteSelf = async () => {
    const proximalInTabOrder = getNearestNodeAboveSelf() || getNearestNodeAfterSelf({ allowChild: false });
    const didRemove = removeSelf();
    if (!didRemove) return;
    if (!proximalInTabOrder) return;
    await tick();
    document.getElementById(proximalInTabOrder.id).focus();
  };

  const handleBackspace = async () => {
    const { start, end } = findCursorCharacterIndex();
    if (start !== end) {
      node.children = updateCharacters((charsNode) => [
        ...charsNode.children.slice(0, start),
        ...charsNode.children.slice(end),
      ]);
      return;
    }
    if (start !== 0) {
      node.children = updateCharacters((charsNode) => [
        ...charsNode.children.slice(0, start - 1),
        ...charsNode.children.slice(start),
      ]);
      return;
    }
    const previousSibling = joinToEndOfPreviousSibling();
    if (!previousSibling) return;
    document.getElementById(previousSibling.id).focus();
    window.getSelection().modify('move', 'forward', 'paragraphboundary');
    delete cursorRangeStore[node.id];
  };

  const handleClear = () => {
    node.children = updateCharacters(() => []);
  };

  const doDefault = Symbol('doDefault');

  const isIndent = (event) => {
    return event.altKey && event.key === 'Tab';
  };
  const handleIndent = async () => {
    const didMove = becomeChildOfPreviousSibling();
    if (!didMove) return;
    await tick();
    document.getElementById(node.id).focus();
  };

  const isUnindent = (event) => {
    return event.altKey && event.shiftKey && event.key === 'Tab';
  };
  const handleUnindent = async () => {
    const didMove = becomeSiblingOfParent();
    if (!didMove) return;
    await tick();
    document.getElementById(node.id).focus();
  };

  const isSwapDown = (event) => {
    return event.altKey && event.key === 'ArrowDown';
  };
  const handleSwapDown = async () => {
    swapDown();
    await tick();
    document.getElementById(node.id).focus();
  }

  const isSwapUp = (event) => {
    return event.altKey && event.key === 'ArrowUp';
  };
  const handleSwapUp = async () => {
    swapUp();
    await tick();
    document.getElementById(node.id).focus();
  }

  const selectNewRange = ({ start, end }) => {
    const newRange = document.createRange();
    if (start) {
      newRange.setStart(
        start.node,
        start.offset,
      );
    }
    if (end) {
      newRange.setEnd(
        end.node,
        end.offset,
      );
    }
    const newSelection = window.getSelection();
    if (newSelection.rangeCount > 0) {
      const currentRange = newSelection.getRangeAt(0);
      newSelection.removeRange(currentRange);
    }
    newSelection.addRange(newRange)
  };

  const handleArrowDown = currentVerticalNavigationLine.withLock(() => {
    const selection = window.getSelection();
    let selectionNode = selection.focusNode;
    if (selectionNode.nodeType === 3) {
      selectionNode = selectionNode.parentNode;
    }
    const selectionRect = selectionNode.getBoundingClientRect();
    if (currentVerticalNavigationLine.getX() === undefined) {
      const whichSideToSelectForCursorHorizontalPosition = ({0: 'left', 1: 'right'})[selection.focusOffset];
      const verticalLineX = selectionRect[whichSideToSelectForCursorHorizontalPosition];
      currentVerticalNavigationLine.setX(verticalLineX);
    }
    const bottomOfSelection = selectionRect.bottom;
    const charsNode = node.children.find(({ names }) => names?.includes('characters'));
    const lastChar = charsNode.children[charsNode.children.length - 1];
    if (lastChar) {
      const { bottom: bottomOfLastChar } = document.getElementById(lastChar.id).getBoundingClientRect();
      if (bottomOfLastChar > bottomOfSelection) {
        let startIndex = findCursorCharacterIndex().focus;
        let nextLineBottom;
        let closest;
        while (charsNode.children[startIndex]) {
          const char = charsNode.children[startIndex];
          const {
            bottom: bottomOfChar,
            left: leftOfChar
          } = document.getElementById(char.id).getBoundingClientRect();
          if (bottomOfChar > bottomOfSelection) {
            nextLineBottom = bottomOfChar;
            closest = {
              x: leftOfChar,
              id: char.id,
              offset: 0,
            };
            break;
          }
          startIndex++;
        }
        if (!closest) return;
        for (let idx = startIndex; idx < charsNode.children.length; idx++) {
          const char = charsNode.children[idx];
          const {
            bottom: bottomOfChar,
            right: rightOfChar,
          } = document.getElementById(char.id).getBoundingClientRect();
          if (bottomOfChar > nextLineBottom) break;
          const closestDistance = Math.abs(closest.x - currentVerticalNavigationLine.getX());
          const charDistance = Math.abs(rightOfChar - currentVerticalNavigationLine.getX());
          if (closestDistance <= charDistance) break;
          closest = {
            x: rightOfChar,
            id: char.id,
            offset: 1,
          };
        }
        selectNewRange({
          start: {
            node: document.getElementById(closest.id),
            offset: closest.offset,
          }
        });
        return;
      }
    }
    const nodeToFocus = getNearestNodeAfterSelf();
    if (!nodeToFocus) return;

    document.getElementById(nodeToFocus.id).focus();
    const nextCharsNode = nodeToFocus.children.find(({ names }) => names?.includes('characters'));
    const nextFirstChar = nextCharsNode.children[0];
    if (!nextFirstChar) return;
    const {
      top: topOfNextFirstChar,
      left: leftOfNextFirstChar,
    } = document.getElementById(nextFirstChar.id).getBoundingClientRect();
    let closest = {
      x: leftOfNextFirstChar,
      id: nextFirstChar.id,
      offset: 0,
    };
    for (let idx = 0; idx < nextCharsNode.children.length; idx++) {
      const char = nextCharsNode.children[idx];
      const {
        top: topOfChar,
        right: rightOfChar,
      } = document.getElementById(char.id).getBoundingClientRect();
      if (topOfChar > topOfNextFirstChar) break;
      const closestDistance = Math.abs(closest.x - currentVerticalNavigationLine.getX());
      const charDistance = Math.abs(rightOfChar - currentVerticalNavigationLine.getX());
      if (closestDistance <= charDistance) break;
      closest = {
        x: rightOfChar,
        id: char.id,
        offset: 1,
      };
    }
    selectNewRange({
      start: {
        node: document.getElementById(closest.id),
        offset: closest.offset,
      }
    });
  });

  const handleArrowUp = currentVerticalNavigationLine.withLock(() => {
    const selection = window.getSelection();
    let selectionNode = selection.focusNode;
    if (selectionNode.nodeType === 3) {
      selectionNode = selectionNode.parentNode;
    }
    const selectionRect = selectionNode.getBoundingClientRect();
    if (currentVerticalNavigationLine.getX() === undefined) {
      const whichSideToSelectForCursorHorizontalPosition = ({0: 'left', 1: 'right'})[selection.focusOffset];
      const verticalLineX = selectionRect[whichSideToSelectForCursorHorizontalPosition];
      currentVerticalNavigationLine.setX(verticalLineX);
    }
    const topOfSelection = selectionRect.top;
    const charsNode = node.children.find(({ names }) => names?.includes('characters'));
    const firstChar = charsNode.children[0];
    if (firstChar) {
      const { top: topOfFirstChar } = document.getElementById(firstChar.id).getBoundingClientRect();
      if (topOfFirstChar < topOfSelection) {
        let startIndex = findCursorCharacterIndex().focus - 1;
        let previousLineTop;
        let closest;
        while (charsNode.children[startIndex]) {
          const char = charsNode.children[startIndex];
          const {
            top: topOfChar,
            right: rightOfChar
          } = document.getElementById(char.id).getBoundingClientRect();
          if (topOfChar < topOfSelection) {
            previousLineTop = topOfChar;
            closest = {
              x: rightOfChar,
              id: char.id,
              offset: 1,
            };
            break;
          }
          startIndex--;
        }
        if (!closest) return;
        for (let idx = startIndex; idx >= 0; idx--) {
          const char = charsNode.children[idx];
          const {
            top: topOfChar,
            left: leftOfChar,
          } = document.getElementById(char.id).getBoundingClientRect();
          if (topOfChar < previousLineTop) break;
          const closestDistance = Math.abs(closest.x - currentVerticalNavigationLine.getX());
          const charDistance = Math.abs(leftOfChar - currentVerticalNavigationLine.getX());
          if (closestDistance <= charDistance) break;
          closest = {
            x: leftOfChar,
            id: char.id,
            offset: 0,
          };
        }
        selectNewRange({
          start: {
            node: document.getElementById(closest.id),
            offset: closest.offset,
          }
        });
        return;
      }
    }
    const nodeToFocus = getNearestNodeAboveSelf();
    if (!nodeToFocus) return;

    document.getElementById(nodeToFocus.id).focus();
    const nextCharsNode = nodeToFocus.children.find(({ names }) => names?.includes('characters'));
    const nextLastChar = nextCharsNode.children[nextCharsNode.children.length - 1];
    if (!nextLastChar) return;
    const {
      bottom: bottomOfNextLastChar,
      right: rightOfNextLastChar,
    } = document.getElementById(nextLastChar.id).getBoundingClientRect();
    let closest = {
      x: rightOfNextLastChar,
      id: nextLastChar.id,
      offset: 1,
    };
    for (let idx = nextCharsNode.children.length - 1; idx >= 0; idx--) {
      const char = nextCharsNode.children[idx];
      const {
        bottom: bottomOfChar,
        left: leftOfChar,
      } = document.getElementById(char.id).getBoundingClientRect();
      if (bottomOfChar < bottomOfNextLastChar) break;
      const closestDistance = Math.abs(closest.x - currentVerticalNavigationLine.getX());
      const charDistance = Math.abs(leftOfChar - currentVerticalNavigationLine.getX());
      if (closestDistance <= charDistance) break;
      closest = {
        x: leftOfChar,
        id: char.id,
        offset: 0,
      };
    }
    selectNewRange({
      start: {
        node: document.getElementById(closest.id),
        offset: closest.offset,
      }
    });
  });

  const handlePaste = async (event) => {
    event.preventDefault();
    const keys = event.clipboardData.getData('text/plain').split('');
    const { start, end } = findCursorCharacterIndex();
    node.children = updateCharacters((charsNode) => {
      return [
        ...charsNode.children.slice(0, start),
        ...keys.map((key) => ({ id: cuid(), value: key })),
        ...charsNode.children.slice(end),
      ];
    });
    const { anchorNode, anchorOffset } = window.getSelection();
    // When insert to the left of a text node, cursor doesn't need to move
    if (anchorNode.nodeType === 3 && anchorOffset === 0 && start === end) {
      return;
    }
    await tick();
    keys.forEach(() => {
      window.getSelection().modify('move', 'forward', 'character');
    });
  };

  const keyEventHandlers = [
    [isInsertNewline, handleInsertNewline],
    [isInsertSiblingBefore, handleInsertSiblingBefore],
    ['Enter', handleEnter],
    [isDeleteSelf, handleDeleteSelf],
    ['Backspace', handleBackspace],
    ['Clear', handleClear],
    [isPlainCharacter, handleCharacter],
    [isUnindent, handleUnindent],
    [isIndent, handleIndent],
    [isSwapDown, handleSwapDown],
    [isSwapUp, handleSwapUp],
    ['ArrowDown', handleArrowDown],
    ['ArrowUp', handleArrowUp],
    [[
      'ArrowLeft',
      'ArrowRight',
      'End',
      'Home',
    ], doDefault]
  ];

  const handleKeyDown = (event) => {
    globalThis._mostRecentNodeOperatedOn = node;
    storeSerializedCursorRange();
    for (const [anyMatch, handler] of keyEventHandlers) {
      const allPossibleMatches = Array.isArray(anyMatch) ? anyMatch : [anyMatch];
      for (const toMatch of allPossibleMatches) {
        const isMatch = (
          typeof toMatch === 'string' && toMatch === event.key
          || typeof toMatch === 'function' && toMatch(event)
        );
        if (isMatch) {
          event.stopPropagation();
          if (handler !== doDefault) {
            event.preventDefault();
            handler(event);
          }
          return;
        }
      }
    }
  };
</script>

<div
  id={node.id}
  use:maybeFocus
  contenteditable='true'
  on:keydown={handleKeyDown}
  on:focus={handleFocus}
  on:focusout={handleFocusOut}
  on:paste={handlePaste}
>
  {#each charsNode.children as character (character.id)}
    <span id={character.id}>{character.value}</span>
  {/each}
</div>
<List
  node={node}
  noDomId={true}
  {addSiblingAfter}
/>

<style>
  div[contenteditable='true'] {
    padding: 0.35em;
    display: inline;
    overflow-wrap: anywhere;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    margin-left: 0.3em;
  }
  div[contenteditable='true']:focus {
    outline: 2px solid var(--white-gray-3x-1);
    line-height: 1.5;
    border-radius: 3px;
  }
  span {
    white-space: break-spaces;
  }
</style>
