<script>
  import { onMount } from 'svelte';

  import cuid from 'cuid';

  let lists = [];
  onMount(() => {
    const rawInitialLists = JSON.parse(localStorage.getItem('dud-hoomn/all-lists') || '[]');
    lists = rawInitialLists.map((listId) => {
      const rawList = JSON.parse(
        localStorage.getItem(`dud-hoomn/lists/${listId}`)
      );
      return {
        ...rawList,
        entries: rawList.entries.map((entryId) => {
          console.log('*** entryId', entryId);
          const parsedEntry = JSON.parse(
            localStorage.getItem(`dud-hoomn/entries/${entryId}`)
          );
          console.log('*** parsedEntry', parsedEntry);
          return parsedEntry;
        })
      };
    });
    console.log('*** lists', lists);
  });

  const addNewList = () => {
    const newList = {
      id: cuid(),
      entries: [],
    };
    lists = lists.concat(newList);
    localStorage.setItem(`dud-hoomn/lists/${newList.id}`, JSON.stringify(newList));
    localStorage.setItem('dud-hoomn/all-lists', JSON.stringify(lists.map(({ id }) => id)));
  };

  const addNewEntry = (list) => () => {
    lists = lists.map((eachList) => {
      if (list !== eachList) return eachList;
      const newEntry = {
        id: cuid(),
        key: undefined,
        value: undefined
      };
      localStorage.setItem(`dud-hoomn/entries/${newEntry.id}`, JSON.stringify(newEntry));
      localStorage.setItem(`dud-hoomn/lists/${list.id}`, JSON.stringify({
        ...list,
        entries: list.entries.map(({ id }) => id).concat(newEntry.id),
      }));
      return {
        ...list,
        entries: list.entries.concat(newEntry),
      };
    });
  };

  const saveNewEntryValue = (entry) => (event) => {
    const updatedEntry = {
      ...entry,
      value: event.target.value,
    };
    localStorage.setItem(`dud-hoomn/entries/${updatedEntry.id}`, JSON.stringify(updatedEntry));
  };
</script>

<button on:click={addNewList}>Add list</button>
{#each lists as list (list.id)}
  <ul>
    <li><button on:click={addNewEntry(list)}>Add entry</button></li>
    {#each list.entries as entry}
      <li>
        <input bind:value={entry.value} on:input={saveNewEntryValue(entry)} />
      </li>
    {/each}
  </ul>
{/each}
