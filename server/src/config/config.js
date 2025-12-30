import dotenv from 'dotenv';
dotenv.config({ path: '../../../.env' });


export const PORT = process.env.PORT ?? 3000;
export const DB_HOST = "localhost";//";
export const DB_USER = "axxxxxxxx";//"root";
export const DB_PASSWORD = "xxxxxx"//"natali123";
export const DB_NAME = "xxxxxxxxxxxxxxxx";//"proyecto";
export const SALT_ROUNDS = 10;
export const SECRET_JWT_KEY = "shhhhh,NO,MENTIRA,ES,SECRETO";
export const TCP_PORT = 6000;
export const VALID_CLIENT_ID = "axxxxxxxxx";
export const VALID_ROOT_TOKEN = "root@777";

console.log("ENV cargado:", {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,

});

