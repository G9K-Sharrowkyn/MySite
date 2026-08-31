import {
  isMongoMode,
  readCollection,
  updateCollection
} from '../services/jsonDb.js';
import { COLLECTION_KEYS } from '../services/dbSchema.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const resolveContext = (context) =>
  context && typeof context === 'object' ? context : null;

const isMongoContext = (context) =>
  Boolean(context?.mongoDb && context?.session);

const stripMongoId = (document) => {
  if (!document || typeof document !== 'object') return document;
  const { _id, ...rest } = document;
  return rest;
};

const resolveIdFieldAndContext = (idFieldOrContext, context) => {
  if (resolveContext(idFieldOrContext)) {
    return { idField: 'id', context: idFieldOrContext };
  }
  return { idField: idFieldOrContext || 'id', context };
};

const getCollectionSnapshot = async (collectionKey, context) => {
  const resolvedContext = resolveContext(context);
  if (isMongoContext(resolvedContext)) {
    const documents = await resolvedContext.mongoDb
      .collection(collectionKey)
      .find({}, { session: resolvedContext.session })
      .toArray();
    return documents.map(stripMongoId);
  }
  if (resolvedContext?.db) {
    return ensureArray(resolvedContext.db[collectionKey]);
  }
  return ensureArray(await readCollection(collectionKey));
};

let mongoOperationsPromise;
const getMongoOperations = () => {
  if (!mongoOperationsPromise) {
    mongoOperationsPromise = import('../services/mongoDb.js');
  }
  return mongoOperationsPromise;
};

const getPathValues = (document, path) => {
  const parts = String(path || '').split('.').filter(Boolean);
  const visit = (value, index) => {
    if (index >= parts.length) return [value];
    if (Array.isArray(value)) {
      return value.flatMap((entry) => visit(entry, index));
    }
    return visit(value?.[parts[index]], index + 1);
  };
  return visit(document, 0);
};

const getPathValue = (document, path) => getPathValues(document, path)[0];

const setPathValue = (document, path, value) => {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let current = document;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts.at(-1)] = value;
};

const unsetPathValue = (document, path) => {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return false;
  let current = document;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = current?.[parts[index]];
    if (!current || typeof current !== 'object') return false;
  }
  const key = parts.at(-1);
  if (!Object.prototype.hasOwnProperty.call(current, key)) return false;
  delete current[key];
  return true;
};

const valuesEqual = (left, right) => {
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  return left === right;
};

const matchesCondition = (value, condition) => {
  if (condition instanceof RegExp) {
    return condition.test(String(value ?? ''));
  }
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    if (Array.isArray(value)) {
      return value.some((entry) => valuesEqual(entry, condition));
    }
    return valuesEqual(value, condition);
  }
  if (
    '$in' in condition &&
    (!Array.isArray(condition.$in) ||
      !(Array.isArray(value) ? value : [value]).some((item) =>
        condition.$in.some((entry) => valuesEqual(item, entry))
      ))
  ) {
    return false;
  }
  if (
    '$nin' in condition &&
    Array.isArray(condition.$nin) &&
    (Array.isArray(value) ? value : [value]).some((item) =>
      condition.$nin.some((entry) => valuesEqual(item, entry))
    )
  ) {
    return false;
  }
  if ('$ne' in condition && valuesEqual(value, condition.$ne)) return false;
  if ('$exists' in condition && Boolean(value !== undefined) !== Boolean(condition.$exists)) {
    return false;
  }
  if ('$gt' in condition && !(value > condition.$gt)) return false;
  if ('$gte' in condition && !(value >= condition.$gte)) return false;
  if ('$lt' in condition && !(value < condition.$lt)) return false;
  if ('$lte' in condition && !(value <= condition.$lte)) return false;
  if ('$regex' in condition) {
    const expression = condition.$regex instanceof RegExp
      ? condition.$regex
      : new RegExp(String(condition.$regex), condition.$options || '');
    if (!expression.test(String(value ?? ''))) return false;
  }
  return true;
};

const matchesQuery = (document, query = {}) => {
  if (Array.isArray(query.$and) && !query.$and.every((part) => matchesQuery(document, part))) {
    return false;
  }
  if (Array.isArray(query.$or) && !query.$or.some((part) => matchesQuery(document, part))) {
    return false;
  }
  return Object.entries(query).every(([path, condition]) => {
    if (path === '$and' || path === '$or') return true;
    return getPathValues(document, path).some((value) =>
      matchesCondition(value, condition)
    );
  });
};

const sortDocuments = (items, sort = {}) => {
  const entries = Object.entries(sort || {});
  if (!entries.length) return items;
  return [...items].sort((left, right) => {
    for (const [path, direction] of entries) {
      const leftValue = getPathValue(left, path);
      const rightValue = getPathValue(right, path);
      if (valuesEqual(leftValue, rightValue)) continue;
      const order = leftValue > rightValue ? 1 : -1;
      return Number(direction) < 0 ? -order : order;
    }
    return 0;
  });
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
    if (isMongoContext(resolvedContext)) {
      const document = await resolvedContext.mongoDb
        .collection(collectionKey)
        .findOne(
          { [resolvedIdField]: id },
          { session: resolvedContext.session }
        );
      return document ? stripMongoId(document) : null;
    }
    if (!resolvedContext && isMongoMode()) {
      const { findMongoDocument } = await getMongoOperations();
      return findMongoDocument(collectionKey, { [resolvedIdField]: id });
    }
    const items = await getCollectionSnapshot(collectionKey, resolvedContext);
    return items.find((item) => item && item[resolvedIdField] === id);
  };

  const findOneBy = async (query, options = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      const document = await resolvedContext.mongoDb
        .collection(collectionKey)
        .findOne(query || {}, {
          session: resolvedContext.session,
          projection: options.projection,
          collation: options.collation
        });
      return document ? stripMongoId(document) : null;
    }
    if (!resolvedContext && isMongoMode()) {
      const { findMongoDocument } = await getMongoOperations();
      return findMongoDocument(collectionKey, query, options);
    }
    const items = await getCollectionSnapshot(collectionKey, resolvedContext);
    return sortDocuments(items.filter((item) => matchesQuery(item, query)), options.sort)[0];
  };

  const findManyBy = async (query = {}, options = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      let cursor = resolvedContext.mongoDb.collection(collectionKey).find(query, {
        session: resolvedContext.session,
        projection: options.projection,
        collation: options.collation
      });
      if (options.sort) cursor = cursor.sort(options.sort);
      if (Number.isFinite(options.skip) && options.skip > 0) cursor = cursor.skip(Math.floor(options.skip));
      if (Number.isFinite(options.limit) && options.limit > 0) cursor = cursor.limit(Math.floor(options.limit));
      return (await cursor.toArray()).map(stripMongoId);
    }
    if (!resolvedContext && isMongoMode()) {
      const { findMongoDocuments } = await getMongoOperations();
      return findMongoDocuments(collectionKey, query, options);
    }
    const items = sortDocuments(
      (await getCollectionSnapshot(collectionKey, resolvedContext)).filter((item) =>
        matchesQuery(item, query)
      ),
      options.sort
    );
    const skip = Number.isFinite(options.skip) ? Math.max(0, Math.floor(options.skip)) : 0;
    const limit = Number.isFinite(options.limit) && options.limit > 0
      ? Math.floor(options.limit)
      : items.length;
    return items.slice(skip, skip + limit);
  };

  const countBy = async (query = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      return resolvedContext.mongoDb
        .collection(collectionKey)
        .countDocuments(query, { session: resolvedContext.session });
    }
    if (!resolvedContext && isMongoMode()) {
      const { countMongoDocuments } = await getMongoOperations();
      return countMongoDocuments(collectionKey, query);
    }
    const items = await getCollectionSnapshot(collectionKey, resolvedContext);
    return items.filter((item) => matchesQuery(item, query)).length;
  };

  const groupCountBy = async (path, query = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext) || (!resolvedContext && isMongoMode())) {
      const mongoDb = isMongoContext(resolvedContext)
        ? resolvedContext.mongoDb
        : (await getMongoOperations()).getMongoDb
          ? await (await getMongoOperations()).getMongoDb()
          : null;
      if (mongoDb) {
        const options = isMongoContext(resolvedContext)
          ? { session: resolvedContext.session }
          : {};
        const rows = await mongoDb.collection(collectionKey).aggregate([
          { $match: query || {} },
          { $group: { _id: `$${path}`, count: { $sum: 1 } } }
        ], options).toArray();
        return Object.fromEntries(
          rows
            .filter((row) => row._id !== undefined && row._id !== null && row._id !== '')
            .map((row) => [String(row._id), row.count])
        );
      }
    }
    const items = (await getCollectionSnapshot(collectionKey, resolvedContext))
      .filter((item) => matchesQuery(item, query));
    const grouped = {};
    for (const item of items) {
      for (const value of getPathValues(item, path)) {
        if (value === undefined || value === null || value === '') continue;
        const key = String(value);
        grouped[key] = (grouped[key] || 0) + 1;
      }
    }
    return grouped;
  };

  const groupSumBy = async (groupPath, valuePath, query = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext) || (!resolvedContext && isMongoMode())) {
      const mongoDb = isMongoContext(resolvedContext)
        ? resolvedContext.mongoDb
        : await (await getMongoOperations()).getMongoDb();
      const options = isMongoContext(resolvedContext)
        ? { session: resolvedContext.session }
        : {};
      const rows = await mongoDb.collection(collectionKey).aggregate([
        { $match: query || {} },
        { $group: { _id: `$${groupPath}`, total: { $sum: { $ifNull: [`$${valuePath}`, 0] } } } },
        { $sort: { total: -1, _id: 1 } }
      ], options).toArray();
      return rows
        .filter((row) => row._id !== undefined && row._id !== null && row._id !== '')
        .map((row) => ({ key: String(row._id), total: Number(row.total || 0) }));
    }
    const sums = new Map();
    const items = (await getCollectionSnapshot(collectionKey, resolvedContext))
      .filter((item) => matchesQuery(item, query));
    for (const item of items) {
      const key = getPathValue(item, groupPath);
      if (key === undefined || key === null || key === '') continue;
      const normalized = String(key);
      sums.set(normalized, (sums.get(normalized) || 0) + Number(getPathValue(item, valuePath) || 0));
    }
    return [...sums.entries()]
      .map(([key, total]) => ({ key, total }))
      .sort((left, right) => right.total - left.total || left.key.localeCompare(right.key));
  };

  const sumBy = async (path, query = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext) || (!resolvedContext && isMongoMode())) {
      const mongoDb = isMongoContext(resolvedContext)
        ? resolvedContext.mongoDb
        : (await getMongoOperations()).getMongoDb
          ? await (await getMongoOperations()).getMongoDb()
          : null;
      if (mongoDb) {
        const options = isMongoContext(resolvedContext)
          ? { session: resolvedContext.session }
          : {};
        const [row] = await mongoDb.collection(collectionKey).aggregate([
          { $match: query || {} },
          { $group: { _id: null, total: { $sum: { $ifNull: [`$${path}`, 0] } } } }
        ], options).toArray();
        return Number(row?.total || 0);
      }
    }
    const items = (await getCollectionSnapshot(collectionKey, resolvedContext))
      .filter((item) => matchesQuery(item, query));
    return items.reduce(
      (total, item) => total + Number(getPathValue(item, path) || 0),
      0
    );
  };

  const sumArrayLengthBy = async (path, query = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext) || (!resolvedContext && isMongoMode())) {
      const mongoDb = isMongoContext(resolvedContext)
        ? resolvedContext.mongoDb
        : await (await getMongoOperations()).getMongoDb();
      const aggregateOptions = isMongoContext(resolvedContext)
        ? { session: resolvedContext.session }
        : {};
      const [row] = await mongoDb.collection(collectionKey).aggregate([
        { $match: query || {} },
        { $group: {
          _id: null,
          total: { $sum: { $size: { $ifNull: [`$${path}`, []] } } }
        } }
      ], aggregateOptions).toArray();
      return Number(row?.total || 0);
    }
    const items = (await getCollectionSnapshot(collectionKey, resolvedContext))
      .filter((item) => matchesQuery(item, query));
    return items.reduce((total, item) => {
      const value = getPathValue(item, path);
      return total + (Array.isArray(value) ? value.length : 0);
    }, 0);
  };

  const findTopByArrayLength = async (path, limitOrOptions = 10, query = {}, context) => {
    const options = typeof limitOrOptions === 'object'
      ? limitOrOptions
      : { limit: limitOrOptions };
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 10)));
    const safeSkip = Math.max(0, Math.floor(Number(options.skip) || 0));
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext) || (!resolvedContext && isMongoMode())) {
      const mongoDb = isMongoContext(resolvedContext)
        ? resolvedContext.mongoDb
        : await (await getMongoOperations()).getMongoDb();
      const options = isMongoContext(resolvedContext)
        ? { session: resolvedContext.session }
        : {};
      const rows = await mongoDb.collection(collectionKey).aggregate([
        { $match: query || {} },
        { $addFields: { __arrayLength: { $size: { $ifNull: [`$${path}`, []] } } } },
        { $sort: { __arrayLength: -1, id: 1 } },
        ...(safeSkip ? [{ $skip: safeSkip }] : []),
        { $limit: safeLimit },
        { $unset: '__arrayLength' }
      ], options).toArray();
      return rows.map(stripMongoId);
    }
    const items = (await getCollectionSnapshot(collectionKey, resolvedContext))
      .filter((item) => matchesQuery(item, query));
    return [...items]
      .sort((left, right) => {
        const leftLength = Array.isArray(getPathValue(left, path))
          ? getPathValue(left, path).length
          : 0;
        const rightLength = Array.isArray(getPathValue(right, path))
          ? getPathValue(right, path).length
          : 0;
        return rightLength - leftLength;
      })
      .slice(safeSkip, safeSkip + safeLimit);
  };

  const groupArrayValues = async (paths, query = {}, context) => {
    const safePaths = ensureArray(paths).map(String).filter(Boolean);
    if (!safePaths.length) return [];
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext) || (!resolvedContext && isMongoMode())) {
      const mongoDb = isMongoContext(resolvedContext)
        ? resolvedContext.mongoDb
        : await (await getMongoOperations()).getMongoDb();
      const sessionOptions = isMongoContext(resolvedContext)
        ? { session: resolvedContext.session }
        : {};
      const valuesExpression = safePaths.length === 1
        ? { $ifNull: [`$${safePaths[0]}`, []] }
        : { $setUnion: safePaths.map((path) => ({ $ifNull: [`$${path}`, []] })) };
      const rows = await mongoDb.collection(collectionKey).aggregate([
        { $match: query || {} },
        { $project: { values: valuesExpression } },
        { $unwind: '$values' },
        { $match: { values: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: { $toString: '$values' } }, tag: { $first: '$values' }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, tag: 1, count: 1 } }
      ], sessionOptions).toArray();
      return rows.map(stripMongoId);
    }
    const counts = new Map();
    const items = (await getCollectionSnapshot(collectionKey, resolvedContext))
      .filter((item) => matchesQuery(item, query));
    for (const item of items) {
      const unique = new Map();
      for (const path of safePaths) {
        const raw = getPathValue(item, path);
        for (const value of ensureArray(raw)) {
          const tag = String(value || '').trim();
          if (tag) unique.set(tag.toLowerCase(), tag);
        }
      }
      for (const [key, tag] of unique) {
        const current = counts.get(key);
        counts.set(key, { tag: current?.tag || tag, count: (current?.count || 0) + 1 });
      }
    }
    return [...counts.values()].sort((left, right) =>
      right.count - left.count || left.tag.localeCompare(right.tag)
    );
  };

  const filter = async (predicate, context) => {
    const items = await getCollectionSnapshot(collectionKey, context);
    return items.filter(predicate);
  };

  const insert = async (item, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      await resolvedContext.mongoDb
        .collection(collectionKey)
        .insertOne(item, { session: resolvedContext.session });
      return item;
    }
    if (resolvedContext?.db) {
      resolvedContext.db[collectionKey] = ensureArray(
        resolvedContext.db[collectionKey]
      );
      resolvedContext.db[collectionKey].push(item);
      return item;
    }
    if (isMongoMode()) {
      const { insertMongoDocument } = await getMongoOperations();
      return insertMongoDocument(collectionKey, item);
    }
    let created;
    await updateCollection(collectionKey, (items) => {
      items.push(item);
      created = item;
      return items;
    });
    return created;
  };

  const insertIfAbsent = async (query, item, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      const collection = resolvedContext.mongoDb.collection(collectionKey);
      const result = await collection.updateOne(
        query || {},
        { $setOnInsert: item },
        { upsert: true, session: resolvedContext.session }
      );
      const stored = await collection.findOne(query || {}, {
        session: resolvedContext.session
      });
      return {
        item: stored ? stripMongoId(stored) : item,
        inserted: result.upsertedCount === 1
      };
    }
    if (!resolvedContext && isMongoMode()) {
      const { upsertMongoDocument } = await getMongoOperations();
      return upsertMongoDocument(collectionKey, query, item);
    }
    const existing = await findOneBy(query, {}, resolvedContext);
    if (existing) return { item: existing, inserted: false };
    return { item: await insert(item, resolvedContext), inserted: true };
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
    if (isMongoContext(resolvedContext)) {
      const collection = resolvedContext.mongoDb.collection(collectionKey);
      const currentRaw = await collection.findOne(
        { [resolvedIdField]: id },
        { session: resolvedContext.session }
      );
      if (!currentRaw) return undefined;
      const current = stripMongoId(currentRaw);
      const draft = structuredClone(current);
      const updated = await updater(draft);
      const resolved = updated && typeof updated === 'object' ? updated : draft;
      await collection.replaceOne(
        { _id: currentRaw._id },
        resolved,
        { session: resolvedContext.session }
      );
      return resolved;
    }
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
    if (isMongoMode()) {
      const { updateMongoDocument } = await getMongoOperations();
      return updateMongoDocument(
        collectionKey,
        { [resolvedIdField]: id },
        updater
      );
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
    if (isMongoContext(resolvedContext)) {
      const removed = await resolvedContext.mongoDb
        .collection(collectionKey)
        .findOneAndDelete(
          { [resolvedIdField]: id },
          { session: resolvedContext.session }
        );
      return removed ? stripMongoId(removed) : undefined;
    }
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
    if (isMongoMode()) {
      const { removeMongoDocument } = await getMongoOperations();
      return removeMongoDocument(collectionKey, { [resolvedIdField]: id });
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

  const removeManyBy = async (query = {}, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      const result = await resolvedContext.mongoDb
        .collection(collectionKey)
        .deleteMany(query, { session: resolvedContext.session });
      return { deletedCount: result.deletedCount };
    }
    if (!resolvedContext && isMongoMode()) {
      const { removeMongoDocuments } = await getMongoOperations();
      return removeMongoDocuments(collectionKey, query);
    }
    let deletedCount = 0;
    await updateAll((items) =>
      items.filter((item) => {
        if (!matchesQuery(item, query)) return true;
        deletedCount += 1;
        return false;
      }), resolvedContext);
    return { deletedCount };
  };

  const patchManyBy = async (query, patch, context) => {
    const resolvedContext = resolveContext(context);
    if (isMongoContext(resolvedContext)) {
      const result = await resolvedContext.mongoDb
        .collection(collectionKey)
        .updateMany(
          query || {},
          { $set: patch || {} },
          { session: resolvedContext.session }
        );
      return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    }
    if (!resolvedContext && isMongoMode()) {
      const { patchMongoDocuments } = await getMongoOperations();
      return patchMongoDocuments(collectionKey, query, patch);
    }
    let matchedCount = 0;
    let modifiedCount = 0;
    await updateAll((items) => {
      items.forEach((item) => {
        if (!matchesQuery(item, query)) return;
        matchedCount += 1;
        const changed = Object.entries(patch || {}).some(
          ([key, value]) => !valuesEqual(getPathValue(item, key), value)
        );
        Object.entries(patch || {}).forEach(([key, value]) => {
          setPathValue(item, key, value);
        });
        if (changed) modifiedCount += 1;
      });
      return items;
    }, resolvedContext);
    return { matchedCount, modifiedCount };
  };

  const unsetManyBy = async (query, paths, context) => {
    const safePaths = ensureArray(paths).map(String).filter(Boolean);
    if (!safePaths.length) return { matchedCount: 0, modifiedCount: 0 };
    const resolvedContext = resolveContext(context);
    const unset = Object.fromEntries(safePaths.map((path) => [path, '']));
    if (isMongoContext(resolvedContext)) {
      const result = await resolvedContext.mongoDb
        .collection(collectionKey)
        .updateMany(
          query || {},
          { $unset: unset },
          { session: resolvedContext.session }
        );
      return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    }
    if (!resolvedContext && isMongoMode()) {
      const { unsetMongoDocumentPaths } = await getMongoOperations();
      return unsetMongoDocumentPaths(collectionKey, query, safePaths);
    }
    let matchedCount = 0;
    let modifiedCount = 0;
    await updateAll((items) => {
      items.forEach((item) => {
        if (!matchesQuery(item, query)) return;
        matchedCount += 1;
        if (safePaths.some((path) => unsetPathValue(item, path))) {
          modifiedCount += 1;
        }
      });
      return items;
    }, resolvedContext);
    return { matchedCount, modifiedCount };
  };

  return {
    key: collectionKey,
    getAll,
    findOne,
    findById,
    findOneBy,
    findManyBy,
    countBy,
    groupCountBy,
    groupSumBy,
    sumBy,
    sumArrayLengthBy,
    findTopByArrayLength,
    groupArrayValues,
    filter,
    insert,
    insertIfAbsent,
    replaceAll,
    updateAll,
    updateById,
    removeById,
    removeManyBy,
    patchManyBy,
    unsetManyBy
  };
};
