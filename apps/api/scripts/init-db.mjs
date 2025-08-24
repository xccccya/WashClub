import mysql from 'mysql2/promise';

const rootUser = 'root';
const rootPass = 'csc3619xcc';
const host = 'localhost';
const port = 3306;
const dbName = 'jukecar';
const appUser = 'juke123';
const appPass = 'juke123';

async function main() {
	const conn = await mysql.createConnection({ host, port, user: rootUser, password: rootPass, multipleStatements: true });
	await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
	await conn.query(`CREATE USER IF NOT EXISTS '${appUser}'@'localhost' IDENTIFIED BY '${appPass}';`);
	await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'localhost';`);
	await conn.query('FLUSH PRIVILEGES;');
	await conn.end();
	console.log('Database and user ensured.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});


