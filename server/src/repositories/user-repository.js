import { pool } from '../db/mysql.js';
import bcrypst from 'bcrypt';
import { SALT_ROUNDS } from '../config/config.js';
import crypto from 'crypto';

export class UserRepository { 
    static async create({ username, _email,password }) { /*se modifico esta fn con lo de email */
        Validation.username(username)
        Validation.password(password)
        Validation.email(_email)
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR _email = ?', [username , _email]);
        if (rows.length > 0) {
            throw new Error('username or email already exists');
        }
        //const id = crypto.randomUUID()
        const hashedPassword = await bcrypst.hash(password, SALT_ROUNDS)
        await pool.query('INSERT INTO users (username,_email ,password) VALUES (?, ?, ?)', [
            //id,
            username,
            _email,
            hashedPassword
        ]);
        return { message: 'Registro exitoso' };
    }
    static async login({ username, password}) { 
        Validation.username(username);
        Validation.password(password);
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            throw new Error('invalid username or password');
        }
        const user = rows[0];
        const isPasswordValid = await bcrypst.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw new Error('invalid username or password');
        }
        return { id: user.id, username: user.username };
    }
}
class Validation { 
    static username(username) {
        if (typeof username !== 'string') {
            throw new Error('username is required')
        }
        if (username.length < 3) {
            throw new Error('username is too short, min 3 characters')
        }
    }
    static password(password) {
        if (typeof password !== 'string') {
            throw new Error('password is required')
        }
        if (password.length < 6) {
            throw new Error('password is too short, min 6 characters')
        }
    }
    static email(_email) {
        if (typeof _email !== 'string') {
            throw new Error('email is required')
        }
        if (_email.length < 6) {
            throw new Error('email is too short, min 6 characters')
        }
    }
}