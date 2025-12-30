import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path:'../../../.env' });//src/server

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

async function test() {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    console.log("✅ Conexión exitosa:", rows);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error de conexión:", err.message);
    process.exit(1);
  }
}

test();
