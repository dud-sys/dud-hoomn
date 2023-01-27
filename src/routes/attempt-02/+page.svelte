<script>
  import cuid from 'cuid';

  import ASTNode from '../../ASTNode.svelte';
  import List from '../../List.svelte';
  import Text from '../../Text.svelte';

  let astRoot = {
    id: cuid(),
    defaultComponent: List,
    children: [{
      id: cuid(),
      defaultComponent: Text,
      children: [{
        id: cuid(),
        defaultComponent: List,
        names: ['characters'],
        children: [],
      }],
    }],
  };
</script>

<ASTNode
  isRoot={true}
  node={astRoot}
  focusOnMount={true}
/>
<div class='scroll-spacer' />

<style>
  .scroll-spacer {
    height: calc(100vh - 4em);
  }
</style>
