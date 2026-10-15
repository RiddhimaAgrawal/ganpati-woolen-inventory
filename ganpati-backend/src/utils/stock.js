// Shared helpers for EDITING and DELETING entries safely.
//
// Raw stock      = everything bought  - everything put into processing
// Finished stock = everything produced - everything sold
// (counted separately for each material type + name, e.g. WOOL / Merino)
//
// An edit or delete must never leave either of these below zero. So every change runs in a
// transaction: we make the change, re-check the stock of the affected type(s), and if anything went
// negative we roll back and tell the person why.

const pool = require('../config/db');
const { sendError } = require('./dbHelp');

// An error whose message is safe and useful to show to the person.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Send an AppError as-is; anything else goes through the normal database error handler.
function replyError(res, err, fallback) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  return sendError(res, err, fallback);
}

// A positive whole number from a URL parameter, or null.
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function uniquePairs(pairs) {
  const seen = new Map();
  for (const p of pairs) {
    if (p && p.material_type && p.sub_type) {
      seen.set(`${p.material_type}|${p.sub_type}`, {
        material_type: p.material_type,
        sub_type: p.sub_type,
      });
    }
  }
  // Always lock in the same order so two people editing at once cannot deadlock.
  return [...seen.values()].sort((a, b) =>
    `${a.material_type}|${a.sub_type}`.localeCompare(`${b.material_type}|${b.sub_type}`)
  );
}

// Uses the very same lock names as the "add" screens, so edits and new entries wait for each other.
async function lockPairs(client, pairs) {
  for (const p of pairs) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      `raw:${p.material_type}`,
      p.sub_type,
    ]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      `finished:${p.material_type}`,
      p.sub_type,
    ]);
  }
}

async function assertStockOk(client, pairs) {
  for (const p of pairs) {
    const r = await client.query(
      `SELECT
         COALESCE((SELECT SUM(quantity_kg) FROM raw_imports
                   WHERE material_type = $1 AND sub_type = $2), 0)
         - COALESCE((SELECT SUM(input_qty_kg) FROM processing_batches
                     WHERE material_type = $1 AND sub_type = $2), 0) AS raw_left,
         COALESCE((SELECT SUM(output_qty_kg) FROM processing_batches
                   WHERE material_type = $1 AND sub_type = $2), 0)
         - COALESCE((SELECT SUM(quantity_kg) FROM sales
                     WHERE material_type = $1 AND sub_type = $2), 0) AS finished_left`,
      [p.material_type, p.sub_type]
    );

    const rawLeft = Number(r.rows[0].raw_left);
    const finishedLeft = Number(r.rows[0].finished_left);
    const label = `${p.sub_type} (${p.material_type})`;

    if (rawLeft < -0.0001) {
      throw new AppError(
        400,
        `This change would leave raw stock of ${label} at ${rawLeft} kg, because that material is already used in processing. Change or delete the processing entries first.`
      );
    }

    if (finishedLeft < -0.0001) {
      throw new AppError(
        400,
        `This change would leave finished stock of ${label} at ${finishedLeft} kg, because that product is already sold. Change or delete the sales first.`
      );
    }
  }
}

// Run `work(client)` inside a transaction that locks the affected stock pools first and
// checks that no stock went negative afterwards.
async function stockTransaction(pairs, work) {
  const affected = uniquePairs(pairs);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await lockPairs(client, affected);
    const result = await work(client);
    await assertStockOk(client, affected);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { AppError, replyError, parseId, stockTransaction };
