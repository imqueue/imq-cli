/*!
 * IMQ-CLI library: travis
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import * as NodeRSA from 'node-rsa';
import { TravisClient } from '@imqueue/travis';
import { sleep } from './node';

/**
 * Returns encrypted secure key for travis sensitive data.
 *
 * @see https://docs.travis-ci.com/user/encryption-keys/
 * @param {string} repository - git repository owner/name
 * @param {string} data - sensitive data to encrypt
 * @param {string} github_token - token if auth required (pro mode)
 * @return {Promise<string>}
 */
export async function travisEncrypt(
    repository: string,
    data: string,
    github_token?: string
): Promise<string> {
    const travis = new TravisClient({ pro: !!github_token });

    // istanbul ignore next
    if (github_token) {
        await travis.authenticate({ github_token });
    }

    const [owner, repo] = repository.split('/');
    const pem = await travis.repos(owner, repo).key.get();
    const rsa = new NodeRSA();

    rsa.setOptions({ encryptionScheme: 'pkcs1' });
    rsa.importKey(pem.key);

    return rsa.encrypt(Buffer.from(data, 'utf8'), 'base64');
}

// istanbul ignore next
/**
 * Tries perform travis sync
 *
 * @param {TravisClient} travis - authenticated client
 * @param {number} [retry] - current retry
 * @param {number} maxRetries - max number of retries
 * @param {number} delay - delay in milliseconds before result return
 */
export async function trySyncBuilds(
    travis: TravisClient,
    retry: number = 0,
    maxRetries: number = 3,
    delay: number = 2000
): Promise<boolean> {
    try {
        await travis.users.sync.post();
        await sleep(delay);
    } catch(err) {
        if (retry < maxRetries) {
            await sleep(delay);

            return trySyncBuilds(
                travis,
                ++retry,
                maxRetries
            );
        }

        return false;
    }

    return true;
}

// istanbul ignore next
/**
 * Enables builds for a given repository
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} github_token
 * @return {Promise<void>}
 */
export async function enableBuilds(
    owner: string,
    repo: string,
    github_token: string,
    isPrivate: boolean
) {
    const travis = new TravisClient({ pro: isPrivate });

    await travis.authenticate({ github_token });
    await trySyncBuilds(travis);

    const hook = (await travis.hooks.get()).hooks.find((hook: any) =>
        hook.owner_name === owner && hook.name === repo);

    if (!hook) {
        return false;
    } else if (hook.active) {
        return true;
    }

    await travis.hooks(hook.id).put({ hook: { id: hook.id, active: true }});

    return true;
}
