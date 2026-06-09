'use strict';
require('dotenv').config();
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: './prisma/schema.prisma',
  migrate: {
    connectionString: process.env.DIRECT_URL ?? '',
  },
});
