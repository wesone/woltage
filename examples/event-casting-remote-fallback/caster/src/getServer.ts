import express from 'express';
import {Event, z, validate} from 'woltage';
import getEventCaster from './getEventCaster.ts';

export default async function getServer()
{
    const eventCaster = await getEventCaster();
    const bodySchema = z.object({
        event: z.object({
            id: z.string(),
            aggregateId: z.string(),
            type: z.string(),
            version: z.number(),
            payload: z.any(),
            timestamp: z.string(),
            correlationId: z.string(),
            causationId: z.string(),
            meta: z.any(),
            position: z.string()
        }),
        targetVersion: z.number()
    });

    const app = express();

    app.use(express.json());

    app.post('/cast', async (req, res) => {
        const body = await validate(bodySchema, req.body);
        const event = await eventCaster.cast(Event.fromJSON(body.event), body.targetVersion);
        console.log(`Successfully cast ${Event.getDisplayName(body.event.type, body.event.version)} to ${event.getDisplayName()}.`);
        res.json(event).end();
    });

    const port = process.env.PORT;
    const server = app.listen(port, () => {
        console.log(`Caster started on port ${port}...`);
    });

    return server;
};
