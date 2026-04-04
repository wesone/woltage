import type {APIHandler} from '../server.ts';
import {randomUUID} from 'crypto';
import registerCommand from '../../aggregates/user/register.ts';

export default {
    method: 'post',
    handler: async (req, res) => {
        await req.woltage.executeCommand(registerCommand, randomUUID(), req.body);
        res.status(200).end();
    }
} satisfies APIHandler;
