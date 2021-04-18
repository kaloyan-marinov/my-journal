import { config } from "dotenv";
import { ConnectionOptions } from "typeorm";
import path from "path";

config();
const { DATABASE_URL } = process.env;
console.log(
  `${new Date().toISOString()} -` +
    ` ${__filename}` +
    ` - inspecting the environment variable DATABASE_URL:`
);
console.log(DATABASE_URL);
if (DATABASE_URL === undefined) {
  console.log(
    `${new Date().toISOString()} -` +
      ` ${__filename} -` +
      ` no environment variable DATABASE_URL has been found - aborting!`
  );
  process.exit(1);
}

let sourceCodeFolder: string = process.env.NODE_ENV === "production" ? "dist" : "src";
console.log(
  `${new Date().toISOString()} -` +
    ` ${__filename} -` +
    ` inspecting the value of sourceCodeFolder:`
);
console.log(sourceCodeFolder);

const connectionsOptionsObjects: ConnectionOptions[] = [
  {
    name: "connection-to-db-for-dev",
    type: "sqlite",
    database: DATABASE_URL,
    entities: [path.join(__dirname, sourceCodeFolder, "entities.*")],
    cli: {
      migrationsDir: path.join(__dirname, sourceCodeFolder, "migration"),
    },
    migrations: [path.join(__dirname, sourceCodeFolder, "migration", "*.ts")],
  },
  {
    name: "connection-to-db-for-testing",
    type: "sqlite",
    database: ":memory:",
    entities: [path.join(__dirname, sourceCodeFolder, "entities.*")],
  },
];

export default connectionsOptionsObjects;
