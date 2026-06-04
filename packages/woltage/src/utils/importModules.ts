import fs from 'node:fs/promises';
import path from 'node:path';

export default async function importModules<T = any>(dirPath: string, filter: (module: unknown, filepath: string) => boolean)
{
    const modules: T[] = [];
    await Promise.all(
        (await fs.readdir(dirPath, {withFileTypes: true, recursive: true}))
            .filter(dirent => dirent.isFile() && ['ts', 'js'].includes(dirent.name.split('.').pop() ?? ''))
            .map(async dirent => {
                const filepath = path.join(dirent.parentPath, dirent.name);
                const {default: module} = await import(filepath);
                if(filter(module, filepath))
                    modules.push(module);
            })
    );
    return modules;
}
