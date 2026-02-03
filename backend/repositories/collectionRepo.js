import { readCollection, updateCollection } from '../services/jsonDb.js';
import { COLLECTION_KEYS } from '../services/dbSchema.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const resolveContext = (context) =>
  context && typeof context === 'object' ? context : null;

const resolveIdFieldAndContext = (idFieldOrContext, context) => {
  if (resolveContext(idFieldOrContext)) {
    return { idField: 'id', context: idFieldOrContext };
  }
  return { idField: idFieldOrContext || 'id', context };
};

const getCollectionSnapshot = async (collectionKey, context) => {
  const resolvedContext = resolveContext(context);
  if (resolvedContext?.db) {
    return ensureArray(resolvedContext.db[collectionKey]);
  }
  return ensureArray(await readCollection(collectionKey));
};

export const createCollectionRepo = (collectionKey) => {
  if (!COLLECTION_KEYS.includes(collectionKey)) {
    throw new Error(`Unknown collection: ${collectionKey}`);
  }

  const getAll = async (context) => {
    const items = await getCollectionSnapshot(collectionKey, context);
    return [...items];
  };

  const findOne = async (predicate, context) => {
    const items = await getCollectionSnapshot(collectionKey, context);
    return items.find(predicate);
  };

  const findById = async (id, idField = 'id', context) => {
    const { idField: resolvedIdField, context: resolvedContext } =
      resolveIdFieldAndContext(idField, context);
    const items = await getCollectionSnapshot(collectionKey, resolvedContext);
    return items.find((item) => item && item[resolvedIdField] === id);
  };

  const filter = async (predicate, context) => {
    const items = await getCollectionSnapshot(collectionKey, context);
    return items.filter(predicate);
  };

  const insert = async (item, context) => {
    const resolvedContext = resolveContext(context);
    if (resolvedContext?.db) {
      resolvedContext.db[collectionKey] = ensureArray(
        resolvedContext.db[collectionKey]
      );
      resolvedContext.db[collectionKey].push(item);
      return item;
    }
    let created;
    await updateCollection(collectionKey, (items) => {
      items.push(item);
      created = item;
      return items;
    });
    return created;
  };

  const replaceAll = async (items, context) => {
    const safeItems = ensureArray(items);
    const resolvedContext = resolveContext(context);
    if (resolvedContext?.db) {
      resolvedContext.db[collectionKey] = safeItems;
      return safeItems;
    }
    await updateCollection(collectionKey, () => safeItems);
    return safeItems;
  };

  const updateAll = async (mutator, context) => {
    let updated;
    const resolvedContext = resolveContext(context);
    if (resolvedContext?.db) {
      const current = ensureArray(resolvedContext.db[collectionKey]);
      const working = [...current];
      const next = mutator(working);
      const resolvedNext = Array.isArray(next) ? next : working;
      resolvedContext.db[collectionKey] = resolvedNext;
      return resolvedNext;
    }
    await updateCollection(collectionKey, (items) => {
      const working = [...items];
      const next = mutator(working);
      const resolvedNext = Array.isArray(next) ? next : working;
      updated = resolvedNext;
      return resolvedNext;
    });
    return updated;
  };

  const updateById = async (id, updater, idField = 'id', context) => {
    let updatedItem;
    const { idField: resolvedIdField, context: resolvedContext } =
      resolveIdFieldAndContext(idField, context);
    if (resolvedContext?.db) {
      const current = ensureArray(resolvedContext.db[collectionKey]);
      const next = current.map((item) => {
        if (!item || item[resolvedIdField] !== id) {
          return item;
        }
        const draft = { ...item };
        const updated = updater(draft);
        const resolved = updated && typeof updated === 'object' ? updated : draft;
        updatedItem = resolved;
        return resolved;
      });
      resolvedContext.db[collectionKey] = next;
      return updatedItem;
    }
    await updateCollection(collectionKey, (items) => {
      const next = items.map((item) => {
        if (!item || item[resolvedIdField] !== id) {
          return item;
        }
        const draft = { ...item };
        const updated = updater(draft);
        const resolved = updated && typeof updated === 'object' ? updated : draft;
        updatedItem = resolved;
        return resolved;
      });
      return next;
    });
    return updatedItem;
  };

  const removeById = async (id, idField = 'id', context) => {
    let removed;
    const { idField: resolvedIdField, context: resolvedContext } =
      resolveIdFieldAndContext(idField, context);
    if (resolvedContext?.db) {
      const current = ensureArray(resolvedContext.db[collectionKey]);
      const next = [];
      for (const item of current) {
        if (item && item[resolvedIdField] === id) {
          removed = item;
        } else {
          next.push(item);
        }
      }
      resolvedContext.db[collectionKey] = next;
      return removed;
    }
    await updateCollection(collectionKey, (items) => {
      const next = [];
      for (const item of items) {
        if (item && item[resolvedIdField] === id) {
          removed = item;
        } else {
          next.push(item);
        }
      }
      return next;
    });
    return removed;
  };

  return {
    key: collectionKey,
    getAll,
    findOne,
    findById,
    filter,
    insert,
    replaceAll,
    updateAll,
    updateById,
    removeById
  };
};
