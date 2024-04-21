import {
  ColorResolvable,
  CommandInteraction,
  EmbedBuilder,
  ModalSubmitInteraction,
  NewsChannel,
  PublicThreadChannel,
  TextChannel,
} from 'discord.js';
import {config, helldiversConfig} from '../config';
import {client, formatPlayers, planetNameTransform} from '.';
import {
  Assignment,
  Faction,
  MappedTask,
  MergedCampaignData,
  MergedPlanetEventData,
  data,
  getAllCampaigns,
  getAllPlayers,
  getCampaignByPlanetName,
  getCurrencyName,
  getFactionName,
  getLatestAssignment,
  getPlanetName,
} from '../api-wrapper';
import {FACTION_COLOUR} from '../commands/_components';
import {apiData, db} from '../db';
import {asc, gt} from 'drizzle-orm';

const {SUBSCRIBE_FOOTER, FOOTER_MESSAGE, EMBED_COLOUR} = config;
const {factionSprites, altSprites} = helldiversConfig;

export function commandErrorEmbed(
  interaction: CommandInteraction | ModalSubmitInteraction
) {
  return {
    embeds: [
      new EmbedBuilder()
        .setAuthor({
          name: client.user?.tag || '',
          iconURL: client.user?.avatarURL() || undefined,
        })
        .setTitle('Something Went Wrong )=')
        .setDescription(
          `There was an issue trying to execute \`/${
            interaction.isCommand()
              ? interaction.commandName
              : interaction.customId
          }\`! ` +
            'The issue has been logged and will be looked into. Feel free to try again shortly. ' +
            'If the problem persists, please let Major know'
        )
        .setFooter({text: FOOTER_MESSAGE})
        .setColor(EMBED_COLOUR as ColorResolvable)
        .setTimestamp(),
    ],
  };
}

export function missingChannelPerms(interaction: CommandInteraction) {
  return {
    embeds: [
      new EmbedBuilder()
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.avatarURL() || undefined,
        })
        .setTitle('Permission Denied')
        .setDescription(
          'This command creates a public, persistent message. To avoid inconviencing other users, it requires moderator permissions. '
        )
        .setFooter({text: FOOTER_MESSAGE})
        .setColor(EMBED_COLOUR as ColorResolvable)
        .setTimestamp(),
    ],
  };
}

export function ownerCommandEmbed(interaction: CommandInteraction) {
  return {
    embeds: [
      new EmbedBuilder()
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.avatarURL() || undefined,
        })
        .setTitle('Permission Denied')
        .setDescription('This command is only available to Owners!')
        .setFooter({text: FOOTER_MESSAGE})
        .setColor(EMBED_COLOUR as ColorResolvable)
        .setTimestamp(),
    ],
  };
}

export function adminCommandEmbed(interaction: CommandInteraction) {
  return {
    embeds: [
      new EmbedBuilder()
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.avatarURL() || undefined,
        })
        .setTitle('Permission Denied')
        .setDescription('This command is only available to Admins!')
        .setFooter({text: FOOTER_MESSAGE})
        .setColor(EMBED_COLOUR as ColorResolvable)
        .setTimestamp(),
    ],
  };
}

export function subscribeEmbed(
  type: string,
  channel: NewsChannel | TextChannel | PublicThreadChannel
): EmbedBuilder[] {
  const embeds = [];
  const embed = new EmbedBuilder()
    // .setAuthor({
    //   name: 'Super Earth Command Dispatch',
    // })
    // .setThumbnail(
    //   factionSprites['Humans']
    // )
    // .setColor(FACTION_COLOUR.Humans)
    .setTitle('Success!')
    .setDescription(
      `<#${channel.id}> has been subscribed to receive updates for **${type}** events.`
    )
    .setFooter({text: FOOTER_MESSAGE})
    .setColor(EMBED_COLOUR as ColorResolvable)
    .setTimestamp();
  embeds.push(embed);
  return embeds;
}

export function subscribeNotifEmbed(type: string): EmbedBuilder[] {
  const embeds = [];
  const embed = new EmbedBuilder()
    .setAuthor({
      name: 'Super Earth Command Dispatch',
    })
    .setThumbnail(factionSprites['Humans'])
    .setColor(FACTION_COLOUR.Humans)
    .setTitle('Subscription Approved!')
    .setDescription(
      `This channel has been subscribed to receive updates for **${type}** events.`
    )
    .setFooter({text: SUBSCRIBE_FOOTER})
    .setColor(EMBED_COLOUR as ColorResolvable)
    .setTimestamp();
  embeds.push(embed);
  return embeds;
}

const taskTypeMappings = {
  3: 'Eradicate',
  11: 'Liberation',
  12: 'Defense',
  13: 'Control',
};

const valueTypeMappings = {
  1: 'race',
  3: 'goal',
  11: 'liberate',
  12: 'planet_index',
};

export function majorOrderEmbed(assignment: Assignment) {
  const {expiresIn, progress, setting} = assignment;
  const {
    type: settingsType,
    overrideTitle,
    overrideBrief,
    taskDescription,
    tasks,
    reward,
  } = setting;
  const {type, amount} = reward;

  const expiresInUtcS = Math.floor((Date.now() + expiresIn * 1000) / 1000);
  const expiresInDays = Math.floor(expiresIn / 86400);
  const expiresInHours = Math.floor((expiresIn % 86400) / 3600);

  // 0 means incomplete, 1 means complete
  const completed = progress.filter(value => value === 1).length;

  const campaigns = getAllCampaigns();

  const embedTitle = overrideTitle || 'Major Order';
  const embedDescription = overrideBrief || 'No briefing provided.';
  const embedTaskDescription =
    taskDescription || 'No task description provided.';
  const embedFields: {name: string; value: string; inline?: boolean}[] = [];

  embedFields.push(
    {
      name: 'Objective',
      value: embedTaskDescription,
      inline: false,
    },
    {
      name: 'Expires In',
      value: `<t:${expiresInUtcS}:R> (${expiresInDays}d ${expiresInHours}h)`,
      inline: true,
    }
  );
  // TODO: task progress here
  embedFields.push({
    name: 'Reward',
    value:
      `${amount}x ` +
      (type === 1 ? '<:warbond_medal:1231439956640010261>' : type.toString()),
    inline: true,
  });

  const mappedTasks: MappedTask[] = [];
  for (const [taskIndex, task] of tasks.entries()) {
    const {type, values, valueTypes} = task;
    // skip loop execution if task type not mapped
    if (!(type in taskTypeMappings)) continue;

    const mappedTask: MappedTask = {
      type: type,
      name: taskTypeMappings[type as keyof typeof taskTypeMappings],
      goal: -1,
      progress: -1,
      values: values,
      valueTypes: valueTypes,
    };
    for (const [valueIndex, valueType] of valueTypes.entries()) {
      // 1: 'race',
      // 3: 'goal',
      // 11: 'liberate',
      // 12: 'planet_index',
      if (valueType === 1) mappedTask.race = getFactionName(values[valueIndex]);
      if (valueType === 3) mappedTask.goal = values[valueIndex];
      if (valueType === 3) mappedTask.progress = progress[taskIndex];
      if (valueType === 11) mappedTask.liberate = values[valueIndex] === 1;
      if (valueType === 12) mappedTask.planetIndex = values[valueIndex];
    }
    mappedTasks.push(mappedTask);
  }

  for (const task of mappedTasks) {
    const {type, name, race, goal, progress, liberate, planetIndex} = task;
    const percent = ((progress / goal) * 100).toFixed(2);
    if (type === 3) {
      embedFields.push({
        name: `${name} ${race}`,
        value: `${progress.toLocaleString()} / ${goal.toLocaleString()} (${percent}%)`,
        inline: true,
      });
    } else if (type === 11 || type === 13) {
      const campaign = campaigns.find(c => c.planetIndex === planetIndex);
      const campaignProgress =
        campaign?.campaignType === 'Defend'
          ? campaign?.planetEvent?.defence ?? 0
          : campaign?.planetData.liberation ?? 0;
      let text = '';
      if (campaign)
        text = `**${campaign.campaignType}**: ${campaignProgress.toFixed(2)}%`;
      else text = '**COMPLETE**';
      embedFields.push({
        name: planetIndex ? getPlanetName(planetIndex) : 'Unknown Planet',
        value: text,
        inline: true,
      });
    } else if (type === 12) {
      embedFields.push({
        name: `Defend ${goal} Planets`,
        value: `${progress} / ${goal} (${percent})%`,
        inline: true,
      });
    }
  }

  const embed = new EmbedBuilder()
    .setThumbnail(factionSprites['Humans'])
    .setColor(FACTION_COLOUR.Humans)
    .setAuthor({
      name: 'Super Earth Command Dispatch',
      iconURL: altSprites['Humans'],
    })
    .setTitle(embedTitle)
    .setDescription(embedDescription)
    .setFields(embedFields)
    .setFooter({text: SUBSCRIBE_FOOTER});

  return embed;
}

export async function warStatusEmbeds() {
  const campaigns = getAllCampaigns();
  const players = getAllPlayers();
  const majorOrder = getLatestAssignment();

  const status: Record<Faction, {name: string; value: string}[]> = {
    Terminids: [],
    Automaton: [],
    Humans: [],
    Total: [],
  };

  const diverEmoji = client.emojis.cache.find(
    emoji => emoji.name === 'helldiver_icon_s092'
  );

  // todo: get API data from 2~ hours ago (or closer), and calculate the lossPercPerHour
  const timeCheck = 3 * 60 * 60 * 1000; // 6 hours in milliseconds
  const timestamp = new Date(Date.now() - timeCheck);
  // fetch the first API data entry that is older than 6 hours
  const pastApiData = await db.query.apiData.findMany({
    where: gt(apiData.createdAt, timestamp),
    orderBy: asc(apiData.createdAt),
  });
  for (const campaign of campaigns) {
    const oldData = pastApiData.find(d =>
      d.data.Campaigns.some(c => c.id === campaign.id)
    );

    let averageChangeStr = '';
    if (oldData) {
      const oldCampaign = oldData.data.Campaigns.find(
        c => c.id === campaign.id
      );
      const timeSinceInH =
        (Date.now() - new Date(oldData.createdAt).getTime()) / 1000 / 60 / 60;

      const oldPerc =
        oldCampaign!.campaignType === 'Liberation'
          ? oldCampaign!.planetData.liberation
          : oldCampaign!.planetEvent!.defence;
      const newPerc =
        campaign.campaignType === 'Liberation'
          ? campaign.planetData.liberation
          : campaign.planetEvent!.defence;
      const avgChange = (newPerc - oldPerc) / timeSinceInH;
      averageChangeStr +=
        ' (' +
        (avgChange >= 0 ? '+' : '') +
        parseFloat(avgChange.toFixed(2)) +
        '%/h)';
    }
    // const oldCampaign = pastApiData!.data.Campaigns.find(c => c.id === campaign.id);
    const {planetName, campaignType, planetData, planetEvent} = campaign;
    const {players, playerPerc} = planetData;
    const playersStr = `${diverEmoji} ${formatPlayers(
      players
    )} | ${playerPerc}%`;
    const title = `${planetName}: ${campaignType.toUpperCase()} - ${playersStr}`;

    if (campaignType === 'Liberation') {
      const {owner, liberation} = planetData;
      const progressBar = drawLoadingBarPerc(liberation, 30);
      status[owner as Faction].push({
        name: title,
        value: `${progressBar}` + averageChangeStr,
      });
    } else if (campaignType === 'Defend') {
      const {defence, race, expireTime} = planetEvent as MergedPlanetEventData;
      const expiresInS = expireTime - data.Status.time;
      const expireTimeUtc = Math.floor(Date.now() + expiresInS * 1000);
      const expiresInUtcS = Math.floor(expireTimeUtc / 1000);
      const progressBar = drawLoadingBarPerc(defence, 30);
      status[race as Faction].push({
        name: title,
        value:
          `${progressBar}` +
          averageChangeStr +
          `\n**Defence Ends**: <t:${expiresInUtcS}:R>`,
      });
    }
  }
  const automatonEmbed = new EmbedBuilder()
    .setThumbnail(factionSprites['Automaton'])
    .setColor(FACTION_COLOUR.Automaton)
    .setTitle('Automatons')
    .setDescription(
      `**${players.Automaton.toLocaleString()}** Helldivers are braving the automaton trenches!`
    )
    .addFields(status['Automaton']);

  const terminidEmbed = new EmbedBuilder()
    .setThumbnail(factionSprites['Terminids'])
    .setColor(FACTION_COLOUR.Terminids)
    .setTitle('Terminids')
    .setDescription(
      `**${players.Terminids.toLocaleString()}** Helldivers are deployed to manage the terminid swarms!`
    )
    .addFields(status['Terminids']);

  const embeds = [automatonEmbed, terminidEmbed];

  if (majorOrder) embeds.push(majorOrderEmbed(majorOrder));
  else
    embeds.push(
      new EmbedBuilder()
        .setTitle('Awaiting Major Order')
        .setColor(FACTION_COLOUR.Humans)
        .setDescription(
          'Stand by for further orders from Super Earth High Command'
        )
        .setThumbnail(factionSprites['Humans'])
    );

  return embeds;
}

export async function campaignEmbeds(planet_name?: string) {
  const campaigns: MergedCampaignData[] = planet_name
    ? [getCampaignByPlanetName(planet_name) as MergedCampaignData]
    : getAllCampaigns();

  const embeds = [];
  for (const campaign of campaigns) {
    const {planetName, campaignType, planetData, planetEvent} = campaign;
    const title = `${planetName}: ${campaignType.toUpperCase()}`;
    const planetThumbnailUrl = `https://helldiverscompanionimagescdn.b-cdn.net/planet-images/${planetNameTransform(
      planetName
    )}.png`;

    if (campaignType === 'Liberation') {
      const {
        maxHealth,
        initialOwner,
        owner,
        health,
        players,
        playerPerc,
        liberation,
        lossPercPerHour,
      } = planetData;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(FACTION_COLOUR[owner])
        .setImage(planetThumbnailUrl);
      embeds.push(embed);
      const squadImpact = maxHealth - health;

      const display = {
        Players: `${players.toLocaleString()} (${playerPerc}%)`,
        'Controlled By': owner,
        'Initial Owner': initialOwner,
        Liberation: `${liberation}%`,
        'Loss Per Hour': `${lossPercPerHour}%`,
        'Total Squad Impact': `${squadImpact.toLocaleString()} / ${maxHealth.toLocaleString()}`,
      };
      for (const [key, val] of Object.entries(display)) {
        embed.addFields({name: key, value: val.toString(), inline: true});
      }
    } else if (campaignType === 'Defend') {
      const {maxHealth, health, defence, race, expireTime} =
        planetEvent as MergedPlanetEventData;
      const {players, playerPerc, owner} = planetData;
      const statusTime = data.Status.time;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(FACTION_COLOUR[race])
        .setImage(planetThumbnailUrl);

      const expiresInS = expireTime - statusTime;
      const expireTimeUtc = Math.floor(Date.now() + expiresInS * 1000);

      const expiresInUtcS = Math.floor(expireTimeUtc / 1000);
      const expiresInDays = Math.floor(expiresInS / 86400);
      const expiresInHours = Math.floor((expiresInS % 86400) / 3600);

      const squadImpact = maxHealth - health;
      const display = {
        Players: `${players.toLocaleString()} (${playerPerc}%)`,
        'Controlled By': owner,
        Attackers: race,
        Defence: `${defence}%`,
        'Campaign Ends': `<t:${expiresInUtcS}:R> (${expiresInDays}d ${expiresInHours}h)`,
        'Total Squad Impact': `${squadImpact.toLocaleString()} / ${maxHealth.toLocaleString()}`,
      };
      for (const [key, val] of Object.entries(display)) {
        embed.addFields({name: key, value: val.toString(), inline: true});
      }
      embeds.push(embed);
    }
  }
  if (embeds.length > 1)
    embeds[embeds.length - 1].setFooter({text: FOOTER_MESSAGE}).setTimestamp();
  return embeds;
}

function drawLoadingBarPerc(percentage: number, barLength: number) {
  const percMult = percentage / 100;
  const progress = Math.round(barLength * percMult);
  const empty = barLength - progress;

  const progressBar = '[`' + '█'.repeat(progress) + ' '.repeat(empty) + '`]';

  return `${progressBar} ${percentage.toFixed(2)}%`;
}
