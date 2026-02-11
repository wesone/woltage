import {validate, z} from 'woltage';
import type {APIHandler} from '../../server.ts';

export default {
    method: 'delete',
    handler: async (req, res) => {
        const payload = validate(
            z.object({
                name: z.string(),
                version: z.int()
            }),
            req.body
        );
        await req.woltage.removeProjection(
            payload.name,
            payload.version
        );
        res.status(200).end();
    }
} satisfies APIHandler;
