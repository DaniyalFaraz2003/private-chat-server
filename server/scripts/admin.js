/**
 * Usage: node admin.js add-user <username> <password>
 * Usage: node admin.js remove-user <username>
 * Usage: node admin.js list-users
 */

import bcrypt from 'bcryptjs';
import { initDb, createUser, deleteUser, listUsers, getUserByUsername } from '../src/db';

const [,, command, ...args] = process.argv;
initDb();

if (command === 'add-user') {
  const [username, password] = args;
  if (!username || !password) {
    console.error('Usage: node admin.js add-user <username> <password>');
    process.exit(1);
  }
  if (getUserByUsername(username)) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  createUser(username, hash);
  console.log(`✓ User "${username}" created.`);

} else if (command === 'remove-user') {
  const [username] = args;
  deleteUser(username);
  console.log(`✓ User "${username}" removed.`);

} else if (command === 'list-users') {
  const users = listUsers();
  if (users.length === 0) { console.log('No users.'); process.exit(0); }
  users.forEach(u => console.log(`  ${u.id}  ${u.username}  (created: ${new Date(u.created_at * 1000).toISOString()})`));

} else {
  console.log('Commands: add-user, remove-user, list-users');
}