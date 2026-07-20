"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("@prisma/config");
exports.default = (0, config_1.defineConfig)({
    datasource: {
        url: process.env.DATABASE_URL || "postgresql://root:rootpassword@autopost_db:5432/autopost?schema=public",
    },
});
//# sourceMappingURL=prisma.config.js.map