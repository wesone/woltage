import express from 'express';
import type {RequestHandler, ErrorRequestHandler} from 'express';
import type {Woltage} from 'woltage';
import registerMiddlewares from './registerMiddlewares.ts';
import registerHandlers from './registerHandlers.ts';
import type {HTTPMethod} from '../utils/httpMethods.ts';
import type User from '../readModels/User.ts';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            woltage: Woltage,
            user: Awaited<ReturnType<User['findOne']>>
        }
    }
}

type ServerConfig = {
    port?: number
};

export type APIHandler = {
    /**
     * Define the route for this handler. If not provided, the directory structure will define the route.
     */
    route?: string,
    method: HTTPMethod,
    handler: RequestHandler
};

export default async (config: ServerConfig, woltage: Woltage) => {
    const app = express();

    registerMiddlewares(app, woltage);
    await registerHandlers(app);

    // Custom error handler for BadRequestError otherwise express will send error as HTML
    app.use(((err, req, res, next) => {
        if(err.status === 400)
        {
            res.set('Content-Type', 'application/json');
            res.status(err.status ?? 500).send(err.message);
            return next();
        }
        next(err);
    }) satisfies ErrorRequestHandler);

    const port = config.port ?? 3000;
    const server = app.listen(port, () => {
        console.log(`Application started on port ${port}...`);
    });

    return {app, server};
};
