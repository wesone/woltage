import type {APIHandler} from '../server.ts';
import {randomUUID} from 'crypto';

export default {
    method: 'post',
    handler: async (req, res) => {
        await req.woltage.executeCommand('user', randomUUID(), 'register', req.body);
        res.status(200).end();
    }
} satisfies APIHandler;
