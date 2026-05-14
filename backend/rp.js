require("dotenv").config();
const b = require("bcrypt");
const { getPool, sql, closePool } = require("./db");
(async () => {
  const h = await b.hash("Admin@123", 10);
  const p = await getPool();
  await p.request().input("h", sql.NVarChar(255), h).query("UPDATE users SET password=@h WHERE username='admin'");
  console.log("Done! Login: admin / Admin@123");
  await closePool();
  process.exit(0);
})();
