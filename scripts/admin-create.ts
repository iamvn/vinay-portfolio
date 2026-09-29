// Creates an admin account, or resets the password of an existing one.
//   npm run admin:create                      → asks for email and password
//   npm run admin:create -- you@example.com   → asks for the password only
// The password is typed interactively (hidden) so it never ends up in shell history.
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { hashPassword, passwordProblem } from '../lib/auth/password';
import { prisma } from '../lib/prisma';

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Print the prompt, then swallow echoed characters.
    const output = rl as unknown as { _writeToOutput: (text: string) => void; output: NodeJS.WriteStream };
    output._writeToOutput = (text: string) => { if (text.includes(question)) output.output.write(text); };
  }
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); }));
}

async function main() {
  const email = (process.argv[2] ?? (await ask('Admin email: '))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That is not a valid email address.');

  const existing = await prisma.user.findUnique({ where: { email } });
  console.log(existing ? `Resetting the password for ${email} (all of its sessions will be signed out).` : `Creating admin ${email}.`);

  const password = await ask('Password (min 10 characters): ', true);
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if ((await ask('Repeat password: ', true)) !== password) throw new Error('Passwords do not match.');

  const passwordHash = await hashPassword(password);
  if (existing) {
    await prisma.user.update({ where: { email }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    console.log('Password updated. You can log in at /login.');
  } else {
    await prisma.user.create({ data: { email, name: '', role: 'admin', passwordHash, createdAt: new Date().toISOString() } });
    console.log('Admin created. You can log in at /login.');
  }
}

main()
  .catch((error) => { console.error(`\n✖ ${error instanceof Error ? error.message : error}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
