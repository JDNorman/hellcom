import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {Command} from '../interfaces';
import {EMBED_COLOUR, FOOTER_MESSAGE} from './_components';
import {config} from '../config';
import {
  client,
  discordAppButton,
  supportDiscordButton,
  supportRow,
} from '../handlers';

const {
  DISCORD_APPLICATION_DIRECTORY,
  DISCORD_INVITE,
  KOFI_LINK,
  TOP_GG_LINK,
  BOT_OWNER,
  GITHUB_LINK,
} = config;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('links')
    .setDescription(
      'Link to invite HellCom to your own server and other related links'
    ),
  run: async interaction => {
    const owner = client.users.cache.get(BOT_OWNER);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: 'Major (@theyodastream)',
        iconURL: owner?.avatarURL?.() || undefined,
      })
      .setThumbnail(client.user?.avatarURL() || null)
      .setTitle('HellCom Links')
      .setDescription(
        `HellCom has its own Discord server dedicated to its development, **[HellCom Testing Grounds!](${DISCORD_INVITE})** ` +
          "Here you can discuss HellCom stuff, check the latest patches, suggest new features and report bugs. You're also welcome to just hang out and chat with fellow Helldivers about the game, no pressure! "
      )
      .setFields(
        {
          name: 'Adding HellCom to your own Servers',
          value: `Anyone can add HellCom to their server via the official [Discord App Directory](${DISCORD_APPLICATION_DIRECTORY}).`,
        },
        {
          name: "Supporting HellCom's Development",
          value:
            'HellCom is a personal project that takes up much of my spare time. ' +
            `If you'd like to support HellCom's development or just support me in general you can use my [ko-fi link](${KOFI_LINK}).` +
            '\n' +
            'Donating on ko-fi will grant you access to premium channels with the *highest priority for suggestions and support requests*!' +
            '\n\n' +
            `Alternatively, you can support HellCom is via voting for and/or reviewing it on [top.gg](${TOP_GG_LINK}) and starring it on [GitHub](${GITHUB_LINK}) so fellow Helldivers can find it more easily!`,
        }
      )
      .setFooter({text: FOOTER_MESSAGE})
      .setColor(EMBED_COLOUR);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
      supportDiscordButton,
      discordAppButton,
    ]);
    await interaction.editReply({
      embeds: [embed],
      components: [row, supportRow],
    });
    await interaction.followUp({
      content: DISCORD_INVITE,
      ephemeral: true,
    });
  },
};

export default command;
