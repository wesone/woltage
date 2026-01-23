import {StoreAdapterConfig} from '../WoltageConfig.ts';

export function createStore(config: StoreAdapterConfig, prefix: string)
{
    const instance = new config.adapter(...(config.args ?? []));
    instance.prefix = prefix;
    return instance;
}

export function createStoreFactory(stores: Record<string, StoreAdapterConfig>)
{
    return (storeName: keyof typeof stores, prefix: string) => {
        if(!stores[storeName])
            throw new Error(`Store ${storeName} not found.`);
        return createStore(stores[storeName], prefix);
    };
};
