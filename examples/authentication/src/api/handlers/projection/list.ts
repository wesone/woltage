import type {APIHandler} from '../../server.ts';

export default {
    method: 'get',
    handler: async (req, res) => {
        res.json(req.woltage.getProjections()).end();
    }
} as APIHandler;
