import { DocumentType } from "@typegoose/typegoose";
import { AkairoClient, CommandHandler, ListenerHandler } from "discord-akairo";
import { Message, Collection } from "discord.js";
import { join } from "path";
import Config from "../config";
import MemberModel from "../models/MemberModel";
import AutoModModel from "../models/AutoModModel";
import Logger from "../structures/Logger";
import Mongo from "../structures/Mongo";
import AfkModel from "../models/AfkModel";

let owners = Config.bot.owners;
let prefix = Config.bot.prefix;

declare module "discord-akairo" {
  interface AkairoClient {
    commandHandler: CommandHandler;
    listenerHandler: ListenerHandler;
    botConfig: typeof Config;
    databaseCache_mutedUsers: Collection<string, DocumentType<MemberModel>>;
    databaseCache_autoModMutedUsers: Collection<string, DocumentType<AutoModModel>>;
    databaseCache_afkUsers: Collection<string, DocumentType<AfkModel>>;
    databaseCache: any;
  }
}

interface BotOptions {
  token?: string;
  owners?: string | string[];
}

export default class BotClient extends AkairoClient {
  public config: BotOptions;
  public botConfig: typeof Config;
  public static databaseCache: any = {};
  public databaseCache_mutedUsers = new Collection<
    string,
    DocumentType<MemberModel>
  >();
  public databaseCache_autoModMutedUsers = new Collection<
    string,
    DocumentType<AutoModModel>
  >();
  public databaseCache_afkUsers = new Collection<
    string,
    DocumentType<AfkModel>
  >();
  public listenerHandler: ListenerHandler = new ListenerHandler(this, {
    directory: join(__dirname, "..", "listeners"),
  });
  public commandHandler: CommandHandler = new CommandHandler(this, {
    directory: join(__dirname, "..", "commands"),
    prefix: prefix,
    allowMention: true,
    handleEdits: true,
    commandUtil: true,
    commandUtilLifetime: 3e5,
    defaultCooldown: 6e4,
    argumentDefaults: {
      prompt: {
        modifyStart: (_: Message, str: string): string =>
          `${str}\n\nType \`cancel\` to cancel the command...`,
        modifyRetry: (_: Message, str: string): string =>
          `${str}\n\nType \`cancel\` to cancel the command...`,
        timeout: "You took too long, the command has been canceled...",
        ended:
          "You've exceeded the maximum amount of tries, this command has now been canceled...",
        cancel: "This command has been canceled...",
        retries: 3,
        time: 3e4,
      },
      otherwise: "",
    },
    ignorePermissions: owners,
  });
  public constructor(config: BotOptions) {
    super(
      {
        ownerID: config.owners,
      },
      {
        ws: {
          intents: 14023,
        },
        http: {
          version: 8,
        },
      }
    );
    this.config = config;
  }
  private async _init(): Promise<void> {
    this.commandHandler.useListenerHandler(this.listenerHandler);
    this.listenerHandler.setEmitters({
      commandHandler: this.commandHandler,
      listenerHandler: this.listenerHandler,
    });
    this.commandHandler.loadAll();
    this.listenerHandler.loadAll();
    await Mongo()
      .catch((e) => Logger.error("DB", e))
      .then(() => Logger.success("DB", "Connected to MongoDB!"));
  }
  public async start(): Promise<string> {
    Logger.event("Starting the bot... please wait.");
    await this._init();
    return this.login(this.config.token);
  }
}
