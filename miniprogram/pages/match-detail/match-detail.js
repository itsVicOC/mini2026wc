const api = require('../../services/api');
const { groupLabel, scoreText, stageLabel, teamName } = require('../../utils/format');

Page({
  data: {
    apiMatchId: null,
    loading: true,
    error: '',
    match: null
  },

  onLoad(options) {
    const apiMatchId = Number(options.apiMatchId);
    if (!apiMatchId) {
      this.setData({ loading: false, error: '比赛参数不正确' });
      return;
    }

    this.setData({ apiMatchId });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    const match = this.data.match;
    return {
      title: match ? `${match.homeName} vs ${match.awayName}` : '2026 世界杯比赛详情',
      path: `/pages/match-detail/match-detail?apiMatchId=${this.data.apiMatchId}`
    };
  },

  onShareTimeline() {
    const match = this.data.match;
    return {
      title: match ? `${match.homeName} vs ${match.awayName}` : '2026 世界杯比赛详情'
    };
  },

  async loadData() {
    if (!this.data.apiMatchId) {
      return;
    }

    this.setData({ loading: true, error: '' });
    try {
      const data = await api.getMatchDetail(this.data.apiMatchId);
      this.setData({
        loading: false,
        match: decorateMatch(data)
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '比赛详情加载失败'
      });
    }
  }
});

function decorateMatch(match) {
  const detail = match.detail || {};
  const homeName = teamName(match.homeTeam);
  const awayName = teamName(match.awayTeam);
  const referees = asArray(detail.referees).map((item) => item && item.name).filter(Boolean);

  return {
    ...match,
    homeName,
    awayName,
    scoreText: scoreText(match),
    stageText: stageLabel(match.stage),
    groupText: match.group ? groupLabel(match.group) : '',
    matchMinuteText: matchMinuteText(detail),
    detailSyncedText: formatBeijingDateTime(detail.detailSyncedAt || match.lastUpdated),
    infoRows: compactRows([
      { label: '北京时间', value: match.beijingTimeText },
      { label: '赛事阶段', value: stageLabel(match.stage) },
      { label: '所属小组', value: match.group ? groupLabel(match.group) : '' },
      { label: '比赛日', value: match.matchday ? `第 ${match.matchday} 比赛日` : '' },
      { label: '比赛场地', value: match.venue },
      { label: '观众人数', value: detail.attendanceTotal ? `${detail.attendanceTotal} 人` : '' },
      { label: '裁判', value: referees.join('、') },
      { label: '详情同步', value: formatBeijingDateTime(detail.detailSyncedAt) }
    ]),
    scoreRows: buildScoreRows(match),
    eventRows: buildEventRows(detail.events),
    statRows: buildStatRows(detail.statistics),
    homeLineupRows: buildPlayerRows(detail.lineups && detail.lineups.home),
    awayLineupRows: buildPlayerRows(detail.lineups && detail.lineups.away),
    homeBenchRows: buildPlayerRows(detail.lineups && detail.lineups.homeBench).slice(0, 8),
    awayBenchRows: buildPlayerRows(detail.lineups && detail.lineups.awayBench).slice(0, 8),
    homeFormation: detail.homeFormation,
    awayFormation: detail.awayFormation,
    homeCoach: detail.homeCoach,
    awayCoach: detail.awayCoach,
    hasDetail: Boolean(match.detail)
  };
}

function compactRows(rows) {
  return rows.filter((row) => row.value !== null && row.value !== undefined && String(row.value).trim() !== '');
}

function buildScoreRows(match) {
  const score = match.score || {};
  return compactRows([
    { label: '半场', value: scorePair(score.halfTimeHome, score.halfTimeAway) },
    { label: '全场', value: scorePair(score.home, score.away) },
    { label: '加时', value: scorePair(score.extraTimeHome, score.extraTimeAway) },
    { label: '点球', value: scorePair(score.penaltyHome, score.penaltyAway) }
  ]);
}

function buildEventRows(events = {}) {
  const rows = [];

  for (const event of asArray(events.goals)) {
    rows.push({
      minute: minuteValue(event),
      minuteText: eventMinuteText(event),
      typeText: '进球',
      className: 'event-type goal',
      teamText: eventTeamName(event && event.team),
      title: objectName(event && event.scorer) || '进球',
      desc: compactText([
        event && event.assist ? `助攻 ${objectName(event.assist)}` : '',
        event && event.type ? String(event.type) : ''
      ])
    });
  }

  for (const event of asArray(events.bookings)) {
    rows.push({
      minute: minuteValue(event),
      minuteText: eventMinuteText(event),
      typeText: cardText(event && event.card),
      className: 'event-type card',
      teamText: eventTeamName(event && event.team),
      title: objectName(event && event.player) || '球员',
      desc: event && event.card ? String(event.card) : ''
    });
  }

  for (const event of asArray(events.substitutions)) {
    rows.push({
      minute: minuteValue(event),
      minuteText: eventMinuteText(event),
      typeText: '换人',
      className: 'event-type sub',
      teamText: eventTeamName(event && event.team),
      title: objectName(event && event.playerIn) || '替补登场',
      desc: event && event.playerOut ? `换下 ${objectName(event.playerOut)}` : ''
    });
  }

  for (const event of asArray(events.penalties)) {
    rows.push({
      minute: minuteValue(event),
      minuteText: eventMinuteText(event),
      typeText: '点球',
      className: 'event-type penalty',
      teamText: eventTeamName(event && event.team),
      title: objectName(event && event.player) || '点球',
      desc: event && event.scored === false ? '未罚进' : ''
    });
  }

  return rows
    .filter((row) => row.minuteText || row.title || row.teamText)
    .sort((a, b) => a.minute - b.minute)
    .map((row, index) => ({
      ...row,
      eventId: `${row.typeText}-${row.minuteText || index}-${row.title || index}-${index}`
    }));
}

function buildStatRows(statistics = {}) {
  const homeMap = normalizeStats(statistics.home);
  const awayMap = normalizeStats(statistics.away);
  const keys = Array.from(new Set([...Object.keys(homeMap), ...Object.keys(awayMap)]));

  return keys
    .map((key) => ({
      label: statLabel(key),
      home: displayStatValue(homeMap[key]),
      away: displayStatValue(awayMap[key])
    }))
    .filter((row) => row.home !== '' || row.away !== '')
    .slice(0, 18);
}

function normalizeStats(input) {
  const result = {};
  if (!input) {
    return result;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item) {
        continue;
      }
      const key = item.type || item.name || item.key || item.label || item.stat;
      const value = firstPresent(item.value, item.displayValue, item.total, item.count);
      if (key) {
        result[String(key)] = value;
      }
    }
    return result;
  }

  if (typeof input === 'object') {
    for (const key of Object.keys(input)) {
      result[key] = input[key];
    }
  }
  return result;
}

function buildPlayerRows(players) {
  return asArray(players)
    .map((item) => {
      const player = item && (item.player || item);
      return {
        number: player && (player.shirtNumber || player.number),
        name: objectName(player),
        position: player && (player.position || item.position || '')
      };
    })
    .filter((player) => player.name);
}

function matchMinuteText(detail) {
  if (detail.matchMinute === null || detail.matchMinute === undefined) {
    return '';
  }
  const injury = detail.injuryTimeMinute ? `+${detail.injuryTimeMinute}` : '';
  return `${detail.matchMinute}${injury}'`;
}

function scorePair(home, away) {
  if (home === null || home === undefined || away === null || away === undefined) {
    return '';
  }
  return `${home} : ${away}`;
}

function eventMinuteText(event) {
  if (!event || event.minute === null || event.minute === undefined) {
    return '';
  }
  const injury = event.injuryTime ? `+${event.injuryTime}` : '';
  return `${event.minute}${injury}'`;
}

function minuteValue(event) {
  if (!event || event.minute === null || event.minute === undefined) {
    return 999;
  }
  return Number(event.minute) + Number(event.injuryTime || 0) / 100;
}

function objectName(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.name || value.shortName || value.tla || '';
}

function eventTeamName(team) {
  return team ? teamName(team) : '';
}

function cardText(card) {
  const text = String(card || '').toUpperCase();
  if (text.indexOf('RED') >= 0) {
    return '红牌';
  }
  if (text.indexOf('YELLOW') >= 0) {
    return '黄牌';
  }
  return '牌';
}

function statLabel(key) {
  const normalized = String(key).replace(/[\s_-]+/g, '').toLowerCase();
  const map = {
    possession: '控球率',
    ballpossession: '控球率',
    shots: '射门',
    shotstotal: '射门',
    shotstarget: '射正',
    shotsontarget: '射正',
    shotsongoal: '射正',
    cornerkicks: '角球',
    corners: '角球',
    fouls: '犯规',
    offsides: '越位',
    yellowcards: '黄牌',
    redcards: '红牌',
    saves: '扑救',
    passes: '传球',
    passaccuracy: '传球成功率'
  };
  return map[normalized] || String(key);
}

function displayStatValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return objectName(value) || JSON.stringify(value);
  }
  return String(value);
}

function firstPresent() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== null && arguments[index] !== undefined) {
      return arguments[index];
    }
  }
  return '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(parts) {
  return parts.filter(Boolean).join(' · ');
}

function formatBeijingDateTime(value) {
  const date = parseDate(value);
  if (!date) {
    return '';
  }
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${beijingDate.getUTCFullYear()}-${pad(beijingDate.getUTCMonth() + 1)}-${pad(beijingDate.getUTCDate())} ${pad(beijingDate.getUTCHours())}:${pad(beijingDate.getUTCMinutes())}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(`${normalized}${/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? '' : 'Z'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
