import dotenv from 'dotenv';
dotenv.config({ path: '../../../.env' });


export const PORT = process.env.PORT ?? 3000;
export const DB_HOST = "localhost";//192.168.100.34";
export const DB_USER = "a1282016";//"root";
export const DB_PASSWORD = "admin123"//"natali123";
export const DB_NAME = "a1282016_bd3";//"proyecto";
export const SALT_ROUNDS = 10;
export const SECRET_JWT_KEY = "shhhhh,NO,MENTIRA,ES,SECRETO";
export const TCP_PORT = 6000;
export const VALID_CLIENT_ID = "a1282016";
export const VALID_ROOT_TOKEN = "root@777";

console.log("ENV cargado:", {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,

});
