import fs from 'node:fs/promises';
import path from 'node:path';
import type {Application} from 'express';
import type {APIHandler} from './server.ts';

const importHandlers = async (dirPath: string) => {
    const handlers: Record<string, APIHandler> = {};
    await Promise.all(
        (await fs.readdir(dirPath, {withFileTypes: true, recursive: true}))
            .filter(dirent => dirent.isFile() && ['ts', 'js'].includes(dirent.name.split('.').pop() ?? ''))
            .map(async dirent => {
                const {default: module} = await import(path.join(dirent.parentPath, dirent.name));
                const route = [
                    dirent.parentPath.replace(dirPath, ''),
                    path.basename(dirent.name, path.extname(dirent.name))
                ];
                if(typeof module?.handler === 'function')
                    handlers[module?.route ?? route.join('/')] = module;
            })
    );
    return handlers;
};

export default async (app: Application) => {
    app.post('/:aggregateType/:aggregateId/:commandName', async (req, res) => {
        const {aggregateType, aggregateId, commandName} = req.params;
        await req.woltage.executeCommand(aggregateType, aggregateId, commandName, req.body);
        res.status(200).end();
    });

    app.get('/:readModelName/:handlerName', async (req, res) => {
        const {readModelName, handlerName} = req.params;
        const result = await req.woltage.executeQuery(readModelName, handlerName, req.query);
        res.json(result).status(200).end();
    });

    Object.entries(await importHandlers(import.meta.dirname + '/handlers'))
        .map(([route, {method, handler}]) => app[method](route, handler));
};
