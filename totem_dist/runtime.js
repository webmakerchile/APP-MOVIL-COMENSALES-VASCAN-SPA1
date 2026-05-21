"use strict";
process.env.DB_MODE = "totem";
require("./sync-worker");
require("../server/index");
