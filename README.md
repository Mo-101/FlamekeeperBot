# FlamekeeperBot Repository

This repository hosts the FlameKeeper Discord bot for the FlameBorn DAO.

The production-ready bot source lives inside the [`bot/`](bot/) directory so
that hosting providers like Render can use it as the service root
(`/opt/render/project/src/bot`).

A convenience `index.js` exists at the repository root so default start
commands like `node index.js` still launch the bot within the `bot/`
subdirectory. Deploy platforms that expect the entrypoint at the project root
(while installing dependencies from `bot/`) can therefore run without further
configuration.

See [`bot/README.md`](bot/README.md) for full setup, configuration, and
command documentation.
