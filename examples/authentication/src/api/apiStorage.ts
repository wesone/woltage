import {AsyncLocalStorage} from 'node:async_hooks';
import type {Request} from 'express';

type APIStorage = {
    user: Request['user']
};

export default new AsyncLocalStorage<APIStorage>();
