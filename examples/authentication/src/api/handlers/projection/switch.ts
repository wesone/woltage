import {z} from 'zod/v4';
import type {APIHandler} from '../../server.ts';
import {validate} from 'woltage';

export default {
    method: 'post',
    handler: async (req, res) => {
        const payload = validate(
            z.object({
                name: z.string(),
                version: z.coerce.number().int()
            }),
            req.query
        );
        await req.woltage.setProjectionActive(
            payload.name,
            payload.version
        );
        res.status(200).end();
    }
} as APIHandler;
