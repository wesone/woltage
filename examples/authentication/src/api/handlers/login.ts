import {BadRequestError, validate, z} from 'woltage';
import type {APIHandler} from '../server.ts';
import User from '../../readModels/User.ts';
import {validatePassword} from '../../utils/password.ts';
import {AUTH_TOKEN_HEADER_NAME, generateToken} from '../../utils/ACL.ts';

export default {
    method: 'post',
    handler: async (req, res) => {
        const {email, password} = validate(z.object({
            email: z.email(),
            password: z.string()
        }), req.body);

        const user = await req.woltage.executeQuery(User, 'findOne', {email});
        if(!user || !await validatePassword(password, user.passwordHash))
            throw new BadRequestError('Email address not found or password is wrong.');

        res.header(AUTH_TOKEN_HEADER_NAME, generateToken({
            ...user,
            passwordHash: undefined
        }));

        res.status(200).end();
    }
} satisfies APIHandler;
