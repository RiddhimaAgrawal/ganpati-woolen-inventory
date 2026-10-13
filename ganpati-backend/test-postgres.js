
require("dotenv").config();

const pool = require("./src/config/PostgreSQLdb");
async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("Supabase PostgreSQL connected!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Connection failed:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
