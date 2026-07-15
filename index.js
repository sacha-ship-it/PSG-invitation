const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js')

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const GUILD_ID = process.env.GUILD_ID
const INVITE_CHANNEL_ID = process.env.INVITE_CHANNEL_ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
})

const inviteCache = new Map()
const inviteCount = new Map()

async function refreshInviteCache(guild) {
  const invites = await guild.invites.fetch()
  invites.forEach(invite => {
    inviteCache.set(invite.code, {
      inviterId: invite.inviter?.id,
      uses: invite.uses
    })
  })
}

async function postInviteMessage(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mes_invitations_fr')
      .setLabel('🔴 Mes invitations')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('mon_lien_fr')
      .setLabel('🔗 Obtenir mon lien')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('mes_invitations_en')
      .setLabel('🔵 My invitations')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('mon_lien_en')
      .setLabel('🔗 Get my link')
      .setStyle(ButtonStyle.Secondary),
  )

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🔴🔵 CONCOURS D\'INVITATIONS - CDM DES PARISIENS')
      .setDescription(
        '**🇫🇷 Français**\n' +
        'Invite un maximum de membres sur le serveur ! Les 3 meilleurs inviteurs remporteront de très beaux lots PSG 🎁\n\n' +
        '🥇 1er - De très beaux lots t\'attendent\n' +
        '🥈 2ème - De très beaux lots t\'attendent\n' +
        '🥉 3ème - De très beaux lots t\'attendent\n\n' +
        'Clique sur **Mes invitations** pour voir ton score.\n' +
        'Clique sur **Obtenir mon lien** pour recevoir ton lien personnel.\n\n' +
        '---\n\n' +
        '**🇬🇧 English**\n' +
        'Invite as many members as possible to the server! The top 3 inviters will win amazing PSG prizes 🎁\n\n' +
        '🥇 1st place - Amazing prizes await you\n' +
        '🥈 2nd place - Amazing prizes await you\n' +
        '🥉 3rd place - Amazing prizes await you\n\n' +
        'Click **My invitations** to see your score.\n' +
        'Click **Get my link** to receive your personal invite link.\n\n' +
        '*The top 3 across all members will be rewarded, regardless of language.*'
      )
      .setColor('#DA291C')
      .setFooter({ text: '🔴🔵 CDM des Parisiens - Invite tes amis et grimpe dans le classement !' })],
    components: [row]
  })
}

client.on('ready', async () => {
  console.log(`Bot connecté : ${client.user.tag}`)

  const guild = await client.guilds.fetch(GUILD_ID)
  await refreshInviteCache(guild)

  const commands = [
    new SlashCommandBuilder()
      .setName('invites')
      .setDescription('Affiche le classement des 10 meilleurs inviteurs'),
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Poste le message du concours d\'invitations dans le canal dédié'),
  ].map(cmd => cmd.toJSON())

  const rest = new REST({ version: '10' }).setToken(TOKEN)
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  console.log('Commandes enregistrées')
})

client.on('inviteCreate', invite => {
  inviteCache.set(invite.code, {
    inviterId: invite.inviter?.id,
    uses: invite.uses
  })
})

client.on('inviteDelete', invite => {
  inviteCache.delete(invite.code)
})

client.on('guildMemberAdd', async member => {
  const guild = member.guild
  const newInvites = await guild.invites.fetch()

  let usedInvite = null

  newInvites.forEach(invite => {
    const cached = inviteCache.get(invite.code)
    if (cached && invite.uses > cached.uses) {
      usedInvite = invite
    }
  })

  if (usedInvite && usedInvite.inviter) {
    const inviterId = usedInvite.inviter.id
    const current = inviteCount.get(inviterId) || { count: 0, username: usedInvite.inviter.username }
    inviteCount.set(inviterId, {
      count: current.count + 1,
      username: usedInvite.inviter.username
    })
  }

  newInvites.forEach(invite => {
    inviteCache.set(invite.code, {
      inviterId: invite.inviter?.id,
      uses: invite.uses
    })
  })
})

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'invites') {
      const top = [...inviteCount.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)

      const medals = ['🥇', '🥈', '🥉']
      const classement = top.length
        ? top.map(([id, data], i) => {
            const rank = medals[i] || (i + 1) + '.'
            return rank + ' <@' + id + '> : ' + data.count + ' invitation' + (data.count > 1 ? 's' : '')
          }).join('\n')
        : 'Aucune invitation pour le moment.'

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🔴🔵 CLASSEMENT DES INVITATIONS')
          .setDescription(classement)
          .setColor('#DA291C')
          .setFooter({ text: 'Invite tes amis et grimpe dans le classement !' })],
        ephemeral: false
      })
    }

    if (interaction.commandName === 'setup') {
      const channel = await client.channels.fetch(INVITE_CHANNEL_ID)
      await postInviteMessage(channel)
      await interaction.reply({ content: '✅ Message posté dans le canal invitations !', ephemeral: true })
    }
  }

  if (interaction.isButton()) {
    const userId = interaction.user.id
    const data = inviteCount.get(userId)
    const count = data ? data.count : 0
    const isFr = interaction.customId.endsWith('_fr')

    if (interaction.customId.startsWith('mes_invitations')) {
      const message = isFr
        ? `🔴🔵 **Tes invitations**\n\nTu as invité **${count} membre${count > 1 ? 's' : ''}** sur le serveur !\n\nContinue pour grimper dans le classement 🏆`
        : `🔴🔵 **Your invitations**\n\nYou have invited **${count} member${count > 1 ? 's' : ''}** to the server!\n\nKeep going to climb the leaderboard 🏆`

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(message)
          .setColor('#DA291C')],
        ephemeral: true
      })
    }

    if (interaction.customId.startsWith('mon_lien')) {
      const guild = interaction.guild
      const existingInvites = await guild.invites.fetch()
      let personalInvite = existingInvites.find(inv => inv.inviter?.id === userId && inv.maxAge === 0)

      if (!personalInvite) {
        const channel = interaction.channel
        personalInvite = await channel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: `Lien personnel de ${interaction.user.username}`
        })
        inviteCache.set(personalInvite.code, {
          inviterId: userId,
          uses: 0
        })
      }

      const message = isFr
        ? `🔗 **Ton lien personnel :**\nhttps://discord.gg/${personalInvite.code}\n\nPartage-le avec tes amis pour les inviter sur le serveur !`
        : `🔗 **Your personal link:**\nhttps://discord.gg/${personalInvite.code}\n\nShare it with your friends to invite them to the server!`

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(message)
          .setColor('#DA291C')],
        ephemeral: true
      })
    }
  }
})

client.login(TOKEN)
