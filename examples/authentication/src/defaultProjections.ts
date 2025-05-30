import type {Woltage} from 'woltage';
import stores from './stores.ts';

type DefaultProjectionDefinition = {
    version: number,
    projectorName: string,
    projectorVersion: number,
    adapter: keyof typeof stores
}

const defaultProjections: Record<string, DefaultProjectionDefinition> = {
    user: {version: 1, projectorName: 'UserProjector', projectorVersion: 1, adapter: 'mongo'},
};

export default async (woltage: Woltage) => {
    await Promise.all(
        Object.entries(defaultProjections)
            .map(
                ([name, {version, projectorName, projectorVersion, adapter}]) =>
                    woltage.addProjection(name, version, projectorName, projectorVersion, adapter)
                        .then(() => woltage.setProjectionActive(name, version, true))
                        .catch(() => {})
            )
    );
};
