import Routes  from 'express';
import { login, register, logout, protectedRouter } from '../controllers/auth-controller.js'

const router = Routes();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);
router.get('/protected', protectedRouter);

export default router;