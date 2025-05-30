import {scrypt, randomBytes, timingSafeEqual} from 'node:crypto';

const delimiter = '$';

const getHash = async (plain: string, salt: string): Promise<string> => {
    return await new Promise((resolve, reject) =>
        scrypt(plain, salt, 64, (err, derivedKey) => {
            if(err)
                reject(err);
            resolve(derivedKey.toString('hex'));
        })
    );
};

export const generatePasswordHash = async (password: string) => {
    const salt = randomBytes(16).toString('hex');
    const hash = await getHash(password, salt);
    return `${hash}${delimiter}${salt}`;
};

export const validatePassword = async (password: string, passwordHash: string) => {
    const [hash, salt] = passwordHash.split(delimiter);
    return timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(await getHash(password, salt), 'hex')
    );
};
