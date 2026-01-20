import fs from 'node:fs/promises';
import path from 'node:path';

export default async function importModules(dirPath: string, filter: (module: any) => boolean)
{
    const modules: any[] = [];
    await Promise.all(
        (await fs.readdir(dirPath, {withFileTypes: true, recursive: true}))
            .filter(dirent => dirent.isFile() && ['ts', 'js'].includes(dirent.name.split('.').pop() ?? ''))
            .map(async dirent => {
                const {default: module} = await import(path.join(dirent.parentPath, dirent.name));
                if(filter(module))
                    modules.push(module);
            })
    );
    return modules;
}
