import type {AdapterConfig, StoreAdapterConfig} from '../WoltageConfig.ts';

export function constructAdapter<T extends new(...args: any) => any>(config: AdapterConfig<T>)
{
    return new config.adapter(...(config.args ?? []));
}

export function createStore(config: StoreAdapterConfig, prefix: string)
{
    const instance = constructAdapter(config);
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
