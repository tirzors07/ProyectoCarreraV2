import jwt from 'jsonwebtoken';
import bcrypt from "bcrypt";

import { SECRET_JWT_KEY } from '../config/config.js';
import { UserRepository } from '../repositories/user-repository.js';

export const login = async (req, res) => { 
    //console.log("Login body:", req.body);
    const { username, password } = req.body;
    try {
        const user = await UserRepository.login({ username, password });
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_JWT_KEY, {
            expiresIn: "1h"// 1 hora
        })
        res.cookie('access_token', token, {httpOnly: true, secure:process.env.NODE_ENV == 'production',sameSite: 'strict',maxAge: 1000*60*60}).send(user)
    } catch (error) { 
        //console.error("Login error:", error.message);
        res.status(400).json(error.message );
    }
}
export const register = async (req, res) => { /*se añadio el campo email y se modifico esta fn  */
    const { username, _email, password } = req.body;
    try {
        const id = await UserRepository.create({ username,_email ,password });
        res.send({ id });
    } catch (error) { 
        res.status(400).send( error.message );
    }
}
export const logout = (req, res) => { 
    res.clearCookie('access_token').send('ok');
    //res.json({ message: 'Sesión cerrada correctamente' });
}
export const protectedRouter = async (req, res) => { 
    const { user } = req.session;
    if (!user) { 
        return res.status(401).send('unauthorized');
    }
    res.json(req.session.user);
}