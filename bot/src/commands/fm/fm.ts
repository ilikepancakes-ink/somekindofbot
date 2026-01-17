import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import axios from 'axios';
import { getFMUser } from '../../database';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fm')
    .setDescription('FM bot commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('fm')
        .setDescription('Shows your last 1–2 scrobbles')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to get scrobbles for (optional)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Display mode')
            .setRequired(false)
            .addChoices(
              { name: 'embedtiny', value: 'embedtiny' },
              { name: 'embedmini', value: 'embedmini' },
              { name: 'embedfull', value: 'embedfull' },
              { name: 'textmini', value: 'textmini' },
              { name: 'textfull', value: 'textfull' },
              { name: 'oneline', value: 'oneline' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('recent')
        .setDescription('Shows your latest plays')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to get plays for (optional)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('artist')
            .setDescription('Filter by artist (optional)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('track')
        .setDescription('Gets info about the track you\'re listening to or searching for')
        .addStringOption(option =>
          option.setName('track')
            .setDescription('The track to search for (optional, defaults to now playing)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('album')
        .setDescription('Gets info about the current or searched album')
        .addStringOption(option =>
          option.setName('album')
            .setDescription('The album to search for (optional, defaults to current)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('login')
        .setDescription('Connect your Last.fm account'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('fullhelp')
        .setDescription('Shows a complete list of all FM commands')),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'fm') {
      await handleFm(interaction);
    } else if (subcommand === 'recent') {
      await handleRecent(interaction);
    } else if (subcommand === 'track') {
      await handleTrack(interaction);
    } else if (subcommand === 'album') {
      await handleAlbum(interaction);
    } else if (subcommand === 'login') {
      await handleLogin(interaction);
    } else if (subcommand === 'fullhelp') {
      await handleFullhelp(interaction);
    }
  },
};

async function handleFm(interaction: any) {
  const userOption = interaction.options.getUser('user');
  const targetUser = userOption || interaction.user;
  const mode = interaction.options.getString('mode') || 'embedmini';

  const fmUser = await getFMUser(targetUser.id);
    if (!fmUser || !fmUser.lastfm_username) {
      return interaction.reply({ content: `${targetUser.username} has not connected their Last.fm account. Use /fm login to connect.`, flags: 64 });
    }

  try {
    const response = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=2`);
    const data = response.data;

    if (!data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
      return interaction.reply({ content: 'No recent tracks found.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${fmUser.lastfm_username}'s Recent Scrobbles`)
      .setColor(0xff0000);

    data.recenttracks.track.forEach((track: any, index: number) => {
      const artist = track.artist['#text'];
      const name = track.name;
      const album = track.album['#text'];
      const nowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';

      let description = `${index + 1}. ${artist} - ${name}`;
      if (album) description += ` (${album})`;
      if (nowPlaying) description += ' (Now Playing)';

      embed.addFields({ name: '\u200B', value: description, inline: false });
    });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Failed to fetch scrobbles.', flags: 64 });
  }
}

async function handleRecent(interaction: any) {
  const userOption = interaction.options.getUser('user');
  const targetUser = userOption || interaction.user;
  const artistFilter = interaction.options.getString('artist');

  const fmUser = await getFMUser(targetUser.id);
  if (!fmUser || !fmUser.lastfm_username) {
    return interaction.reply({ content: `${targetUser.username} has not connected their Last.fm account. Use /fm login to connect.`, flags: 64 });
  }

  try {
    let url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=10`;
    if (artistFilter) {
      url += `&artist=${encodeURIComponent(artistFilter)}`;
    }

    const response = await axios.get(url);
    const data = response.data;

    if (!data.recenttracks || !data.recenttracks.track || data.recenttracks.track.length === 0) {
      return interaction.reply({ content: 'No recent tracks found.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${fmUser.lastfm_username}'s Recent Plays`)
      .setColor(0xff0000);

    const tracks = data.recenttracks.track.slice(0, 10);
    tracks.forEach((track: any, index: number) => {
      const artist = track.artist['#text'];
      const name = track.name;
      const album = track.album['#text'];
      const nowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';

      let description = `${index + 1}. ${artist} - ${name}`;
      if (album) description += ` (${album})`;
      if (nowPlaying) description += ' (Now Playing)';

      embed.addFields({ name: '\u200B', value: description, inline: false });
    });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Failed to fetch recent plays.', flags: 64 });
  }
}

async function handleTrack(interaction: any) {
  const trackQuery = interaction.options.getString('track');

  const fmUser = await getFMUser(interaction.user.id);
  if (!fmUser || !fmUser.lastfm_username) {
    return interaction.reply({ content: 'You need to connect your Last.fm account first. Use /fm login.', flags: 64 });
  }

  try {
    let trackInfo;

    if (trackQuery) {
      const searchResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(trackQuery)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
      const track = searchResponse.data.results.trackmatches.track[0];
      if (!track) {
        return interaction.reply({ content: 'Track not found.', flags: 64 });
      }

      const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(track.artist)}&track=${encodeURIComponent(track.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
      trackInfo = infoResponse.data.track;
    } else {
      const recentResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
      const track = recentResponse.data.recenttracks.track[0];
      if (!track || !track['@attr'] || track['@attr'].nowplaying !== 'true') {
        return interaction.reply({ content: 'You are not currently playing a track.', flags: 64 });
      }

      const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(track.artist['#text'])}&track=${encodeURIComponent(track.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
      trackInfo = infoResponse.data.track;
    }

    const embed = new EmbedBuilder()
      .setTitle(trackInfo.name)
      .setDescription(`by ${trackInfo.artist.name}`)
      .setColor(0xff0000)
      .addFields(
        { name: 'Album', value: trackInfo.album ? trackInfo.album.title : 'N/A', inline: true },
        { name: 'Listeners', value: trackInfo.listeners, inline: true },
        { name: 'Playcount', value: trackInfo.playcount, inline: true },
        { name: 'User Playcount', value: trackInfo.userplaycount || '0', inline: true }
      );

    if (trackInfo.album && trackInfo.album.image && trackInfo.album.image[3]) {
      embed.setThumbnail(trackInfo.album.image[3]['#text']);
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Failed to fetch track info.', flags: 64 });
  }
}

async function handleAlbum(interaction: any) {
  const albumQuery = interaction.options.getString('album');

  const fmUser = await getFMUser(interaction.user.id);
  if (!fmUser || !fmUser.lastfm_username) {
    return interaction.reply({ content: 'You need to connect your Last.fm account first. Use /fm login.', flags: 64 });
  }

  try {
    let albumInfo;

    if (albumQuery) {
      const searchResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(albumQuery)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
      const album = searchResponse.data.results.albummatches.album[0];
      if (!album) {
        return interaction.reply({ content: 'Album not found.', flags: 64 });
      }

      const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
      albumInfo = infoResponse.data.album;
    } else {
      const recentResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${fmUser.lastfm_username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`);
      const track = recentResponse.data.recenttracks.track[0];
      if (!track) {
        return interaction.reply({ content: 'No recent tracks found.', flags: 64 });
      }

      const infoResponse = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURIComponent(track.artist['#text'])}&album=${encodeURIComponent(track.album['#text'])}&api_key=${process.env.LASTFM_API_KEY}&format=json`);
      albumInfo = infoResponse.data.album;
    }

    const embed = new EmbedBuilder()
      .setTitle(albumInfo.name)
      .setDescription(`by ${albumInfo.artist}`)
      .setColor(0xff0000)
      .addFields(
        { name: 'Listeners', value: albumInfo.listeners, inline: true },
        { name: 'Playcount', value: albumInfo.playcount, inline: true },
        { name: 'User Playcount', value: albumInfo.userplaycount || '0', inline: true }
      );

    if (albumInfo.image && albumInfo.image[3]) {
      embed.setThumbnail(albumInfo.image[3]['#text']);
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Failed to fetch album info.', flags: 64 });
  }
}

async function handleLogin(interaction: any) {
  const fmUser = await getFMUser(interaction.user.id);

  if (fmUser && fmUser.lastfm_username) {
    return interaction.reply({ content: `You are already connected as ${fmUser.lastfm_username}.` });
  }

  await interaction.deferReply();

  try {
    const response = await axios.get(`http://localhost:8594/auth/${interaction.user.id}`);
    const authUrl = response.data.authUrl;

    const embed = new EmbedBuilder()
      .setTitle('Connect Last.fm Account')
      .setDescription('Click the button below to authorize your Last.fm account.')
      .setColor(0xff0000);

    const button = new ButtonBuilder()
      .setLabel('Authorize')
      .setURL(authUrl)
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(button);

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: 'Failed to initiate Last.fm authentication.' });
  }
}

async function handleFullhelp(interaction: any) {
  const embed = new EmbedBuilder()
    .setTitle('FM Commands Help')
    .setDescription('List of all available FM commands')
    .setColor(0xff0000)
    .addFields(
      { name: '🎵 Plays Commands', value: '`/fm fm` - Shows your last 1–2 scrobbles\n`/fm recent` - Shows your latest plays', inline: false },
      { name: '🎧 Track Commands', value: '`/fm track` - Gets info about the track you\'re listening to or searching for\n`/fm trackplays` - Shows playcount for the current or searched track\n`/fm trackdetails` - Shows metadata for the current or searched track', inline: false },
      { name: '💿 Album Commands', value: '`/fm album` - Gets info about the current or searched album\n`/fm albumplays` - Shows playcount for the current or searched album\n`/fm chart` - Creates a chart of your top albums', inline: false },
      { name: '👤 Miscellaneous Commands', value: '`/fm login` - Connect your Last.fm account\n`/fm fullhelp` - Shows this help', inline: false }
    );

  await interaction.reply({ embeds: [embed], flags: 64 });
}
