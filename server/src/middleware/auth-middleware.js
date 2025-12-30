import jwt from 'jsonwebtoken';
import { SECRET_JWT_KEY } from '../config/config.js';

export const authMiddleware = (req, res, next) => { 
    const token = req.cookies['access_token']
    req.session = { user: null }
    try {
        const data = jwt.verify(token, SECRET_JWT_KEY)
        req.session.user = data
    } catch (error) { 
        req.session.user = null
    }
    next()
}