// Tótem runtime entrypoint.
// Boots the existing Express app with DB_MODE=totem (SQLite) and additionally
// starts the sync worker that pulls master data and pushes pedidos to the
// cloud whenever internet is available.
//
// Used by the Windows installer as the program registered with NSSM.
//
// Environment required on the totem PC:
//   DB_MODE=totem
//   TOTEM_DB_PATH=C:\BuenaMezcla\totem-data\totem.db   (or unset for default)
//   CLOUD_URL=https://app.buenamezcla.cl
//   PORT=5000
//
// Identity (totem id + secret) is stored INSIDE the SQLite db (totem_config
// table) after first registration.

process.env.DB_MODE = "totem";
require("./sync-worker"); // starts background loop after the app is up
require("../server/index"); // boot the standard backend on local SQLite
