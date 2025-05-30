import type {Application} from 'express';
import type {Woltage} from 'woltage';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import {aclMiddlewares} from '../ACL.ts';

export default (app: Application, woltage: Woltage) => {
    // https://www.npmjs.com/package/body-parser
    app.use(bodyParser.json({type: ['application/json']}));

    // https://www.npmjs.com/package/helmet
    app.use(helmet());

    // middleware to add woltage instance
    app.use((req, res, next) => {
        req.woltage = woltage;
        next();
    });

    // middlewares to handle auth and permissions
    app.use(...aclMiddlewares);
};
