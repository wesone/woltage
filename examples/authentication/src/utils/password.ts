import {scrypt, randomBytes, timingSafeEqual} from 'node:crypto';

const SALT_SIZE = 16;

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
    const salt = randomBytes(SALT_SIZE).toString('hex');
    const hash = await getHash(password, salt);
    return `${hash}${salt}`;
};

export const validatePassword = async (password: string, passwordHash: string) => {
    const saltLength = SALT_SIZE * 2;
    const salt = passwordHash.slice(-saltLength);
    const hash = passwordHash.slice(0, -saltLength);
    return timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(await getHash(password, salt), 'hex')
    );
};
