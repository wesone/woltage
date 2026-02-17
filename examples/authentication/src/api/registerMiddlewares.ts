import express from 'express';
import type {Application} from 'express';
import type {Woltage} from 'woltage';
import helmet from 'helmet';
import {aclMiddlewares} from '../utils/ACL.ts';

export default (app: Application, woltage: Woltage) => {
    app.use(express.json());

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
