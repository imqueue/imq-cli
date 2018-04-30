/*!
 * IMQ-CLI command: completions on
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
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
import { Argv } from 'yargs';
import {
    existsSync as exists,
    appendFileSync as append,
    readFileSync as read
} from 'fs';
import { resolve, touch } from '../../lib';
import chalk from 'chalk';

let PROGRAM: string = '';

// noinspection JSUnusedGlobalSymbols
export const { command, describe, builder, handler } = {
    command: 'on',
    describe: 'Enables completions for this program in your shell',

    builder(yargs: Argv) {
        PROGRAM = yargs.argv.$0;
    },

    handler() {
        const zshScript = Object.keys(process.env).some(key => /^ZSH/.test(key))
            ? 'autoload bashcompinit\nbashcompinit' : '';
        const script = `
###-begin-${PROGRAM}-completions-###
${zshScript}
_yargs_completions() {
	local cur_word args type_list
	cur_word="\${COMP_WORDS[COMP_CWORD]}"
	args=("\${COMP_WORDS[@]}")
	type_list=$(${PROGRAM} --get-yargs-completions "\${args[@]}")
	COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )
	if [ \${#COMPREPLY[@]} -eq 0 ]; then
		COMPREPLY=( $(compgen -f -- "\${cur_word}" ) )
	fi
	return 0
}
complete -F _yargs_completions ${PROGRAM}
###-end-${PROGRAM}-completions-###\n`;
        const rcFilename = zshScript ? '~/.zshrc' : '~/.bashrc';
        const rcFile = resolve(rcFilename);

        try {
            const rcText = read(rcFile, { encoding: 'utf8' });
            const rxExist = new RegExp(`###-begin-${PROGRAM}-completions-###`);
            const modify = exists(rcFile) ? append : touch;

            if (!rxExist.test(rcText)) {
                modify(rcFile, script);
                process.stdout.write(
                    chalk.green(`Completion script added to `) +
                    chalk.cyan(rcFilename) + '\n' +
                    'To have these changes to take effect, please, run:\n\n' +
                    '  $ ' + chalk.cyan(`source ${rcFilename}`) + '\n\n'
                );
            }

            else {
                process.stdout.write(
                    chalk.yellow.bold(
                        `Completion script already exists in your ${
                            rcFilename}.`) + '\n' +
                    'If it does not work, please try one of:\n\n' +
                    chalk.cyan('  1. Reload your shell\n') +
                    chalk.cyan(`  2. Run source ${rcFilename}\n\n`)
                );
            }
        }

        catch (err) {
            process.stderr.write(chalk.bold.red(err.message));
        }
    }
};