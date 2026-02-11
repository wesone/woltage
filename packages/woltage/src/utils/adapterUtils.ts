import type {IStore} from '../adapters/Store.ts';
import type {AdapterConfig, StoreAdapterConfig} from '../WoltageConfig.ts';

export function constructAdapter<T extends new(...args: any) => any>(config: AdapterConfig<T>): InstanceType<T>
{
    return new config.adapter(...(config.args ?? []));
}

export function createStore<TAdapter extends new(...args: any) => IStore>(config: StoreAdapterConfig<TAdapter>, prefix: string)
{
    const instance = constructAdapter<TAdapter>(config);
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
