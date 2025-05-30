import {StoreAdapterConfig} from './WoltageConfig.ts';

export function createStore(config: StoreAdapterConfig, prefix: string)
{
    return new config.adapter(prefix, ...(config.args ?? []));
}

export function createStoreFactory(stores: Record<string, StoreAdapterConfig>)
{
    return (storeName: keyof typeof stores, prefix: string) => {
        if(!stores[storeName])
            throw new Error(`Store ${storeName} not found.`);
        return createStore(stores[storeName], prefix);
    };
};
