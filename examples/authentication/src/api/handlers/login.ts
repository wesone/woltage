import {z} from 'zod/v4';
import type {APIHandler} from '../server.ts';
import {BadRequestError, validate} from 'woltage';
import type User from '../../readModels/User.ts';
import {validatePassword} from '../../utils/password.ts';
import {AUTH_TOKEN_COOKIE_NAME, generateToken} from '../../ACL.ts';

export default {
    method: 'post',
    handler: async (req, res) => {
        const {email, password} = validate(z.object({
            email: z.email(),
            password: z.string()
        }), req.body);

        const user = await (req.woltage.executeQuery('user', 'findOne', {email}) as ReturnType<User['findOne']>);
        if(!user || !await validatePassword(password, user.passwordHash))
            throw new BadRequestError('Email address not found or password is wrong.');

        res.cookie(AUTH_TOKEN_COOKIE_NAME, generateToken({
            ...user,
            passwordHash: undefined
        }));

        res.status(200).end();
    }
} as APIHandler;
