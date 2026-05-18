const Datastore = require('nedb-promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

const users = Datastore.create({ filename: path.join(dataDir, 'users.db'), autoload: true });
const transactions = Datastore.create({ filename: path.join(dataDir, 'transactions.db'), autoload: true });
const receipts = Datastore.create({ filename: path.join(dataDir, 'receipts.db'), autoload: true });
const clients = Datastore.create({ filename: path.join(dataDir, 'clients.db'), autoload: true });

users.ensureIndex({ fieldName: 'username', unique: true });

module.exports = { users, transactions, receipts, clients };
