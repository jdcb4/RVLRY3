import localforage from 'localforage';

const wordStore = localforage.createInstance({
  name: 'rvlry',
  storeName: 'word_lists',
});

const syncMetadataKey = 'word-sync-metadata';

export async function getWordSyncMetadata() {
  return wordStore.getItem(syncMetadataKey);
}

export async function saveWordList(type, words) {
  await wordStore.setItem(`words:${type}`, words);
}

export async function getWordList(type) {
  return wordStore.getItem(`words:${type}`);
}

export async function saveWordSyncMetadata(metadata) {
  await wordStore.setItem(syncMetadataKey, metadata);
}
