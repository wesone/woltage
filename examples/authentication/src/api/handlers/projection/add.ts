import {z} from 'zod/v4';
import type {APIHandler} from '../../server.ts';
import {validate} from 'woltage';
import stores from '../../../stores.ts';

type StoreName = keyof typeof stores;

export default {
    method: 'post',
    handler: async (req, res) => {
        const payload = validate(
            z.object({
                name: z.string(),
                version: z.int(),
                projector: z.object({
                    name: z.string(),
                    version: z.int()
                }),
                adapter: z.enum(Object.keys(stores) as [StoreName, ...StoreName[]])
            }),
            req.body
        );
        await req.woltage.addProjection(
            payload.name,
            payload.version,
            payload.projector.name,
            payload.projector.version,
            payload.adapter
        );
        res.status(200).end();
    }
} as APIHandler;
